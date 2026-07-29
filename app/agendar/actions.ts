"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  createBookingForUser,
  userHasBookingForSlot,
  checkBookableSubscriptionForUser,
  checkSlotCapacityForBooking,
} from "@/lib/booking-service"
import {
  chargeIndividualClass,
  consumeTrialClass,
  getIndividualClassPlan,
  hasUsedTrialClass,
} from "@/lib/class-charge"
import { validateBookingAgeForSlot } from "@/lib/booking-rules"
import {
  classEndFromBooking,
  evaluateBookingAllowed,
  loadStudioCancellationPolicy,
} from "@/lib/cancellation-policy"
import {
  type BookingSlotOption,
  localTodayStr,
  resolveBookingDefaultDate,
  toLocalDateStr,
} from "@/lib/booking-slot-options"
import { isSlotDisabledOnDate, listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { loadLandingScheduleBoard } from "@/lib/site/schedule-board.server"
import { getMondayOfWeek } from "@/lib/site/schedule"

export type PublicBookingState = {
  success: boolean
  error?: string
  message?: string
  bookedDate?: string
  /** Importe que queda por regularizar cuando la clase no la cubrió un plan. */
  pendingAmount?: number
  /** La reserva se cubrió con la clase muestra, sin costo. */
  trialRedeemed?: boolean
}

export type AgendarData = {
  slots: BookingSlotOption[]
  defaultDate: string
  todayStr: string
  disabledSlotDateKeys: string[]
  /** Reservas confirmadas por `slotId|YYYY-MM-DD`; sólo las que tienen alguna. */
  bookedBySlotDate: Record<string, number>
  individualClassPrice: number | null
}

const publicBookingSchema = z.object({
  scheduleSlotId: z.string().min(1),
  bookingDate: z.string().min(1),
  useTrialClass: z.enum(["true", "false"]).optional(),
})

type SessionAlumna =
  | {
      ok: true
      alumna: {
        id: string
        name: string
        birthdate: string | null
        role: string | null
        enabled: boolean | null
        displayId: string | null
      }
    }
  | { ok: false; error: string }

async function getSessionAlumna(): Promise<SessionAlumna> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (session == null) {
    return { ok: false, error: "Debes iniciar sesión para reservar" }
  }

  const db = getDb()
  const [alumna] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      birthdate: schema.user.birthdate,
      role: schema.user.role,
      enabled: schema.user.enabled,
      displayId: schema.user.displayId,
    })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id))
    .limit(1)

  if (alumna == null) {
    return { ok: false, error: "Usuario no encontrado" }
  }
  if (alumna.enabled === false) {
    return { ok: false, error: "Tu cuenta está inhabilitada. Contacta al estudio." }
  }
  if (alumna.role !== "alumno") {
    return { ok: false, error: "Esta cuenta no puede reservar clases desde aquí" }
  }
  if (alumna.displayId == null || alumna.displayId.trim() === "") {
    return { ok: false, error: "Tu cuenta aún no está activa. Contacta al estudio." }
  }

  return { ok: true, alumna }
}

export async function loadAgendarDataAction(): Promise<AgendarData> {
  const db = getDb()
  const rows = await db
    .select({
      id: schema.scheduleSlot.id,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      className: schema.scheduleSlot.className,
      capacity: schema.scheduleSlot.capacity,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.isActive, true))
    .orderBy(asc(schema.scheduleSlot.dayOfWeek), asc(schema.scheduleSlot.startTime))

  const slots: BookingSlotOption[] = rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    className: row.className,
    capacity: row.capacity,
  }))

  const todayStr = localTodayStr()
  const defaultDate = resolveBookingDefaultDate(todayStr, slots)

  const monday = getMondayOfWeek(new Date(), 0)
  const rangeStart = new Date(monday)
  rangeStart.setDate(rangeStart.getDate() - 7)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(monday)
  rangeEnd.setDate(rangeEnd.getDate() + 7 * 8 + 6)
  rangeEnd.setHours(23, 59, 59, 999)
  const disabledSlotDateKeys = Array.from(
    await listDisabledSlotDateKeys(db, rangeStart, rangeEnd),
  )

  const bookingRows = await db
    .select({
      slotId: schema.booking.scheduleSlotId,
      bookingDate: schema.booking.bookingDate,
    })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, rangeStart),
        lte(schema.booking.bookingDate, rangeEnd),
      ),
    )

  const bookedBySlotDate: Record<string, number> = {}
  for (const row of bookingRows) {
    const d =
      row.bookingDate instanceof Date
        ? row.bookingDate
        : new Date(row.bookingDate as unknown as number)
    const key = `${row.slotId}|${toLocalDateStr(d)}`
    bookedBySlotDate[key] = (bookedBySlotDate[key] ?? 0) + 1
  }

  const individualPlan = await getIndividualClassPlan(db)

  return {
    slots,
    defaultDate,
    todayStr,
    disabledSlotDateKeys,
    bookedBySlotDate,
    individualClassPrice: individualPlan?.priceMxn ?? null,
  }
}

export async function loadWeeklyBoardAction() {
  return loadLandingScheduleBoard()
}

export async function createPublicBookingAction(
  _prev: PublicBookingState,
  formData: FormData,
): Promise<PublicBookingState> {
  const sessionAlumna = await getSessionAlumna()
  if (!sessionAlumna.ok) {
    return { success: false, error: sessionAlumna.error }
  }

  const parsed = publicBookingSchema.safeParse({
    scheduleSlotId: formData.get("scheduleSlotId"),
    bookingDate: formData.get("bookingDate"),
    useTrialClass: formData.get("useTrialClass") || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: "Revisa la fecha y el horario" }
  }

  const db = getDb()
  const alumna = sessionAlumna.alumna

  const bookingDate = new Date(`${parsed.data.bookingDate}T12:00:00`)
  const result = await createBookingForUser(db, {
    userId: alumna.id,
    scheduleSlotId: parsed.data.scheduleSlotId,
    bookingDate,
    birthdate: alumna.birthdate,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  // Sin plan que la cubra: o redime su clase muestra, o queda como adeudo.
  let pendingAmount: number | undefined
  let trialRedeemed = false
  if (!result.coveredByPlan) {
    const [slot] = await db
      .select({
        className: schema.scheduleSlot.className,
        startTime: schema.scheduleSlot.startTime,
      })
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.id, parsed.data.scheduleSlotId))
      .limit(1)

    const className = slot?.className ?? "Clase"
    const wantsTrial = parsed.data.useTrialClass === "true"
    const trial = wantsTrial
      ? await consumeTrialClass(db, {
          userId: alumna.id,
          userName: result.userName,
          className,
          bookingDate,
        })
      : null

    if (trial?.ok === true) {
      trialRedeemed = true
    } else {
      if (trial != null) {
        console.warn("[agendar] Clase muestra no aplicada, se cobra:", trial.error)
      }
      const charge = await chargeIndividualClass(db, {
        userId: alumna.id,
        userName: result.userName,
        className,
        bookingDate,
        startTime: slot?.startTime ?? "",
      })
      if (charge.ok) {
        pendingAmount = charge.amount
      } else {
        console.error("[agendar] No se pudo registrar el adeudo:", charge.error)
      }
    }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/pagos")

  return {
    success: true,
    message: `${result.userName}, tu clase quedó confirmada.`,
    bookedDate: parsed.data.bookingDate,
    pendingAmount,
    trialRedeemed,
  }
}

export type BookingEligibility = {
  ok: boolean
  message?: string
  alumnaName?: string
  /** Sin plan que la cubra: la clase se reserva igual y queda como adeudo. */
  willBeCharged?: { priceMxn: number; planName: string }
  /** La cuenta aún no redime su clase muestra gratuita. */
  trialAvailable?: boolean
}

export async function checkPublicBookingEligibility(
  scheduleSlotId: string,
  bookingDateStr: string,
): Promise<BookingEligibility> {
  const sessionAlumna = await getSessionAlumna()
  if (!sessionAlumna.ok) {
    return { ok: false, message: sessionAlumna.error }
  }

  const alumna = sessionAlumna.alumna
  const db = getDb()

  const [slot] = await db
    .select({
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      className: schema.scheduleSlot.className,
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
      message: "Ya tienes una reserva confirmada para esa clase en esa fecha",
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

  // Sin plan vigente también puede reservar: la clase se le carga a la cuenta
  // y el estudio regulariza el pago.
  const subCheck = await checkBookableSubscriptionForUser(db, alumna.id)
  if (!subCheck.ok) {
    const [plan, trialUsed] = await Promise.all([
      getIndividualClassPlan(db),
      hasUsedTrialClass(db, alumna.id),
    ])
    return {
      ok: true,
      alumnaName: alumna.name,
      willBeCharged:
        plan != null ? { priceMxn: plan.priceMxn, planName: plan.name } : undefined,
      trialAvailable: !trialUsed,
    }
  }

  return { ok: true, alumnaName: alumna.name }
}
