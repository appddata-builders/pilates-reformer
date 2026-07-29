"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { setSlotDisabledForDate } from "@/lib/slot-exceptions"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

function canManageClases(role: string | undefined): boolean {
  return role === "admin" || role === "root"
}

const slotSchema = z.object({
  className: z.string().min(2),
  instructor: z.string().optional(),
  alternateInstructor: z.string().optional(),
  scheduleMode: z.enum(["fixed", "dual"]).default("fixed"),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().optional(),
  capacity: z.coerce.number().min(1).max(100),
  classType: z.enum(["reformer", "mat", "barre", "mayores_60", "otro"]).default("reformer"),
})

function parseSlotForm(formData: FormData) {
  const endTimeRaw = formData.get("endTime")
  const endTime =
    typeof endTimeRaw === "string" && endTimeRaw.length > 0 ? endTimeRaw : undefined

  const scheduleModeRaw = formData.get("scheduleMode")
  const scheduleMode = scheduleModeRaw === "dual" ? "dual" : "fixed"

  return slotSchema.safeParse({
    className: formData.get("className"),
    instructor: formData.get("instructor") || undefined,
    alternateInstructor: formData.get("alternateInstructor") || undefined,
    scheduleMode,
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime,
    capacity: formData.get("capacity"),
    classType: formData.get("classType") ?? "reformer",
  })
}

function slotInstructorValues(parsed: z.infer<typeof slotSchema>) {
  const scheduleMode = parsed.scheduleMode ?? "fixed"
  if (scheduleMode === "dual") {
    const main = parsed.instructor?.trim() ?? ""
    const alt = parsed.alternateInstructor?.trim() ?? ""
    if (main.length === 0 || alt.length === 0) {
      return {
        scheduleMode: "fixed" as const,
        instructor: main.length > 0 ? main : null,
        alternateInstructor: null,
      }
    }
    return {
      scheduleMode: "dual" as const,
      instructor: main,
      alternateInstructor: alt,
    }
  }
  return {
    scheduleMode: "fixed" as const,
    instructor: parsed.instructor ?? null,
    alternateInstructor: null,
  }
}

export async function createSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || !canManageClases(role)) {
    return { success: false, error: "No autorizado" }
  }

  const parsed = parseSlotForm(formData)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const db = getDb()
  const instructorFields = slotInstructorValues(parsed.data)
  await db.insert(schema.scheduleSlot).values({
    id: crypto.randomUUID(),
    className: parsed.data.className,
    dayOfWeek: parsed.data.dayOfWeek,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime ?? null,
    capacity: parsed.data.capacity,
    classType: parsed.data.classType,
    ...instructorFields,
    isActive: true,
  })

  revalidatePath("/dashboard/clases")
  return { success: true }
}

export async function updateSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || !canManageClases(role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.length === 0) {
    return { success: false, error: "ID inválido" }
  }

  const parsed = parseSlotForm(formData)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const db = getDb()
  const instructorFields = slotInstructorValues(parsed.data)
  await db
    .update(schema.scheduleSlot)
    .set({
      className: parsed.data.className,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime ?? null,
      capacity: parsed.data.capacity,
      classType: parsed.data.classType,
      ...instructorFields,
    })
    .where(eq(schema.scheduleSlot.id, id))

  revalidatePath("/dashboard/clases")
  return { success: true }
}

export async function deleteSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || !canManageClases(role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.length === 0) {
    return { success: false, error: "ID inválido" }
  }

  const db = getDb()
  await db.delete(schema.booking).where(eq(schema.booking.scheduleSlotId, id))
  await db.delete(schema.scheduleSlot).where(eq(schema.scheduleSlot.id, id))

  revalidatePath("/dashboard/clases")
  return { success: true }
}

export async function toggleSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || !canManageClases(role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  const isActive = formData.get("isActive") === "true"
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  await db
    .update(schema.scheduleSlot)
    .set({ isActive: !isActive })
    .where(eq(schema.scheduleSlot.id, id))

  revalidatePath("/dashboard/clases")
  revalidatePath("/dashboard/calendario")
  revalidatePath("/dashboard/reservas")
  return { success: true }
}

export async function setSlotWeekAvailabilityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || !canManageClases(role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  const dateStr = formData.get("date")
  const availableRaw = formData.get("available")
  if (typeof id !== "string" || id.length === 0) {
    return { success: false, error: "ID inválido" }
  }
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: "Fecha inválida" }
  }

  const available = availableRaw === "true"
  const db = getDb()

  const [slot] = await db
    .select({
      id: schema.scheduleSlot.id,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      isActive: schema.scheduleSlot.isActive,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, id))
    .limit(1)

  if (slot == null) {
    return { success: false, error: "Horario no encontrado" }
  }
  if (!slot.isActive) {
    return { success: false, error: "Activa el horario recurrente antes de gestionar semanas" }
  }

  const bookingDow = new Date(`${dateStr}T12:00:00`).getDay()
  if (bookingDow !== slot.dayOfWeek) {
    return { success: false, error: "La fecha no coincide con el día de esta clase" }
  }

  await setSlotDisabledForDate(db, id, dateStr, !available)

  revalidatePath("/dashboard/clases")
  revalidatePath("/dashboard/calendario")
  revalidatePath("/dashboard/reservas")
  return { success: true }
}

