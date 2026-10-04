import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm"
import { dateRangeForDay, toLocalDateStr } from "@/lib/booking-slot-options"
import {
  evaluateStudentSelfRelease,
  startOfStudioWeek,
  validateBookingAgeForSlot,
} from "@/lib/booking-rules"
import {
  classEndFromBooking,
  classStartFromBooking,
  evaluateAlumnoSelfCancellation,
  evaluateCancellation,
  evaluateBookingAllowed,
  loadStudioCancellationPolicy,
} from "@/lib/cancellation-policy"
import { consumeClassFromSubscription, restoreClassToSubscription } from "@/lib/subscription-logic"
import {
  isSubscriptionCurrent,
  pickPrimarySubscription,
} from "@/lib/subscription-display"
import { isSlotDisabledOnDate } from "@/lib/slot-exceptions"
import { restoreTrialClass, voidPendingChargeForBooking } from "@/lib/class-charge"
import { planWeeklyLimit } from "@/lib/plan-quota"

export type CreateBookingResult =
  | {
      ok: true
      bookingId: string
      userName: string
      /** false cuando no había plan vigente y la clase queda por cobrar. */
      coveredByPlan: boolean
      /** Aviso del plan que la cubrió, p. ej. clases de un periodo vencido. */
      planWarning?: string
    }
  | { ok: false; message: string }

export async function userHasBookingForSlot(
  db: AnyDb,
  userId: string,
  scheduleSlotId: string,
  bookingDate: Date,
): Promise<boolean> {
  const dateStr = toLocalDateStr(bookingDate)
  const { start, end } = dateRangeForDay(dateStr)
  const [row] = await db
    .select({ id: schema.booking.id })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.userId, userId),
        eq(schema.booking.scheduleSlotId, scheduleSlotId),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )
    .limit(1)
  return row != null
}

export async function countConfirmedBookingsForSlotOnDate(
  db: AnyDb,
  scheduleSlotId: string,
  bookingDate: Date,
): Promise<number> {
  const dateStr = toLocalDateStr(bookingDate)
  const { start, end } = dateRangeForDay(dateStr)
  const rows = await db
    .select({ id: schema.booking.id })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.scheduleSlotId, scheduleSlotId),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )
  return rows.length
}

export async function checkSlotCapacityForBooking(
  db: AnyDb,
  scheduleSlotId: string,
  bookingDate: Date,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [slot] = await db
    .select({ capacity: schema.scheduleSlot.capacity })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, scheduleSlotId))
    .limit(1)

  if (!slot) {
    return { ok: false, message: "Horario no disponible" }
  }

  const confirmed = await countConfirmedBookingsForSlotOnDate(db, scheduleSlotId, bookingDate)
  if (confirmed >= slot.capacity) {
    return { ok: false, message: "Esta clase ya está llena. No hay lugares disponibles." }
  }

  return { ok: true }
}

export type BookableSubscriptionCheck =
  | {
      ok: true
      subscriptionId: string
      /** El plan cubre la clase, pero la alumna tiene que saber algo antes. */
      warning?: string
    }
  | {
      ok: false
      message: string
      reason?: "no_subscription" | "expired" | "no_classes" | "weekly_limit"
      subscriptionId?: string
    }

/**
 * Reservas confirmadas de la alumna dentro de la semana del estudio (lunes a
 * domingo) en la que cae `bookingDate`. Es lo que topa `daysPerWeek`.
 */
export async function countConfirmedBookingsInStudioWeek(
  db: AnyDb,
  userId: string,
  bookingDate: Date,
): Promise<number> {
  const weekStart = startOfStudioWeek(bookingDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const rows = await db
    .select({ id: schema.booking.id })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.userId, userId),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, weekStart),
        lt(schema.booking.bookingDate, weekEnd),
      ),
    )
  return rows.length
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
}

export async function checkBookableSubscriptionForUser(
  db: AnyDb,
  userId: string,
  bookingDate?: Date,
): Promise<BookableSubscriptionCheck> {
  const subs = await db
    .select({
      id: schema.subscription.id,
      userId: schema.subscription.userId,
      status: schema.subscription.status,
      endDate: schema.subscription.endDate,
      isUnlimited: schema.subscription.isUnlimited,
      classesRemaining: schema.subscription.classesRemaining,
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
  if (primary == null) {
    return {
      ok: false,
      message: "No tienes un plan o paquete vigente.",
      reason: "no_subscription",
    }
  }

  const remaining = primary.isUnlimited ? null : (primary.classesRemaining ?? 0)
  let warning: string | undefined

  if (!isSubscriptionCurrent(primary.status, primary.endDate)) {
    // Las clases que ya pagó no se pierden porque el periodo se venza: se dejan
    // tomar, pero avisando, porque el estudio tiene que cuadrarlas al renovar.
    if (remaining == null || remaining <= 0) {
      return {
        ok: false,
        message: "Tu plan ya venció. Renuévalo para que las clases se descuenten de él.",
        reason: "expired",
        subscriptionId: primary.id,
      }
    }
    const endDate =
      primary.endDate instanceof Date
        ? primary.endDate
        : new Date(primary.endDate as unknown as number)
    warning =
      `Tu plan venció el ${formatShortDate(endDate)} y te ${remaining === 1 ? "queda 1 clase" : `quedan ${remaining} clases`} sin tomar. ` +
      "Puedes usarlas, pero coordina con el estudio para que las tomen en cuenta al renovar."
  }

  if (remaining != null && remaining <= 0) {
    return {
      ok: false,
      message: "Ya usaste las clases de tu plan actual.",
      reason: "no_classes",
      subscriptionId: primary.id,
    }
  }

  // El tope semanal es lo que hace que una quincenal de 3 por semana no se
  // tome sus 6 clases en una sola semana.
  const weeklyLimit = planWeeklyLimit(primary)
  if (weeklyLimit != null && bookingDate != null) {
    const usedThisWeek = await countConfirmedBookingsInStudioWeek(db, userId, bookingDate)
    if (usedThisWeek >= weeklyLimit) {
      return {
        ok: false,
        message:
          `Tu plan incluye ${weeklyLimit} ${weeklyLimit === 1 ? "clase" : "clases"} por semana y ya alcanzaste ese límite entre reservas y clases tomadas. ` +
          "Para cualquier situación, acude con un administrador.",
        reason: "weekly_limit",
        subscriptionId: primary.id,
      }
    }
  }

  return { ok: true, subscriptionId: primary.id, warning }
}

export async function createBookingForUser(
  db: AnyDb,
  params: {
    userId: string
    scheduleSlotId: string
    bookingDate: Date
    birthdate?: string | null
    /** Exige plan vigente con clases. Por defecto se permite reservar y cobrar después. */
    requirePlan?: boolean
    /**
     * Corta la reserva cuando ya se usó el tope semanal del plan. Va en el
     * camino de la alumna; el mostrador se queda sin él para poder resolver el
     * caso a mano, que es a lo que la manda el mensaje.
     */
    enforceWeeklyLimit?: boolean
  },
): Promise<CreateBookingResult> {
  const [slot] = await db
    .select({
      id: schema.scheduleSlot.id,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      classType: schema.scheduleSlot.classType,
      isActive: schema.scheduleSlot.isActive,
      capacity: schema.scheduleSlot.capacity,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, params.scheduleSlotId))
    .limit(1)

  if (!slot || !slot.isActive) {
    return { ok: false, message: "Horario no disponible" }
  }

  const bookingDow = params.bookingDate.getDay()
  if (bookingDow === 0 || slot.dayOfWeek !== bookingDow) {
    return { ok: false, message: "La fecha no coincide con el día de esa clase" }
  }

  const disabledThisDate = await isSlotDisabledOnDate(db, slot.id, params.bookingDate)
  if (disabledThisDate) {
    return { ok: false, message: "Esta clase no se imparte esa semana." }
  }

  const ageCheck = validateBookingAgeForSlot(
    params.birthdate,
    slot.dayOfWeek,
    slot.startTime,
    params.bookingDate,
    slot.classType,
  )
  if (!ageCheck.ok) {
    return { ok: false, message: ageCheck.message }
  }

  const alreadyBooked = await userHasBookingForSlot(
    db,
    params.userId,
    params.scheduleSlotId,
    params.bookingDate,
  )
  if (alreadyBooked) {
    return {
      ok: false,
      message: "Esta persona ya tiene una reserva confirmada para esa clase en esa fecha",
    }
  }

  const confirmed = await countConfirmedBookingsForSlotOnDate(
    db,
    params.scheduleSlotId,
    params.bookingDate,
  )
  if (confirmed >= slot.capacity) {
    return { ok: false, message: "Esta clase ya está llena. No hay lugares disponibles." }
  }

  const classEnd = classEndFromBooking(params.bookingDate, slot.startTime, slot.endTime)
  const policy = await loadStudioCancellationPolicy(db)
  const bookingCheck = evaluateBookingAllowed(new Date(), classEnd, policy)
  if (!bookingCheck.ok) {
    return { ok: false, message: bookingCheck.message }
  }

  // El plan ya no es requisito para reservar: si no lo cubre, la clase se cobra
  // después y el estudio regulariza el pago.
  const subCheck = await checkBookableSubscriptionForUser(
    db,
    params.userId,
    params.bookingDate,
  )
  const subscriptionId = subCheck.ok ? subCheck.subscriptionId : null

  if (
    !subCheck.ok &&
    subCheck.reason === "weekly_limit" &&
    params.enforceWeeklyLimit === true
  ) {
    return { ok: false, message: subCheck.message }
  }

  if (subscriptionId == null && params.requirePlan === true) {
    return { ok: false, message: subCheck.ok ? "" : subCheck.message }
  }

  const bookingId = crypto.randomUUID()
  await db.insert(schema.booking).values({
    id: bookingId,
    userId: params.userId,
    scheduleSlotId: params.scheduleSlotId,
    bookingDate: params.bookingDate,
    status: "confirmed",
  })

  if (subscriptionId != null) {
    await consumeClassFromSubscription(subscriptionId)
  }

  const [user] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, params.userId))
    .limit(1)

  return {
    ok: true,
    bookingId,
    userName: user?.name ?? "Usuario",
    coveredByPlan: subscriptionId != null,
    planWarning: subCheck.ok ? subCheck.warning : undefined,
  }
}

export type ChangeBookingSlotResult =
  | { ok: true; fromStartTime: string; toStartTime: string; className: string }
  | { ok: false; message: string }

/**
 * Mueve una reserva a otro horario del mismo día.
 *
 * Es un UPDATE del `scheduleSlotId`, no un cancelar-y-reservar: la clase ya
 * está consumida del plan y el día no cambia, así que mover el lugar no altera
 * el cupo del plan, ni el tope semanal, ni el adeudo que la reserva pudiera
 * tener colgando. Cancelar y recrear haría los tres movimientos para acabar en
 * el mismo sitio, con el riesgo de quedarse a medias si el segundo paso falla.
 */
export async function changeBookingSlotForUser(
  db: AnyDb,
  params: {
    userId: string
    bookingId: string
    toScheduleSlotId: string
    birthdate?: string | null
  },
): Promise<ChangeBookingSlotResult> {
  const [current] = await db
    .select({
      id: schema.booking.id,
      userId: schema.booking.userId,
      status: schema.booking.status,
      bookingDate: schema.booking.bookingDate,
      slotId: schema.booking.scheduleSlotId,
      startTime: schema.scheduleSlot.startTime,
      takenAt: schema.booking.takenAt,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(eq(schema.booking.id, params.bookingId))
    .limit(1)

  if (current == null) return { ok: false, message: "Reserva no encontrada" }
  if (current.userId !== params.userId) {
    return { ok: false, message: "No puedes mover la reserva de otra persona" }
  }
  if (current.status !== "confirmed") {
    return { ok: false, message: "Esta reserva ya no está confirmada" }
  }
  if (current.slotId === params.toScheduleSlotId) {
    return { ok: false, message: "Esa ya es la hora de tu reserva" }
  }
  if (current.takenAt != null) {
    return { ok: false, message: "Ya marcaste esta clase como tomada; no se puede cambiar" }
  }

  const bookingDate =
    current.bookingDate instanceof Date
      ? current.bookingDate
      : new Date(current.bookingDate as unknown as number)

  const [target] = await db
    .select({
      id: schema.scheduleSlot.id,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      className: schema.scheduleSlot.className,
      classType: schema.scheduleSlot.classType,
      isActive: schema.scheduleSlot.isActive,
      capacity: schema.scheduleSlot.capacity,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, params.toScheduleSlotId))
    .limit(1)

  if (target == null || !target.isActive) {
    return { ok: false, message: "Horario no disponible" }
  }
  if (target.dayOfWeek !== bookingDate.getDay()) {
    return { ok: false, message: "Sólo puedes cambiar a otro horario del mismo día" }
  }

  if (await isSlotDisabledOnDate(db, target.id, bookingDate)) {
    return { ok: false, message: "Esta clase no se imparte esa semana." }
  }

  const ageCheck = validateBookingAgeForSlot(
    params.birthdate,
    target.dayOfWeek,
    target.startTime,
    bookingDate,
    target.classType,
  )
  if (!ageCheck.ok) return { ok: false, message: ageCheck.message }

  if (await userHasBookingForSlot(db, params.userId, target.id, bookingDate)) {
    return { ok: false, message: "Ya tienes una reserva confirmada en ese horario" }
  }

  const confirmed = await countConfirmedBookingsForSlotOnDate(db, target.id, bookingDate)
  if (confirmed >= target.capacity) {
    return { ok: false, message: "Esta clase ya está llena. No hay lugares disponibles." }
  }

  const policy = await loadStudioCancellationPolicy(db)
  const now = new Date()

  // La clase a la que se muda tiene que seguir siendo reservable...
  const targetEnd = classEndFromBooking(bookingDate, target.startTime, target.endTime)
  const targetCheck = evaluateBookingAllowed(now, targetEnd, policy)
  if (!targetCheck.ok) return { ok: false, message: targetCheck.message }

  // ...y la que deja tiene que seguir dentro de la ventana para soltarse. Se
  // salta la regla de "sólo semanas futuras" a propósito: cambiar de hora no
  // libera un lugar neto, sólo lo mueve dentro del mismo día.
  const currentStart = classStartFromBooking(bookingDate, current.startTime)
  const releaseCheck = evaluateCancellation(now, currentStart, policy)
  if (!releaseCheck.ok) return { ok: false, message: releaseCheck.message }

  await db
    .update(schema.booking)
    .set({ scheduleSlotId: target.id })
    .where(eq(schema.booking.id, params.bookingId))

  return {
    ok: true,
    fromStartTime: current.startTime,
    toStartTime: target.startTime,
    className: target.className,
  }
}

/** La reserva confirmada de la alumna en ese horario y fecha, si existe. */
export async function findBookingForSlotOnDate(
  db: AnyDb,
  userId: string,
  scheduleSlotId: string,
  bookingDate: Date,
): Promise<{
  id: string
  startTime: string
  className: string
  takenAt: Date | null
} | null> {
  const { start, end } = dateRangeForDay(toLocalDateStr(bookingDate))
  const [row] = await db
    .select({
      id: schema.booking.id,
      startTime: schema.scheduleSlot.startTime,
      className: schema.scheduleSlot.className,
      takenAt: schema.booking.takenAt,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(
      and(
        eq(schema.booking.userId, userId),
        eq(schema.booking.scheduleSlotId, scheduleSlotId),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )
    .limit(1)
  if (row == null) return null
  return {
    ...row,
    takenAt:
      row.takenAt == null
        ? null
        : row.takenAt instanceof Date
          ? row.takenAt
          : new Date(row.takenAt as unknown as number),
  }
}

/** Reserva pendiente de tomar que aún puede cambiarse de horario ese día. */
export async function findBookingOnDate(
  db: AnyDb,
  userId: string,
  bookingDate: Date,
): Promise<{ id: string; slotId: string; startTime: string; className: string } | null> {
  const { start, end } = dateRangeForDay(toLocalDateStr(bookingDate))
  const rows = await db
    .select({
      id: schema.booking.id,
      slotId: schema.booking.scheduleSlotId,
      startTime: schema.scheduleSlot.startTime,
      className: schema.scheduleSlot.className,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(
      and(
        eq(schema.booking.userId, userId),
        eq(schema.booking.status, "confirmed"),
        isNull(schema.booking.takenAt),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )
    .orderBy(asc(schema.scheduleSlot.startTime))
  return rows[0] ?? null
}

export type MarkTakenResult =
  | { ok: true; className: string; startTime: string }
  | { ok: false; message: string }

/**
 * La alumna marca su clase como tomada desde el calendario. Es su propio
 * registro: NO toca `attended`, que sigue siendo la asistencia que confirma el
 * coach y la que leen Reportes e Histórico.
 *
 * Sólo se puede desde que la clase empieza; marcar una que aún no ocurre
 * dejaría un registro falso y bloquearía el cambio de hora sin motivo.
 */
export async function markBookingTakenForUser(
  db: AnyDb,
  params: { userId: string; bookingId: string; now?: Date },
): Promise<MarkTakenResult> {
  const [row] = await db
    .select({
      id: schema.booking.id,
      userId: schema.booking.userId,
      status: schema.booking.status,
      bookingDate: schema.booking.bookingDate,
      slotId: schema.booking.scheduleSlotId,
      takenAt: schema.booking.takenAt,
      startTime: schema.scheduleSlot.startTime,
      className: schema.scheduleSlot.className,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(eq(schema.booking.id, params.bookingId))
    .limit(1)

  if (row == null) return { ok: false, message: "Reserva no encontrada" }
  if (row.userId !== params.userId) {
    return { ok: false, message: "No puedes marcar la reserva de otra persona" }
  }
  if (row.status !== "confirmed") {
    return { ok: false, message: "Esta reserva ya no está confirmada" }
  }
  if (row.takenAt != null) {
    return { ok: false, message: "Esta clase ya está marcada como tomada" }
  }

  const bookingDate =
    row.bookingDate instanceof Date
      ? row.bookingDate
      : new Date(row.bookingDate as unknown as number)
  const now = params.now ?? new Date()
  if (now < classStartFromBooking(bookingDate, row.startTime)) {
    return { ok: false, message: "Podrás marcarla cuando empiece la clase" }
  }

  const marked = await db
    .update(schema.booking)
    .set({ takenAt: now })
    .where(and(
      eq(schema.booking.id, params.bookingId),
      eq(schema.booking.status, "confirmed"),
      isNull(schema.booking.takenAt),
      eq(schema.booking.scheduleSlotId, row.slotId),
    ))
    .returning({ id: schema.booking.id })

  if (marked.length === 0) return { ok: false, message: "La reserva cambió. Actualiza el calendario." }

  return { ok: true, className: row.className, startTime: row.startTime }
}

/** Desde cuándo se puede marcar como tomada: la hora de inicio de la clase. */
export function canMarkTakenNow(
  bookingDate: Date,
  startTime: string,
  now: Date = new Date(),
): boolean {
  return now >= classStartFromBooking(bookingDate, startTime)
}

export type CancelBookingResult =
  | {
      ok: true
      late: boolean
      restoredClass: boolean
      /** La reserva era la clase muestra y la cortesía quedó disponible otra vez. */
      restoredTrial: boolean
      /** Adeudo pendiente que se anuló junto con la reserva; 0 si no había. */
      voidedChargeAmount: number
    }
  | { ok: false; message: string }

export async function cancelBookingById(
  db: AnyDb,
  bookingId: string,
  options?: { bypassPolicy?: boolean; asAlumnoUserId?: string },
): Promise<CancelBookingResult> {
  const [booking] = await db
    .select({
      id: schema.booking.id,
      userId: schema.booking.userId,
      status: schema.booking.status,
      bookingDate: schema.booking.bookingDate,
      startTime: schema.scheduleSlot.startTime,
      takenAt: schema.booking.takenAt,
      trialClass: schema.booking.trialClass,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(eq(schema.booking.id, bookingId))
    .limit(1)

  if (!booking) {
    return { ok: false, message: "Reserva no encontrada" }
  }

  if (booking.status !== "confirmed") {
    return { ok: false, message: "Esta reserva ya no está confirmada" }
  }

  if (booking.takenAt != null) {
    return { ok: false, message: "Ya marcaste esta clase como tomada; no se puede liberar" }
  }

  if (options?.asAlumnoUserId != null && booking.userId !== options.asAlumnoUserId) {
    return { ok: false, message: "No puedes liberar la reserva de otra persona" }
  }

  const bookingDate =
    booking.bookingDate instanceof Date
      ? booking.bookingDate
      : new Date(booking.bookingDate as unknown as number)

  const classStart = classStartFromBooking(bookingDate, booking.startTime)

  // Clase muestra o clase individual (con cobro propio): no salió de un plan.
  const [individualCharge] = await db
    .select({ id: schema.payment.id })
    .from(schema.payment)
    .where(and(eq(schema.payment.bookingId, bookingId), isNull(schema.payment.subscriptionId)))
    .limit(1)
  const outsidePlan = booking.trialClass === true || individualCharge != null

  let restoreClass = false
  let late = false

  if (!options?.bypassPolicy) {
    const policy = await loadStudioCancellationPolicy(db)
    const now = new Date()

    if (options?.asAlumnoUserId != null) {
      const subs = await db
        .select({
          id: schema.subscription.id,
          userId: schema.subscription.userId,
          status: schema.subscription.status,
          startDate: schema.subscription.startDate,
          endDate: schema.subscription.endDate,
        })
        .from(schema.subscription)
        .where(
          and(
            eq(schema.subscription.userId, booking.userId),
            eq(schema.subscription.status, "active"),
          ),
        )

      const primary = pickPrimarySubscription(subs)

      // Sin plan de por medio una clase sí se puede cancelar: la única regla es
      // que todavía no empiece. Las del plan siguen las reglas del plan.
      if (outsidePlan || primary == null) {
        if (now >= classStart) {
          return { ok: false, message: "La clase ya empezó; ya no se puede cancelar." }
        }
      } else {
        const selfRelease = evaluateStudentSelfRelease({
          bookingDate,
          subscriptionStatus: primary.status,
          subscriptionStartDate: primary.startDate,
          subscriptionEndDate: primary.endDate,
          now,
        })
        const check = evaluateAlumnoSelfCancellation(now, classStart, policy, selfRelease)
        if (!check.ok) {
          return { ok: false, message: check.message }
        }
        restoreClass = check.restoreClass
        late = check.late
      }
    } else {
      const check = evaluateCancellation(now, classStart, policy)
      if (!check.ok) {
        return { ok: false, message: check.message }
      }
      restoreClass = check.restoreClass
      late = check.late
    }
  } else {
    restoreClass = true
  }

  const cancelled = await db
    .update(schema.booking)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(
      eq(schema.booking.id, bookingId),
      eq(schema.booking.status, "confirmed"),
      isNull(schema.booking.takenAt),
    ))
    .returning({ id: schema.booking.id })

  if (cancelled.length === 0) return { ok: false, message: "La reserva cambió. Actualiza el calendario." }

  // Una clase muestra o individual nunca consumió saldo del plan: cancelarla
  // no debe regalar una clase. Conservamos esta distinción incluso si ya fue
  // pagada.
  if (outsidePlan) restoreClass = false

  // La clase que no cubrió un plan dejó un adeudo abierto: al liberar el lugar
  // ese cobro tiene que morir con la reserva, o la alumna arrastra una deuda
  // por una clase que ya no va a tomar.
  const [owner] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, booking.userId))
    .limit(1)

  const voided = await voidPendingChargeForBooking(db, {
    bookingId,
    userId: booking.userId,
    userName: owner?.name ?? "Usuario",
  })

  // La clase muestra regresa para usarla en otra fecha.
  if (booking.trialClass === true) {
    await restoreTrialClass(db, { userId: booking.userId, userName: owner?.name ?? "Usuario" })
  }

  if (restoreClass) {
    const [activeSub] = await db
      .select({ id: schema.subscription.id })
      .from(schema.subscription)
      .where(
        and(
          eq(schema.subscription.userId, booking.userId),
          eq(schema.subscription.status, "active"),
        ),
      )
      .limit(1)

    if (activeSub) {
      await restoreClassToSubscription(activeSub.id)
    }
  }

  return {
    ok: true,
    late,
    restoredClass: restoreClass,
    restoredTrial: booking.trialClass === true,
    voidedChargeAmount: voided.voidedAmount,
  }
}
