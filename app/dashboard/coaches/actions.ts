"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revokeUserSessions } from "@/lib/revoke-user-sessions"
import { sendStudioPasswordReset } from "@/lib/reset-user-password"
import { routes } from "@/lib/routes"
import { changeUserRole } from "@/lib/user-role.server"
import { CognitoPasswordError } from "@/lib/cognito"
import { createUserAccount, normalizeEmail } from "@/lib/user-accounts"
import { passwordSchema } from "@/lib/password-rules"

const EMAIL_LOCKED_MSG =
  "El correo no se puede cambiar: es la cuenta de acceso en Cognito. Para usar otro, da de alta una cuenta nueva."

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  /** Correo al que Cognito mandó el código para cambiar la contraseña. */
  sentTo?: string
}

async function assertAdminLike() {
  const session = await getSession()
  const ok =
    session != null &&
    (session.user.role === "admin" || session.user.role === "root")
  return { session, ok }
}

const createCoachSchema = z.object({
  name: z.string().min(2, "Nombre demasiado corto"),
  email: z.string().email("Correo inválido"),
  password: passwordSchema,
  phone: z.string().optional(),
})

const updateCoachSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Nombre demasiado corto"),
  email: z.string().email("Correo inválido"),
  phone: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional(),
  role: z.enum(["alumno", "coach"]).optional(),
})

export async function createCoachAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertAdminLike()
  if (!ok) return { success: false, error: "No autorizado" }

  const parsed = createCoachSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? undefined,
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await createUserAccount(getDb(), {
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      role: "coach",
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
    })

    revalidatePath("/dashboard/coaches")
    revalidatePath("/dashboard/clases")
    return { success: true }
  } catch (e) {
    if (e instanceof CognitoPasswordError) {
      return { success: false, fieldErrors: { password: [e.message] } }
    }
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("unique")) {
      return { success: false, error: "El correo ya está registrado" }
    }
    return { success: false, error: msg }
  }
}

export async function updateCoachAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { session, ok } = await assertAdminLike()
  if (!ok || session == null) return { success: false, error: "No autorizado" }

  const parsed = updateCoachSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    enabled: formData.get("enabled") ?? undefined,
    role: formData.get("role") || undefined,
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const enabledNext =
    parsed.data.enabled != null ? parsed.data.enabled === "true" : undefined

  if (enabledNext === false && session.user.id === parsed.data.id) {
    return { success: false, error: "No puedes inhabilitar tu propia cuenta" }
  }

  const db = getDb()
  const [existing] = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      role: schema.user.role,
      enabled: schema.user.enabled,
    })
    .from(schema.user)
    .where(eq(schema.user.id, parsed.data.id))
    .limit(1)

  if (existing == null || existing.role !== "coach") {
    return { success: false, error: "Coach no encontrado" }
  }

  const roleNext = parsed.data.role ?? null
  if (roleNext != null && roleNext !== existing.role && session.user.id === parsed.data.id) {
    return { success: false, error: "No puedes cambiar tu propio rol" }
  }

  // El correo es la cuenta de acceso en Cognito, y sin APIs de admin sólo la
  // dueña puede cambiarlo.
  if (normalizeEmail(parsed.data.email) !== existing.email) {
    return { success: false, error: EMAIL_LOCKED_MSG }
  }

  try {
    await db
      .update(schema.user)
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
        ...(enabledNext !== undefined ? { enabled: enabledNext } : {}),
      })
      .where(eq(schema.user.id, parsed.data.id))

    if (parsed.data.name !== existing.name) {
      await db
        .update(schema.scheduleSlot)
        .set({ instructor: parsed.data.name })
        .where(eq(schema.scheduleSlot.instructor, existing.name))
      await db
        .update(schema.scheduleSlot)
        .set({ alternateInstructor: parsed.data.name })
        .where(eq(schema.scheduleSlot.alternateInstructor, existing.name))
    }

    if (enabledNext === false && existing.enabled !== false) {
      await revokeUserSessions(db, parsed.data.id)
    }

    // El cambio de rol va al final: libera los horarios donde era instructor
    // y le asigna folio ST si no tenía.
    if (roleNext != null && roleNext !== existing.role) {
      const roleResult = await changeUserRole(db, {
        userId: parsed.data.id,
        nextRole: roleNext,
      })
      if (!roleResult.ok) {
        return { success: false, error: roleResult.error }
      }
      revalidatePath(routes.usuarios)
    }

    revalidatePath("/dashboard/coaches")
    revalidatePath("/dashboard/clases")
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("unique")) {
      return { success: false, error: "El correo ya está registrado" }
    }
    return { success: false, error: msg }
  }
}

export async function toggleCoachEnabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { session, ok } = await assertAdminLike()
  if (!ok || session == null) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  const enabledRaw = formData.get("enabled")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }
  if (enabledRaw !== "true" && enabledRaw !== "false") {
    return { success: false, error: "Estado inválido" }
  }

  const enabledNext = enabledRaw === "true"
  if (!enabledNext && session.user.id === id) {
    return { success: false, error: "No puedes inhabilitar tu propia cuenta" }
  }

  const db = getDb()
  const [existing] = await db
    .select({ role: schema.user.role, enabled: schema.user.enabled })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (existing == null || existing.role !== "coach") {
    return { success: false, error: "Coach no encontrado" }
  }

  try {
    await db
      .update(schema.user)
      .set({ enabled: enabledNext })
      .where(eq(schema.user.id, id))

    if (!enabledNext) {
      await revokeUserSessions(db, id)
    }

    revalidatePath("/dashboard/coaches")
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    return { success: false, error: msg }
  }
}

export async function resetCoachPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertAdminLike()
  if (!ok) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const [existing] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (existing == null || existing.role !== "coach") {
    return { success: false, error: "Coach no encontrado" }
  }

  try {
    const sentTo = await sendStudioPasswordReset(id)
    revalidatePath("/dashboard/coaches")
    return { success: true, sentTo }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al restablecer contraseña"
    return { success: false, error: msg }
  }
}

export async function deleteCoachAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertAdminLike()
  if (!ok) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const [existing] = await db
    .select({ role: schema.user.role, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (existing == null || existing.role !== "coach") {
    return { success: false, error: "Coach no encontrado" }
  }

  try {
    await db
      .update(schema.scheduleSlot)
      .set({ instructor: null })
      .where(eq(schema.scheduleSlot.instructor, existing.name))
    await db
      .update(schema.scheduleSlot)
      .set({ alternateInstructor: null })
      .where(eq(schema.scheduleSlot.alternateInstructor, existing.name))

    await db.delete(schema.coachPayrollPeriod).where(eq(schema.coachPayrollPeriod.coachId, id))

    await db
      .update(schema.saleItem)
      .set({ userId: null })
      .where(eq(schema.saleItem.userId, id))
    await db
      .update(schema.studioEvent)
      .set({ createdBy: null })
      .where(eq(schema.studioEvent.createdBy, id))

    await db.delete(schema.user).where(eq(schema.user.id, id))

    revalidatePath("/dashboard/coaches")
    revalidatePath("/dashboard/clases")
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    return { success: false, error: msg }
  }
}
