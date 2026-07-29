"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  findUserByDisplayId,
  createBookingForUser,
  cancelBookingById,
  userHasBookingForSlot,
  checkBookableSubscriptionForUser,
  checkSlotCapacityForBooking,
} from "@/lib/booking-service"
import { chargeIndividualClass, getIndividualClassPlan } from "@/lib/class-charge"
import { validateBookingAgeForSlot } from "@/lib/booking-rules"
import {
  classEndFromBooking,
  evaluateBookingAllowed,
  loadStudioCancellationPolicy,
} from "@/lib/cancellation-policy"
import {
  bookingDateAtNoon,
  getDayOfWeekFromDateStr,
} from "@/lib/booking-slot-options"
import { isSlotDisabledOnDate } from "@/lib/slot-exceptions"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  message?: string
  bookedDate?: string
}

const createBookingSchema = z.object({
  displayId: z.string().min(3, "ID inválido"),
  scheduleSlotId: z.string().min(1),
  bookingDate: z.string().min(1),
})

export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session || (session.user.role !== "admin" && session.user.role !== "root")) {
    return { success: false, error: "No autorizado" }
  }

  const parsed = createBookingSchema.safeParse({
    displayId: formData.get("displayId"),
    scheduleSlotId: formData.get("scheduleSlotId"),
    bookingDate: formData.get("bookingDate"),
  })
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const scheduleSlotId = formData.get("scheduleSlotId")
    const missingSlot =
      scheduleSlotId === null || String(scheduleSlotId).trim() === ""
    return {
      success: false,
      fieldErrors,
      error: missingSlot
        ? "Elige un horario de la lista"
        : "Revisa los datos del formulario",
    }
  }

  const db = getDb()
  const alumna = await findUserByDisplayId(db, parsed.data.displayId)
  if (!alumna) {
    return { success: false, error: "No encontramos un usuario con ese ID" }
  }
  if (alumna.role !== "alumno") {
    return { success: false, error: "Ese ID no corresponde a un usuario" }
  }

  const bookingDow = getDayOfWeekFromDateStr(parsed.data.bookingDate)
  if (bookingDow === null || bookingDow === 0) {
    return { success: false, error: "No hay clases los domingos. Elige un día entre lunes y sábado." }
  }

  const [slotRow] = await db
    .select({ dayOfWeek: schema.scheduleSlot.dayOfWeek })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, parsed.data.scheduleSlotId))
    .limit(1)

  if (!slotRow || slotRow.dayOfWeek !== bookingDow) {
    return { success: false, error: "La fecha no coincide con el día de esa clase" }
  }

  const bookingDate = bookingDateAtNoon(parsed.data.bookingDate)

  try {
    const result = await createBookingForUser(db, {
      userId: alumna.id,
      scheduleSlotId: parsed.data.scheduleSlotId,
      bookingDate,
      birthdate: alumna.birthdate,
    })

    if (!result.ok) {
      return { success: false, error: result.message }
    }

    let chargeNote = ""
    if (!result.coveredByPlan) {
      const [slotInfo] = await db
        .select({
          className: schema.scheduleSlot.className,
          startTime: schema.scheduleSlot.startTime,
        })
        .from(schema.scheduleSlot)
        .where(eq(schema.scheduleSlot.id, parsed.data.scheduleSlotId))
        .limit(1)

      const charge = await chargeIndividualClass(db, {
        userId: alumna.id,
        userName: result.userName,
        className: slotInfo?.className ?? "Clase",
        bookingDate,
        startTime: slotInfo?.startTime ?? "",
      })
      if (charge.ok) {
        chargeNote = ` · Adeudo registrado: ${new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        }).format(charge.amount)}`
      }
    }

    revalidatePath("/dashboard/reservas")
    revalidatePath("/dashboard/pagos")
    revalidatePath("/dashboard")
    return {
      success: true,
      message: `Reserva confirmada para ${result.userName}${chargeNote}`,
      bookedDate: parsed.data.bookingDate,
    }
  } catch {
    return { success: false, error: "No se pudo guardar la reserva. Intenta de nuevo." }
  }
}

export async function checkBookingEligibilityAction(
  displayId: string,
  scheduleSlotId: string,
  bookingDateStr: string,
): Promise<{
  ok: boolean
  message?: string
  alumnaName?: string
  /** Importe que se cargará por no tener plan vigente. */
  willBeCharged?: number
}> {
  const db = getDb()
  const alumna = await findUserByDisplayId(db, displayId)
  if (!alumna) {
    return { ok: false, message: "ID no encontrado" }
  }

  const [slot] = await db
    .select({
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      classType: schema.scheduleSlot.classType,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, scheduleSlotId))
    .limit(1)

  if (!slot) {
    return { ok: false, message: "Horario no válido" }
  }

  const bookingDate = new Date(`${bookingDateStr}T12:00:00`)
  const disabledThisDate = await isSlotDisabledOnDate(db, scheduleSlotId, bookingDateStr)
  if (disabledThisDate) {
    return { ok: false, message: "Esta clase no se imparte esa semana." }
  }

  const check = validateBookingAgeForSlot(
    alumna.birthdate,
    slot.dayOfWeek,
    slot.startTime,
    bookingDate,
    slot.classType,
  )
  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  const alreadyBooked = await userHasBookingForSlot(
    db,
    alumna.id,
    scheduleSlotId,
    bookingDate,
  )
  if (alreadyBooked) {
    return {
      ok: false,
      message: "Esta persona ya tiene una reserva confirmada para esa clase en esa fecha",
    }
  }

  const capacityCheck = await checkSlotCapacityForBooking(db, scheduleSlotId, bookingDate)
  if (!capacityCheck.ok) {
    return { ok: false, message: capacityCheck.message }
  }

  const classEnd = classEndFromBooking(bookingDate, slot.startTime, slot.endTime)
  const policy = await loadStudioCancellationPolicy(db)
  const timingCheck = evaluateBookingAllowed(new Date(), classEnd, policy)
  if (!timingCheck.ok) {
    return { ok: false, message: timingCheck.message }
  }

  // Sin plan vigente igual se puede reservar: la clase queda como adeudo.
  const subCheck = await checkBookableSubscriptionForUser(db, alumna.id)
  if (!subCheck.ok) {
    const plan = await getIndividualClassPlan(db)
    return {
      ok: true,
      alumnaName: alumna.name,
      willBeCharged: plan?.priceMxn ?? undefined,
    }
  }

  return { ok: true, alumnaName: alumna.name }
}

export async function cancelBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session) {
    return { success: false, error: "No autorizado" }
  }

  const role = session.user.role ?? ""
  const isStaff = role === "admin" || role === "root" || role === "coach"
  const isAlumno = role === "alumno"
  if (!isStaff && !isAlumno) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const bypassPolicy = role === "root"
  const result = await cancelBookingById(db, id, {
    bypassPolicy,
    asAlumnoUserId: isAlumno ? session.user.id : undefined,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/historico")
  return { success: true }
}

export async function cancelBookingDirect(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session) {
    return { success: false, error: "No autorizado" }
  }

  const role = session.user.role ?? ""
  const isStaff = role === "admin" || role === "root" || role === "coach"
  const isAlumno = role === "alumno"
  if (!isStaff && !isAlumno) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const bypassPolicy = role === "root"
  const result = await cancelBookingById(db, id, {
    bypassPolicy,
    asAlumnoUserId: isAlumno ? session.user.id : undefined,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/historico")
  return { success: true }
}
