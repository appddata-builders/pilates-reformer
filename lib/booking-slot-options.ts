import { formatTime12h } from "@/lib/time-utils"

export type BookingSlotOption = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  className: string
  capacity: number
}

export function getDayOfWeekFromDateStr(dateStr: string): number | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.getDay()
}

export function filterSlotsForBookingDate(
  slots: BookingSlotOption[],
  bookingDateStr: string,
  disabledSlotDateKeys?: Iterable<string>,
): BookingSlotOption[] {
  const dow = getDayOfWeekFromDateStr(bookingDateStr)
  if (dow === null) return []
  if (dow === 0) return []
  const disabled =
    disabledSlotDateKeys == null ? null : new Set(disabledSlotDateKeys)
  return slots.filter((s) => {
    if (s.dayOfWeek !== dow) return false
    if (disabled != null && disabled.has(`${s.id}|${bookingDateStr}`)) return false
    return true
  })
}

/** La alumna elige por horario: el coach no se muestra al reservar. */
export function formatSlotLabel(slot: BookingSlotOption): string {
  const end = slot.endTime ? ` – ${formatTime12h(slot.endTime)}` : ""
  return `${slot.className} · ${formatTime12h(slot.startTime)}${end}`
}

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function localTodayStr(): string {
  return toLocalDateStr(new Date())
}

export function nextOccurrenceForDayOfWeek(
  dayOfWeek: number,
  from: Date = new Date(),
): Date {
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)
  const diff = (dayOfWeek - base.getDay() + 7) % 7
  base.setDate(base.getDate() + diff)
  return base
}

export function dateRangeForDay(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T23:59:59.999`)
  return { start, end }
}

export function bookingDateAtNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

export function nextDateWithSlots(
  fromDateStr: string,
  slots: BookingSlotOption[],
  disabledSlotDateKeys?: Iterable<string>,
): string {
  const start = new Date(`${fromDateStr}T12:00:00`)
  if (Number.isNaN(start.getTime())) return fromDateStr
  for (let i = 0; i < 14; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const str = toLocalDateStr(d)
    if (filterSlotsForBookingDate(slots, str, disabledSlotDateKeys).length > 0) return str
  }
  return fromDateStr
}

export function resolveBookingDefaultDate(
  dateStr: string,
  slots: BookingSlotOption[],
  disabledSlotDateKeys?: Iterable<string>,
): string {
  if (filterSlotsForBookingDate(slots, dateStr, disabledSlotDateKeys).length > 0) return dateStr
  return nextDateWithSlots(dateStr, slots, disabledSlotDateKeys)
}

export function formatBookingDateEs(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
}
