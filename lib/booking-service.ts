import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, gte, lte } from "drizzle-orm"
import { dateRangeForDay, toLocalDateStr } from "@/lib/booking-slot-options"
import {
  evaluateStudentSelfRelease,
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

export type CreateBookingResult =
  | {
      ok: true
      bookingId: string
      userName: string
      /** false cuando no había plan vigente y la clase queda por cobrar. */
      coveredByPlan: boolean
    }
  | { ok: false; message: string }

export async function findUserByDisplayId(db: AnyDb, displayIdRaw: string) {
  const displayId = displayIdRaw.trim().toUpperCase()
  if (!displayId) return null
  const [row] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      birthdate: schema.user.birthdate,
      role: schema.user.role,
    })
    .from(schema.user)
    .where(eq(schema.user.displayId, displayId))
    .limit(1)
  return row ?? null
}

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
  | { ok: true; subscriptionId: string }
  | {
      ok: false
      message: string
      reason?: "no_subscription" | "expired" | "no_classes"
      subscriptionId?: string
    }

export async function checkBookableSubscriptionForUser(
  db: AnyDb,
  userId: string,
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

  if (!isSubscriptionCurrent(primary.status, primary.endDate)) {
    return {
      ok: false,
      message: "Tu plan ya venció. Renuévalo para que las clases se descuenten de él.",
      reason: "expired",
    }
  }

  if (primary.isUnlimited) {
    return { ok: true, subscriptionId: primary.id }
  }

  if (primary.planType === "monthly") {
    return { ok: true, subscriptionId: primary.id }
  }

  if ((primary.classesRemaining ?? 0) > 0) {
    return { ok: true, subscriptionId: primary.id }
  }

  return {
    ok: false,
    message: "Ya usaste las clases de tu paquete actual.",
    reason: "no_classes",
    subscriptionId: primary.id,
  }
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
  const subCheck = await checkBookableSubscriptionForUser(db, params.userId)
  const subscriptionId = subCheck.ok ? subCheck.subscriptionId : null

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
  }
}

export type CancelBookingResult =
  | { ok: true; late: boolean; restoredClass: boolean }
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

  if (options?.asAlumnoUserId != null && booking.userId !== options.asAlumnoUserId) {
    return { ok: false, message: "No puedes liberar la reserva de otra persona" }
  }

  const bookingDate =
    booking.bookingDate instanceof Date
      ? booking.bookingDate
      : new Date(booking.bookingDate as unknown as number)

  const classStart = classStartFromBooking(bookingDate, booking.startTime)

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
      const selfRelease = evaluateStudentSelfRelease({
        bookingDate,
        subscriptionStatus: primary?.status ?? "inactive",
        subscriptionStartDate: primary?.startDate ?? new Date(0),
        subscriptionEndDate: primary?.endDate ?? new Date(0),
        now,
      })
      const check = evaluateAlumnoSelfCancellation(now, classStart, policy, selfRelease)
      if (!check.ok) {
        return { ok: false, message: check.message }
      }
      restoreClass = check.restoreClass
      late = check.late
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

  await db
    .update(schema.booking)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(schema.booking.id, bookingId))

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

  return { ok: true, late, restoredClass: restoreClass }
}
