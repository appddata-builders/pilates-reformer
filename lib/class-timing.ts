function minutesOfDay(time: string): number | null {
  const parts = time.split(":")
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/**
 * Una clase "ya pasó" sólo si es de hoy y su hora de fin quedó atrás. Los otros
 * días del horario apuntan a su próxima ocurrencia, así que no cuentan como
 * pasados.
 */
export function isSlotPastToday(
  slot: { dayOfWeek: number; startTime: string; endTime: string | null },
  now: Date = new Date(),
): boolean {
  if (slot.dayOfWeek !== now.getDay()) return false

  const reference = slot.endTime != null && slot.endTime.trim() !== ""
    ? minutesOfDay(slot.endTime)
    : (() => {
        const start = minutesOfDay(slot.startTime)
        return start == null ? null : start + 60
      })()

  if (reference == null) return false
  return now.getHours() * 60 + now.getMinutes() >= reference
}

/** Días de la semana en curso que ya quedaron atrás (domingo no cuenta). */
export function isWeekdayPast(dayOfWeek: number, now: Date = new Date()): boolean {
  const today = now.getDay()
  if (today === 0) return false
  return dayOfWeek > 0 && dayOfWeek < today
}
