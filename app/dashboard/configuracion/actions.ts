"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { canManageModule } from "@/lib/staff-access.server"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { serializeNavPermissions, type NavPermissionsMap } from "@/lib/nav-permissions"
import { DEFAULT_STUDIO_NAME } from "@/lib/studio-branding"

const tabSchema = z.enum(["general", "booking", "alerts", "messages"])

const generalSchema = z.object({
  studioName: z.string().trim().min(1, "Nombre requerido"),
})

const bookingSchema = z.object({
  cancelMinutes: z.coerce.number().min(0).max(10080),
  bookingWindowMinutes: z.coerce.number().min(0).max(1440),
})

const alertsSchema = z.object({
  alertLastClassThreshold: z.coerce.number().min(0).max(50),
  alertDaysBeforeExpiry: z.coerce.number().min(0).max(90),
})

const messagesSchema = z.object({
  welcomeMessage: z.string().min(1, "Mensaje de bienvenida requerido"),
  birthdayMessage: z.string().min(1, "Mensaje de cumpleaños requerido"),
})

export type ConfigActionResult = {
  success: boolean
  error?: string
}

async function assertAdminLike() {
  const session = await getSession()
  const ok =
    session != null && (await canManageModule(session.user.role, "configuracion"))
  return { session, ok }
}

async function assertRoot() {
  const session = await getSession()
  const ok = session != null && session.user.role === "root"
  return { session, ok }
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""
  return raw
}

async function ensureMainStudioPolicy(db: ReturnType<typeof getDb>) {
  const [row] = await db
    .select({ id: schema.studioPolicy.id })
    .from(schema.studioPolicy)
    .where(eq(schema.studioPolicy.id, "main"))
    .limit(1)

  if (row != null) return

  const { getDefaultNavPermissions, serializeNavPermissions } = await import("@/lib/nav-permissions")
  await db.insert(schema.studioPolicy).values({
    id: "main",
    studioName: DEFAULT_STUDIO_NAME,
    navPermissions: serializeNavPermissions(getDefaultNavPermissions()),
  })
}

export type NavPermissionsActionResult = {
  success: boolean
  error?: string
}

export async function saveNavPermissionsAction(
  permissions: NavPermissionsMap,
): Promise<NavPermissionsActionResult> {
  const { ok } = await assertRoot()
  if (!ok) return { success: false, error: "No autorizado" }

  const db = getDb()
  await ensureMainStudioPolicy(db)
  await db
    .update(schema.studioPolicy)
    .set({
      navPermissions: serializeNavPermissions(permissions),
      updatedAt: new Date(),
    })
    .where(eq(schema.studioPolicy.id, "main"))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/configuracion")
  return { success: true }
}

export async function saveConfigAction(formData: FormData): Promise<ConfigActionResult> {
  const { session, ok } = await assertAdminLike()
  if (!ok || session == null) {
    return { success: false, error: "No autorizado" }
  }

  const tabParsed = tabSchema.safeParse(formData.get("tab"))
  if (!tabParsed.success) {
    return { success: false, error: "Pestaña inválida" }
  }

  const db = getDb()

  try {
    await ensureMainStudioPolicy(db)

    if (tabParsed.data === "general") {
      const parsed = generalSchema.safeParse({
        studioName: readFormString(formData, "studioName"),
      })
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
      }
      await db
        .update(schema.studioPolicy)
        .set({
          studioName: parsed.data.studioName,
          updatedAt: new Date(),
        })
        .where(eq(schema.studioPolicy.id, "main"))
      revalidatePath("/dashboard/configuracion")
      return { success: true }
    }

    if (tabParsed.data === "booking") {
      const parsed = bookingSchema.safeParse({
        cancelMinutes: formData.get("cancelMinutes"),
        bookingWindowMinutes: formData.get("bookingWindowMinutes"),
      })
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
      }
      await db
        .update(schema.studioPolicy)
        .set({
          cancelMinutes: parsed.data.cancelMinutes,
          bookingWindowMinutes: parsed.data.bookingWindowMinutes,
          updatedAt: new Date(),
        })
        .where(eq(schema.studioPolicy.id, "main"))
      revalidatePath("/dashboard/configuracion")
      return { success: true }
    }

    if (tabParsed.data === "alerts") {
      const parsed = alertsSchema.safeParse({
        alertLastClassThreshold: formData.get("alertLastClassThreshold"),
        alertDaysBeforeExpiry: formData.get("alertDaysBeforeExpiry"),
      })
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
      }
      await db
        .update(schema.studioPolicy)
        .set({
          alertLastClassThreshold: parsed.data.alertLastClassThreshold,
          alertDaysBeforeExpiry: parsed.data.alertDaysBeforeExpiry,
          updatedAt: new Date(),
        })
        .where(eq(schema.studioPolicy.id, "main"))
      revalidatePath("/dashboard/configuracion")
      return { success: true }
    }

    if (tabParsed.data === "messages") {
      const parsed = messagesSchema.safeParse({
        welcomeMessage: readFormString(formData, "welcomeMessage"),
        birthdayMessage: readFormString(formData, "birthdayMessage"),
      })
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }
      }
      await db
        .update(schema.studioPolicy)
        .set({
          welcomeMessage: parsed.data.welcomeMessage,
          birthdayMessage: parsed.data.birthdayMessage,
          updatedAt: new Date(),
        })
        .where(eq(schema.studioPolicy.id, "main"))
      revalidatePath("/dashboard/configuracion")
      return { success: true }
    }

    return { success: false, error: "Pestaña inválida" }
  } catch {
    return { success: false, error: "No se pudo guardar. Intenta de nuevo." }
  }
}
