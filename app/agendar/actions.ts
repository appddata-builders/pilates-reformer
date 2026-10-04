"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  createBookingForUser,
  findBookingOnDate,
  findBookingForSlotOnDate,
  changeBookingSlotForUser,
  cancelBookingById,
  markBookingTakenForUser,
  canMarkTakenNow,
  checkBookableSubscriptionForUser,
  checkSlotCapacityForBooking,
} from "@/lib/booking-service"
import {
  chargeIndividualClass,
  consumeTrialClass,
  getIndividualClassPlan,
  hasUsedTrialClass,
  notifyStaffChargeNotRegistered,
} from "@/lib/class-charge"
import { startOfStudioWeek, validateBookingAgeForSlot } from "@/lib/booking-rules"
import {
  classEndFromBooking,
  evaluateBookingAllowed,
  loadStudioCancellationPolicy,
} from "@/lib/cancellation-policy"
import {
  type BookingSlotOption,
  dateRangeForDay,
  localTodayStr,
  resolveBookingDefaultDate,
  toLocalDateStr,
} from "@/lib/booking-slot-options"
import { isSlotDisabledOnDate, listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import {
  loadActivePlanSummary,
  loadSuggestedPlans,
  type ActivePlanSummary,
  type SuggestedPlan,
} from "@/lib/booking-plan-info"
import { loadLandingScheduleBoard } from "@/lib/site/schedule-board.server"
import { planWeeklyLimit } from "@/lib/plan-quota"
import { isSubscriptionCurrent, pickPrimarySubscription } from "@/lib/subscription-display"
import { getMondayOfWeek } from "@/lib/site/schedule"

// El modal los consume desde este mismo módulo.
export type { ActivePlanSummary, SuggestedPlan }

export type PublicBookingState = {
  success: boolean
  error?: string
  message?: string
  bookedDate?: string
  /** Importe que queda por regularizar cuando la clase no la cubrió un plan. */
  pendingAmount?: number
  /** La reserva se cubrió con la clase muestra, sin costo. */
  trialRedeemed?: boolean
  /** El lugar quedó apartado pero no se pudo calcular el adeudo. */
  chargeFailed?: boolean
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
  acceptIndividualClass: z.enum(["true", "false"]).optional(),
  /** Mueve la clase que ya tiene ese día a este horario, en vez de agendar otra. */
  changeSameDay: z.enum(["true", "false"]).optional(),
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
      }
    }
  | { ok: false; error: string }

async function getSessionAlumna(): Promise<SessionAlumna> {
  const session = await getSession()
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

/**
 * Reservas confirmadas de una fecha concreta, por horario. Se consulta cada vez
 * que la alumna cambia de fecha para que el cupo mostrado sea el actual y no el
 * que se cargó al abrir el modal.
 */
export async function loadDayAvailabilityAction(
  bookingDateStr: string,
): Promise<Record<string, number>> {
  const raw = bookingDateStr.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return {}

  const db = getDb()
  const { start, end } = dateRangeForDay(raw)
  const rows = await db
    .select({ slotId: schema.booking.scheduleSlotId })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )

  const porSlot: Record<string, number> = {}
  for (const row of rows) {
    porSlot[row.slotId] = (porSlot[row.slotId] ?? 0) + 1
  }
  return porSlot
}

export async function loadWeeklyBoardAction() {
  return loadLandingScheduleBoard()
}

/**
 * Lo que el tablero necesita saber de QUIEN mira: cuáles clases ya son suyas,
 * qué plan la respalda y cuántas lleva de cada semana. Va aparte del tablero
 * público para que la landing siga sirviéndose igual a quien no ha entrado.
 */
export type MyBookingContext = {
  loggedIn: boolean
  /** `slotId|YYYY-MM-DD` de mis reservas confirmadas. */
  myBookingKeys: string[]
  /** De las anteriores, las que ya marqué como tomadas: quedan quemadas. */
  takenBookingKeys: string[]
  /** Fechas donde ya tengo al menos una clase, para avisar del doble en un día. */
  myBookingDates: string[]
  /** Reservas mías por semana del estudio: lunes `YYYY-MM-DD` -> cuántas. */
  weeklyUsage: Record<string, number>
  plan: {
    name: string
    classesRemaining: number | null
    isUnlimited: boolean
    /** Tope de clases por semana del plan; null si no lo tiene. */
    weeklyLimit: number | null
    expired: boolean
  } | null
}

const EMPTY_CONTEXT: MyBookingContext = {
  loggedIn: false,
  myBookingKeys: [],
  takenBookingKeys: [],
  myBookingDates: [],
  weeklyUsage: {},
  plan: null,
}

export async function loadMyBookingContextAction(): Promise<MyBookingContext> {
  try {
    const sessionAlumna = await getSessionAlumna()
    if (!sessionAlumna.ok) return EMPTY_CONTEXT

    const db = getDb()
    const userId = sessionAlumna.alumna.id

    const monday = getMondayOfWeek(new Date(), 0)
    const rangeStart = new Date(monday)
    rangeStart.setDate(rangeStart.getDate() - 7 * 12)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = new Date(monday)
    rangeEnd.setDate(rangeEnd.getDate() + 7 * 12 + 6)
    rangeEnd.setHours(23, 59, 59, 999)

    const rows = await db
      .select({
        slotId: schema.booking.scheduleSlotId,
        bookingDate: schema.booking.bookingDate,
        takenAt: schema.booking.takenAt,
      })
      .from(schema.booking)
      .where(
        and(
          eq(schema.booking.userId, userId),
          eq(schema.booking.status, "confirmed"),
          gte(schema.booking.bookingDate, rangeStart),
          lte(schema.booking.bookingDate, rangeEnd),
        ),
      )

    const myBookingKeys: string[] = []
    const takenBookingKeys: string[] = []
    const dates = new Set<string>()
    const weeklyUsage: Record<string, number> = {}
    for (const row of rows) {
      const date =
        row.bookingDate instanceof Date
          ? row.bookingDate
          : new Date(row.bookingDate as unknown as number)
      const dateStr = toLocalDateStr(date)
      const key = `${row.slotId}|${dateStr}`
      myBookingKeys.push(key)
      if (row.takenAt != null) takenBookingKeys.push(key)
      dates.add(dateStr)
      const weekKey = toLocalDateStr(startOfStudioWeek(date))
      weeklyUsage[weekKey] = (weeklyUsage[weekKey] ?? 0) + 1
    }

    const subs = await db
      .select({
        id: schema.subscription.id,
        userId: schema.subscription.userId,
        status: schema.subscription.status,
        endDate: schema.subscription.endDate,
        classesRemaining: schema.subscription.classesRemaining,
        isUnlimited: schema.subscription.isUnlimited,
        planName: schema.plan.name,
        planType: schema.plan.planType,
        daysPerWeek: schema.plan.daysPerWeek,
      })
      .from(schema.subscription)
      .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
      .where(
        and(
          eq(schema.subscription.userId, userId),
          eq(schema.subscription.status, "active"),
        ),
      )

    const primary = pickPrimarySubscription(subs)
    const plan =
      primary == null
        ? null
        : {
            name: primary.planName,
            classesRemaining:
              primary.isUnlimited === true ? null : (primary.classesRemaining ?? 0),
            isUnlimited: primary.isUnlimited === true,
            weeklyLimit: planWeeklyLimit({
              planType: primary.planType,
              daysPerWeek: primary.daysPerWeek,
              isUnlimited: primary.isUnlimited === true,
            }),
            expired: !isSubscriptionCurrent(primary.status, primary.endDate),
          }

    return {
      loggedIn: true,
      myBookingKeys,
      takenBookingKeys,
      myBookingDates: Array.from(dates),
      weeklyUsage,
      plan,
    }
  } catch {
    // El tablero tiene que pintarse aunque esto falle: sin contexto se ve como
    // para visitante, no roto.
    return EMPTY_CONTEXT
  }
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
    acceptIndividualClass: formData.get("acceptIndividualClass") || undefined,
    changeSameDay: formData.get("changeSameDay") || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: "Revisa la fecha y el horario" }
  }

  const db = getDb()
  const alumna = sessionAlumna.alumna

  const bookingDate = new Date(`${parsed.data.bookingDate}T12:00:00`)

  // Cambio de hora: la reserva de ese día se muda de horario. No se cancela ni
  // se crea otra, así que el plan, el tope semanal y el adeudo no se mueven.
  if (parsed.data.changeSameDay === "true") {
    const previous = await findBookingOnDate(db, alumna.id, bookingDate)
    if (previous == null) {
      return { success: false, error: "Ya no tienes una clase ese día para cambiar" }
    }
    const moved = await changeBookingSlotForUser(db, {
      userId: alumna.id,
      bookingId: previous.id,
      toScheduleSlotId: parsed.data.scheduleSlotId,
      birthdate: alumna.birthdate,
    })
    if (!moved.ok) {
      return { success: false, error: moved.message }
    }

    revalidatePath("/dashboard/reservas")
    revalidatePath("/dashboard/pagos")

    return {
      success: true,
      message: `${alumna.name}, tu clase quedó confirmada.`,
      bookedDate: parsed.data.bookingDate,
    }
  }

  const acceptIndividualClass = parsed.data.acceptIndividualClass === "true"
  if (acceptIndividualClass && (await getIndividualClassPlan(db)) == null) {
    return { success: false, error: "No hay un precio de clase individual configurado. Contacta al estudio." }
  }

  const result = await createBookingForUser(db, {
    userId: alumna.id,
    scheduleSlotId: parsed.data.scheduleSlotId,
    bookingDate,
    birthdate: alumna.birthdate,
    enforceWeeklyLimit: !acceptIndividualClass,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  // Sin plan que la cubra: o redime su clase muestra, o queda como adeudo.
  let pendingAmount: number | undefined
  let trialRedeemed = false
  let chargeFailed = false
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
    const wantsTrial = !acceptIndividualClass && parsed.data.useTrialClass === "true"
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
        bookingId: result.bookingId,
      })
      if (charge.ok) {
        pendingAmount = charge.amount
      } else {
        // Sin plan individual configurado no hay precio que cobrar: el lugar
        // queda apartado, pero el estudio tiene que enterarse o la clase se va
        // gratis sin que nadie lo note.
        console.error("[agendar] No se pudo registrar el adeudo:", charge.error)
        chargeFailed = true
        await notifyStaffChargeNotRegistered(db, {
          userName: result.userName,
          className,
          bookingDate,
        })
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
    chargeFailed,
  }
}

/**
 * Libera una reserva propia desde el calendario. Aplica la política del estudio
 * igual que el panel: la ventana de cancelación y la regla de liberar sólo
 * semanas futuras siguen mandando, y el mensaje explica cuándo no se puede.
 */
export async function cancelOwnBookingAction(
  bookingId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const sessionAlumna = await getSessionAlumna()
  if (!sessionAlumna.ok) {
    return { success: false, error: sessionAlumna.error }
  }

  const id = bookingId.trim()
  if (id === "") return { success: false, error: "Reserva no válida" }

  const db = getDb()
  const result = await cancelBookingById(db, id, {
    asAlumnoUserId: sessionAlumna.alumna.id,
  })
  if (!result.ok) {
    return { success: false, error: result.message }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/pagos")

  return {
    success: true,
    message: result.restoredClass
      ? "Liberaste tu lugar y la clase regresó a tu plan."
      : "Liberaste tu lugar.",
  }
}

/** La alumna da por tomada su clase. No toca la asistencia oficial del coach. */
export async function markBookingTakenAction(
  bookingId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const sessionAlumna = await getSessionAlumna()
  if (!sessionAlumna.ok) {
    return { success: false, error: sessionAlumna.error }
  }

  const id = bookingId.trim()
  if (id === "") return { success: false, error: "Reserva no válida" }

  const result = await markBookingTakenForUser(getDb(), {
    userId: sessionAlumna.alumna.id,
    bookingId: id,
  })
  if (!result.ok) return { success: false, error: result.message }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/historico")

  return { success: true, message: "Marcaste esta clase como tomada." }
}

export type BookingEligibility = {
  ok: boolean
  message?: string
  alumnaName?: string
  /** Sin plan que la cubra: la clase se reserva igual y queda como adeudo. */
  willBeCharged?: { priceMxn: number; planName: string; weeklyLimitReached?: boolean }
  /** La cuenta aún no redime su clase muestra gratuita. */
  trialAvailable?: boolean
  /** Plan que va a cubrir la clase, para mostrar vigencia y clases restantes. */
  activePlan?: ActivePlanSummary
  /** Alternativas al cobro suelto cuando no hay plan vigente. */
  suggestedPlans?: SuggestedPlan[]
  /** Aviso del plan: clases de un periodo vencido que hay que cuadrar. */
  planWarning?: string
  /** Clase que ya tiene ese día; elegir otra hora la mueve en vez de duplicarla. */
  sameDayBooking?: { startTime: string; className: string }
  /** La celda elegida es su propia reserva: liberarla, moverla o darla por tomada. */
  ownBooking?: {
    bookingId: string
    startTime: string
    className: string
    /** Ya está quemada: no se mueve ni se libera. */
    taken: boolean
    /** La clase ya empezó, así que puede marcarla como tomada. */
    canMarkTaken: boolean
  }
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

  // Si la celda es su propia reserva, el modal ofrece liberarla en vez de dar
  // un mensaje sin salida.
  const ownBooking = await findBookingForSlotOnDate(
    db,
    alumna.id,
    scheduleSlotId,
    bookingDate,
  )
  if (ownBooking != null) {
    return {
      ok: false,
      alumnaName: alumna.name,
      ownBooking: {
        bookingId: ownBooking.id,
        startTime: ownBooking.startTime,
        className: ownBooking.className,
        taken: ownBooking.takenAt != null,
        canMarkTaken:
          ownBooking.takenAt == null &&
          canMarkTakenNow(bookingDate, ownBooking.startTime),
      },
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

  const previousSameDay = await findBookingOnDate(db, alumna.id, bookingDate)
  const sameDayBooking =
    previousSameDay == null
      ? undefined
      : { startTime: previousSameDay.startTime, className: previousSameDay.className }

  // Mover una reserva conserva su cobertura; no ofrece muestra ni otro cobro,
  // aunque el plan ya haya agotado sus clases al apartar la reserva original.
  if (sameDayBooking != null) {
    return { ok: true, alumnaName: alumna.name, sameDayBooking }
  }

  const subCheck = await checkBookableSubscriptionForUser(db, alumna.id, bookingDate)
  if (!subCheck.ok && subCheck.reason === "weekly_limit") {
    const individualPlan = await getIndividualClassPlan(db)
    if (individualPlan == null) {
      return { ok: false, message: "Alcanzaste el límite semanal de tu plan. Contacta al estudio para comprar una clase individual." }
    }
    return {
      ok: true,
      alumnaName: alumna.name,
      willBeCharged: {
        priceMxn: individualPlan.priceMxn,
        planName: individualPlan.name,
        weeklyLimitReached: true,
      },
      trialAvailable: false,
    }
  }

  if (!subCheck.ok) {
    const [plan, trialUsed, suggestedPlans] = await Promise.all([
      getIndividualClassPlan(db),
      hasUsedTrialClass(db, alumna.id),
      loadSuggestedPlans(db),
    ])
    return {
      ok: true,
      alumnaName: alumna.name,
      willBeCharged:
        plan != null ? { priceMxn: plan.priceMxn, planName: plan.name } : undefined,
      trialAvailable: !trialUsed,
      suggestedPlans,
      sameDayBooking,
    }
  }

  return {
    ok: true,
    alumnaName: alumna.name,
    activePlan: await loadActivePlanSummary(db, subCheck.subscriptionId),
    planWarning: subCheck.warning,
    sameDayBooking,
  }
}
