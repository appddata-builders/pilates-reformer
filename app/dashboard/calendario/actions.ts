"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function assertManageCalendar() {
  const session = await getSession()
  const ok =
    session != null &&
    (session.user.role === "admin" || session.user.role === "root")
  return { session, ok }
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

export async function createEventAction(formData: FormData): Promise<void> {
  const { session, ok } = await assertManageCalendar()
  if (!ok || session == null) return

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    eventType: formData.get("eventType"),
    start: formData.get("start"),
    end: formData.get("end"),
    allDay: formData.get("allDay"),
    visibleTo: formData.get("visibleTo"),
  })
  if (!parsed.success) return

  const startDate = new Date(parsed.data.start)
  const endRaw = parsed.data.end != null && parsed.data.end.trim() !== "" ? parsed.data.end : undefined
  const endDate = endRaw != null ? new Date(endRaw) : null

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
}

const updateSchema = createSchema.extend({
  id: z.string().min(1),
})

export async function updateEventAction(formData: FormData): Promise<void> {
  const { session, ok } = await assertManageCalendar()
  if (!ok || session == null) return

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
  if (!parsed.success) return

  const startDate = new Date(parsed.data.start)
  const endRaw = parsed.data.end != null && parsed.data.end.trim() !== "" ? parsed.data.end : undefined
  const endDate = endRaw != null ? new Date(endRaw) : null

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
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const { ok } = await assertManageCalendar()
  if (!ok) return

  const idParsed = z.string().min(1).safeParse(formData.get("id"))
  if (!idParsed.success) return

  const db = getDb()
  await db.delete(schema.studioEvent).where(eq(schema.studioEvent.id, idParsed.data))
  revalidatePath("/dashboard/calendario")
}
