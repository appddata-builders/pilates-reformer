import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  DEFAULT_BOOKING_WINDOW_MINUTES,
  evaluateBookingTimeWindow,
} from "@/lib/booking-rules"
import {
  studioDateStrFromInstant,
  studioLocalDateTimeToInstant,
} from "@/lib/studio-month"

export type StudioCancellationPolicy = {
  cancelMinutes: number
  lateCancelPenalty: boolean
  bookingWindowMinutes: number
}

export type CancellationCheckResult =
  | { ok: true; restoreClass: boolean; late: boolean }
  | { ok: false; message: string }

export function classStartFromBooking(bookingDate: Date, startTime: string): Date {
  const dateStr = studioDateStrFromInstant(bookingDate)
  const parts = startTime.trim().split(":")
  const h = Number.parseInt(parts[0], 10)
  const m = Number.parseInt(parts[1] ?? "0", 10)
  const hour = Number.isNaN(h) ? 0 : h
  const minute = Number.isNaN(m) ? 0 : m
  return studioLocalDateTimeToInstant(dateStr, hour, minute)
}

export function classEndFromBooking(
  bookingDate: Date,
  startTime: string,
  endTime: string | null,
): Date {
  if (endTime != null && endTime.trim() !== "") {
    return classStartFromBooking(bookingDate, endTime)
  }
  const start = classStartFromBooking(bookingDate, startTime)
  return new Date(start.getTime() + 60 * 60 * 1000)
}

export const BOOKING_CUTOFF_MINUTES_BEFORE_END = DEFAULT_BOOKING_WINDOW_MINUTES

export function hoursUntilClass(now: Date, classStart: Date): number {
  return (classStart.getTime() - now.getTime()) / (1000 * 60 * 60)
}

export function minutesUntilClass(now: Date, classStart: Date): number {
  return (classStart.getTime() - now.getTime()) / (1000 * 60)
}

export function minimumCancelMinutes(policy: StudioCancellationPolicy): number {
  return policy.cancelMinutes
}

export function formatMinimumCancelNotice(cancelMinutes: number): string {
  if (cancelMinutes <= 0) return "0 minutos"
  if (cancelMinutes % 60 === 0 && cancelMinutes >= 60) {
    const hours = cancelMinutes / 60
    if (hours === 1) return "60 minutos"
    return `${hours} horas`
  }
  return `${cancelMinutes} minutos`
}

export function evaluateCancellation(
  now: Date,
  classStart: Date,
  policy: StudioCancellationPolicy,
): CancellationCheckResult {
  const minutesLeft = minutesUntilClass(now, classStart)
  const minMinutes = minimumCancelMinutes(policy)

  if (minutesLeft <= 0) {
    return {
      ok: false,
      message: "No se puede cancelar: la clase ya comenzó o ya pasó.",
    }
  }

  if (minutesLeft < minMinutes) {
    return {
      ok: false,
      message: `No se puede cancelar: debes hacerlo al menos ${formatMinimumCancelNotice(policy.cancelMinutes)} antes de la clase.`,
    }
  }

  return { ok: true, restoreClass: true, late: false }
}

/**
 * La alumna libera o cambia de hora una clase de su plan. Regla del reglamento:
 * sólo con la anticipación mínima de Configuración (6 horas = 360 minutos);
 * después la clase cuenta como utilizada y se queda descontada del paquete.
 * No importa la semana: con tiempo suficiente puede mover cualquier horario.
 */
export function evaluateStudentRelease(
  now: Date,
  classStart: Date,
  policy: Pick<StudioCancellationPolicy, "cancelMinutes">,
  action: "liberar" | "cambiar de horario" = "liberar",
): CancellationCheckResult {
  const minutesLeft = minutesUntilClass(now, classStart)
  if (minutesLeft <= 0) {
    return { ok: false, message: `La clase ya empezó; ya no se puede ${action}.` }
  }
  if (minutesLeft < policy.cancelMinutes) {
    return {
      ok: false,
      message: `Solo se pueden ${action} las clases con ${formatMinimumCancelNotice(policy.cancelMinutes)} de anticipación.`,
    }
  }
  return { ok: true, restoreClass: true, late: false }
}

export function minutesUntilClassEnd(now: Date, classEnd: Date): number {
  return (classEnd.getTime() - now.getTime()) / (1000 * 60)
}

export function evaluateBookingAllowed(
  now: Date,
  classEnd: Date,
  policy?: Pick<StudioCancellationPolicy, "bookingWindowMinutes"> | number,
): CancellationCheckResult {
  const windowMinutes =
    typeof policy === "number"
      ? policy
      : (policy?.bookingWindowMinutes ?? DEFAULT_BOOKING_WINDOW_MINUTES)

  const check = evaluateBookingTimeWindow({
    now,
    classEnd,
    bookingWindowMinutes: windowMinutes,
  })

  if (!check.ok) {
    return { ok: false, message: check.message }
  }

  return { ok: true, restoreClass: true, late: false }
}

export async function loadStudioCancellationPolicy(db: AnyDb): Promise<StudioCancellationPolicy> {
  const [row] = await db
    .select({
      cancelMinutes: schema.studioPolicy.cancelMinutes,
      cancelHours: schema.studioPolicy.cancelHours,
      lateCancelPenalty: schema.studioPolicy.lateCancelPenalty,
      bookingWindowMinutes: schema.studioPolicy.bookingWindowMinutes,
    })
    .from(schema.studioPolicy)
    .where(eq(schema.studioPolicy.id, "main"))
    .limit(1)

  const cancelMinutes =
    row?.cancelMinutes ??
    (row?.cancelHours != null ? row.cancelHours * 60 : 90)

  return {
    cancelMinutes,
    lateCancelPenalty: row?.lateCancelPenalty ?? true,
    bookingWindowMinutes: row?.bookingWindowMinutes ?? DEFAULT_BOOKING_WINDOW_MINUTES,
  }
}
