import { scheduleTimes, type ScheduleSlot } from "@/lib/site/schedule"
import { evaluateBookingTimeWindow } from "@/lib/booking-rules"
import { endTimeFromStart } from "@/lib/time-utils"

export function normalizeScheduleTime(value: string): string {
  const parts = value.trim().split(":")
  if (parts.length < 2) return value.trim()
  const hour = parts[0].padStart(2, "0")
  const minute = parts[1].padStart(2, "0")
  return `${hour}:${minute}`
}

export function getBoardTimes(slots: ScheduleSlot[]): string[] {
  const times = new Set<string>()
  for (const t of scheduleTimes) {
    times.add(t)
  }
  for (const slot of slots) {
    times.add(normalizeScheduleTime(slot.startTime))
  }
  return Array.from(times).sort((a, b) => a.localeCompare(b))
}

export function findSlotAt<T extends ScheduleSlot>(
  slots: T[],
  dayOfWeek: number,
  startTime: string,
): T | undefined {
  const time = normalizeScheduleTime(startTime)
  return slots.find(
    (slot) =>
      slot.dayOfWeek === dayOfWeek &&
      normalizeScheduleTime(slot.startTime) === time,
  )
}

export function boardEnrollmentKey(slotId: string, dateStr: string): string {
  return `${slotId}|${dateStr}`
}

export function getBoardEnrolledCount(
  enrollments: Record<string, number>,
  slotId: string,
  dateStr: string,
): number {
  return enrollments[boardEnrollmentKey(slotId, dateStr)] ?? 0
}

export function isBoardSlotDisabled(
  disabledSlotDateKeys: Iterable<string> | undefined,
  slotId: string,
  dateStr: string,
): boolean {
  if (disabledSlotDateKeys == null) return false
  const key = boardEnrollmentKey(slotId, dateStr)
  if (disabledSlotDateKeys instanceof Set) {
    return disabledSlotDateKeys.has(key)
  }
  for (const item of disabledSlotDateKeys) {
    if (item === key) return true
  }
  return false
}

export function isBoardSlotFull(enrolled: number, capacity: number): boolean {
  return enrolled >= capacity
}

/**
 * Una celda "ya pasó" cuando el servidor rechazaría la reserva por tiempo:
 * faltan menos de `bookingWindowMinutes` para que la clase termine
 * (misma regla que evaluateBookingAllowed en createBookingForUser).
 */
export function isBoardSlotPast(params: {
  dateStr: string
  startTime: string
  endTime?: string | null
  bookingWindowMinutes: number
  now?: Date
}): boolean {
  const now = params.now ?? new Date()
  const end = params.endTime ?? endTimeFromStart(params.startTime)
  const classEnd = new Date(`${params.dateStr}T${normalizeScheduleTime(end)}:00`)
  if (Number.isNaN(classEnd.getTime())) return false
  return !evaluateBookingTimeWindow({
    now,
    classEnd,
    bookingWindowMinutes: params.bookingWindowMinutes,
  }).ok
}

export function canOpenBookingFromBoard(params: {
  enrolled: number
  capacity: number
  disabled: boolean
  past?: boolean
}): boolean {
  if (params.disabled) return false
  if (params.past) return false
  if (isBoardSlotFull(params.enrolled, params.capacity)) return false
  return true
}
