"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { canManageModule } from "@/lib/staff-access.server"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { buildCalendarFeed, dayStart } from "./calendar-feed"
import type { CalendarFeedEvent } from "./calendar-types"

export type CalendarActionResult = { success: boolean; error?: string }

const PAST_EVENT_ERROR = "Los días pasados son de solo lectura."
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** La vista de mes muestra 6 semanas; con esto sobra y se evita pedir de más. */
const MAX_RANGE_DAYS = 62

async function assertManageCalendar() {
  const session = await getSession()
  const ok =
    session != null && (await canManageModule(session.user.role, "calendario"))
  return { session, ok }
}

/** Un evento es de solo lectura cuando terminó (o empezó, si no tiene fin) antes de hoy. */
function endsBeforeToday(start: Date, end: Date | null): boolean {
  return (end ?? start).getTime() < dayStart(new Date()).getTime()
}

/**
 * Eventos del rango que el calendario tiene a la vista. `startStr` y `endStr`
 * son fechas locales (YYYY-MM-DD); `endStr` es exclusiva, como en FullCalendar.
 */
export async function loadCalendarEventsAction(
  startStr: string,
  endStr: string,
): Promise<CalendarFeedEvent[]> {
  const session = await getSession()
  const role = session?.user.role ?? ""
  if (session == null || (role !== "admin" && role !== "root" && role !== "coach")) return []
  if (typeof startStr !== "string" || typeof endStr !== "string") return []
  if (!DATE_RE.test(startStr) || !DATE_RE.test(endStr)) return []

  const rangeStart = new Date(`${startStr}T00:00:00`)
  let rangeEnd = new Date(new Date(`${endStr}T00:00:00`).getTime() - 1)
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) return []
  if (rangeEnd.getTime() < rangeStart.getTime()) return []

  const maxEnd = new Date(rangeStart)
  maxEnd.setDate(maxEnd.getDate() + MAX_RANGE_DAYS)
  if (rangeEnd.getTime() > maxEnd.getTime()) rangeEnd = maxEnd

  const canManage = await canManageModule(role, "calendario")
  return buildCalendarFeed({ role, canManage, rangeStart, rangeEnd })
}

const eventTypeSchema = z.enum([
  "general",
  "class",
  "holiday",
  "maintenance",
  "birthday",
  "expiry",
])

const visibleSchema = z.enum(["admin", "coach", "all"])

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  eventType: eventTypeSchema,
  start: z.string().min(1),
  end: z.string().optional(),
  allDay: z.enum(["true", "false"]),
  visibleTo: visibleSchema,
})

function parseEventDates(start: string, end: string | undefined) {
  const startDate = new Date(start)
  const endRaw = end != null && end.trim() !== "" ? end : undefined
  const endDate = endRaw != null ? new Date(endRaw) : null
  const valid =
    !Number.isNaN(startDate.getTime()) && (endDate == null || !Number.isNaN(endDate.getTime()))
  return { startDate, endDate, valid }
}

async function loadStoredEventDates(id: string) {
  const db = getDb()
  const [row] = await db
    .select({ startDate: schema.studioEvent.startDate, endDate: schema.studioEvent.endDate })
    .from(schema.studioEvent)
    .where(eq(schema.studioEvent.id, id))
    .limit(1)
  if (row == null) return null
  const start =
    row.startDate instanceof Date ? row.startDate : new Date(row.startDate as unknown as number)
  const end =
    row.endDate == null
      ? null
      : row.endDate instanceof Date
        ? row.endDate
        : new Date(row.endDate as unknown as number)
  return { start, end }
}

export async function createEventAction(formData: FormData): Promise<CalendarActionResult> {
  const { session, ok } = await assertManageCalendar()
  if (!ok || session == null) return { success: false, error: "No autorizado" }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    eventType: formData.get("eventType"),
    start: formData.get("start"),
    end: formData.get("end"),
    allDay: formData.get("allDay"),
    visibleTo: formData.get("visibleTo"),
  })
  if (!parsed.success) return { success: false, error: "Revisa los datos del evento" }

  const { startDate, endDate, valid } = parseEventDates(parsed.data.start, parsed.data.end)
  if (!valid) return { success: false, error: "Fecha inválida" }
  if (endsBeforeToday(startDate, endDate)) return { success: false, error: PAST_EVENT_ERROR }

  const db = getDb()
  await db.insert(schema.studioEvent).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    eventType: parsed.data.eventType,
    startDate,
    endDate,
    allDay: parsed.data.allDay === "true",
    color: null,
    relatedUserId: null,
    createdBy: session.user.id,
    visibleTo: parsed.data.visibleTo,
  })

  revalidatePath("/dashboard/calendario")
  return { success: true }
}

const updateSchema = createSchema.extend({
  id: z.string().min(1),
})

export async function updateEventAction(formData: FormData): Promise<CalendarActionResult> {
  const { session, ok } = await assertManageCalendar()
  if (!ok || session == null) return { success: false, error: "No autorizado" }

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    eventType: formData.get("eventType"),
    start: formData.get("start"),
    end: formData.get("end"),
    allDay: formData.get("allDay"),
    visibleTo: formData.get("visibleTo"),
  })
  if (!parsed.success) return { success: false, error: "Revisa los datos del evento" }

  const stored = await loadStoredEventDates(parsed.data.id)
  if (stored == null) return { success: false, error: "Evento no encontrado" }
  if (endsBeforeToday(stored.start, stored.end)) return { success: false, error: PAST_EVENT_ERROR }

  const { startDate, endDate, valid } = parseEventDates(parsed.data.start, parsed.data.end)
  if (!valid) return { success: false, error: "Fecha inválida" }
  if (endsBeforeToday(startDate, endDate)) return { success: false, error: PAST_EVENT_ERROR }

  const db = getDb()
  await db
    .update(schema.studioEvent)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      eventType: parsed.data.eventType,
      startDate,
      endDate,
      allDay: parsed.data.allDay === "true",
      visibleTo: parsed.data.visibleTo,
    })
    .where(eq(schema.studioEvent.id, parsed.data.id))

  revalidatePath("/dashboard/calendario")
  return { success: true }
}

export async function deleteEventAction(formData: FormData): Promise<CalendarActionResult> {
  const { ok } = await assertManageCalendar()
  if (!ok) return { success: false, error: "No autorizado" }

  const idParsed = z.string().min(1).safeParse(formData.get("id"))
  if (!idParsed.success) return { success: false, error: "Evento inválido" }

  const stored = await loadStoredEventDates(idParsed.data)
  if (stored == null) return { success: false, error: "Evento no encontrado" }
  if (endsBeforeToday(stored.start, stored.end)) return { success: false, error: PAST_EVENT_ERROR }

  const db = getDb()
  await db.delete(schema.studioEvent).where(eq(schema.studioEvent.id, idParsed.data))
  revalidatePath("/dashboard/calendario")
  return { success: true }
}
