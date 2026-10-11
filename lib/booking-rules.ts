import { isAtLeastAge } from "@/lib/birthdate"

export const SENIOR_CLASS_START_TIME = "11:00"
export const SENIOR_MIN_AGE = 60

export function startOfStudioWeek(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(12, 0, 0, 0)
  const day = copy.getDay()
  const diffFromMonday = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diffFromMonday)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function normalizeStartTime(startTime: string): string {
  const parts = startTime.trim().split(":")
  const h = parts[0]?.padStart(2, "0") ?? "00"
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

export function isElevenAmSlot(startTime: string): boolean {
  return normalizeStartTime(startTime) === SENIOR_CLASS_START_TIME
}

export function isSeniorOnlyElevenAmSlot(dayOfWeek: number, startTime: string): boolean {
  if (!isElevenAmSlot(startTime)) return false
  return dayOfWeek === 2 || dayOfWeek === 5
}

export function isOpenElevenAmSlot(dayOfWeek: number, startTime: string): boolean {
  if (!isElevenAmSlot(startTime)) return false
  return dayOfWeek === 6
}

export type BookingAgeCheckResult =
  | { ok: true }
  | { ok: false; message: string }

export function validateBookingAgeForSlot(
  birthdate: string | null | undefined,
  dayOfWeek: number,
  startTime: string,
  bookingDate: Date,
  classType?: string | null,
): BookingAgeCheckResult {
  if (classType === "mayores_60") {
    if (!birthdate) {
      return {
        ok: false,
        message:
          "Para esta clase especial necesitamos tu fecha de cumpleaños registrada.",
      }
    }
    if (!isAtLeastAge(birthdate, SENIOR_MIN_AGE, bookingDate)) {
      return {
        ok: false,
        message: "Esta clase es especial para personas de 60 años o más.",
      }
    }
    return { ok: true }
  }

  if (!isElevenAmSlot(startTime)) {
    return { ok: true }
  }
  if (isOpenElevenAmSlot(dayOfWeek, startTime)) {
    return { ok: true }
  }
  if (isSeniorOnlyElevenAmSlot(dayOfWeek, startTime)) {
    if (!birthdate) {
      return {
        ok: false,
        message:
          "Para la clase de las 11:00 AM (martes o viernes) necesitamos tu fecha de cumpleaños registrada.",
      }
    }
    if (!isAtLeastAge(birthdate, SENIOR_MIN_AGE, bookingDate)) {
      return {
        ok: false,
        message:
          "La clase de las 11:00 AM los martes y viernes está reservada para personas de 60 años o más.",
      }
    }
    return { ok: true }
  }
  return { ok: true }
}

export const DEFAULT_BOOKING_WINDOW_MINUTES = 5

export type BookingTimeWindowCheck =
  | { ok: true }
  | { ok: false; message: string }

export function evaluateBookingTimeWindow(params: {
  now: Date
  classEnd: Date
  bookingWindowMinutes: number
}): BookingTimeWindowCheck {
  const minutesUntilEnd =
    (params.classEnd.getTime() - params.now.getTime()) / (1000 * 60)
  const cutoff = Math.max(0, params.bookingWindowMinutes)

  if (minutesUntilEnd < cutoff) {
    if (minutesUntilEnd <= 0) {
      return {
        ok: false,
        message: "No se puede reservar: la clase ya terminó.",
      }
    }
    return {
      ok: false,
      message:
        cutoff === 1
          ? "No se puede reservar: falta menos de 1 minuto para que termine la clase."
          : `No se puede reservar: faltan menos de ${cutoff} minutos para que termine la clase.`,
    }
  }

  return { ok: true }
}
