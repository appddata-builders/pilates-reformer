export type ScheduleSlot = {
  dayOfWeek: number
  startTime: string
}

export type PublicScheduleSlot = ScheduleSlot & {
  id: string
  capacity: number
  /** Necesaria para saber si la clase ya pasó; si falta se asume 1 hora. */
  endTime?: string | null
}

/** Aforo del estudio: 10 lugares por clase. */
export const STUDIO_CLASS_CAPACITY = 10

export const scheduleDayLabels = [
  { dayOfWeek: 1, label: "Lun" },
  { dayOfWeek: 2, label: "Mar" },
  { dayOfWeek: 3, label: "Mié" },
  { dayOfWeek: 4, label: "Jue" },
  { dayOfWeek: 5, label: "Vie" },
  { dayOfWeek: 6, label: "Sáb" },
]

export const scheduleTimes = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
]

export const demoScheduleSlots: PublicScheduleSlot[] = [
  { id: "s1", dayOfWeek: 1, startTime: "07:00", capacity: 8 },
  { id: "s2", dayOfWeek: 2, startTime: "07:00", capacity: 8 },
  { id: "s3", dayOfWeek: 3, startTime: "07:00", capacity: 8 },
  { id: "s4", dayOfWeek: 4, startTime: "07:00", capacity: 8 },
  { id: "s5", dayOfWeek: 5, startTime: "07:00", capacity: 8 },
  { id: "s6", dayOfWeek: 6, startTime: "07:00", capacity: 8 },
  { id: "s7", dayOfWeek: 1, startTime: "08:00", capacity: 8 },
  { id: "s8", dayOfWeek: 2, startTime: "08:00", capacity: 8 },
  { id: "s9", dayOfWeek: 3, startTime: "08:00", capacity: 8 },
  { id: "s10", dayOfWeek: 4, startTime: "08:00", capacity: 8 },
  { id: "s11", dayOfWeek: 5, startTime: "08:00", capacity: 8 },
  { id: "s12", dayOfWeek: 6, startTime: "08:00", capacity: 8 },
  { id: "s13", dayOfWeek: 1, startTime: "10:00", capacity: 8 },
  { id: "s14", dayOfWeek: 2, startTime: "10:00", capacity: 8 },
  { id: "s15", dayOfWeek: 3, startTime: "10:00", capacity: 8 },
  { id: "s16", dayOfWeek: 4, startTime: "10:00", capacity: 8 },
  { id: "s17", dayOfWeek: 5, startTime: "10:00", capacity: 8 },
  { id: "s18", dayOfWeek: 6, startTime: "10:00", capacity: 8 },
  { id: "s19", dayOfWeek: 1, startTime: "09:00", capacity: 8 },
  { id: "s20", dayOfWeek: 2, startTime: "09:00", capacity: 8 },
  { id: "s21", dayOfWeek: 3, startTime: "09:00", capacity: 8 },
  { id: "s22", dayOfWeek: 4, startTime: "09:00", capacity: 8 },
  { id: "s23", dayOfWeek: 5, startTime: "09:00", capacity: 8 },
  { id: "s37", dayOfWeek: 6, startTime: "09:00", capacity: 8 },
  { id: "s38", dayOfWeek: 1, startTime: "18:00", capacity: 8 },
  { id: "s39", dayOfWeek: 2, startTime: "18:00", capacity: 8 },
  { id: "s40", dayOfWeek: 3, startTime: "18:00", capacity: 8 },
  { id: "s41", dayOfWeek: 4, startTime: "18:00", capacity: 8 },
  { id: "s42", dayOfWeek: 5, startTime: "18:00", capacity: 8 },
  { id: "s24", dayOfWeek: 1, startTime: "17:00", capacity: 8 },
  { id: "s25", dayOfWeek: 2, startTime: "17:00", capacity: 8 },
  { id: "s26", dayOfWeek: 3, startTime: "17:00", capacity: 8 },
  { id: "s27", dayOfWeek: 4, startTime: "17:00", capacity: 8 },
  { id: "s28", dayOfWeek: 5, startTime: "17:00", capacity: 8 },
  { id: "s29", dayOfWeek: 1, startTime: "19:00", capacity: 8 },
  { id: "s30", dayOfWeek: 2, startTime: "19:00", capacity: 8 },
  { id: "s31", dayOfWeek: 3, startTime: "19:00", capacity: 8 },
  { id: "s32", dayOfWeek: 4, startTime: "19:00", capacity: 8 },
  { id: "s33", dayOfWeek: 5, startTime: "19:00", capacity: 8 },
  { id: "s34", dayOfWeek: 1, startTime: "20:00", capacity: 8 },
  { id: "s35", dayOfWeek: 3, startTime: "20:00", capacity: 8 },
  { id: "s36", dayOfWeek: 5, startTime: "20:00", capacity: 8 },
]

export function getMondayOfWeek(base: Date, weekOffset: number) {
  const date = new Date(base)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff + weekOffset * 7)
  return date
}

export function formatWeekRange(monday: Date) {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  })
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`
}
