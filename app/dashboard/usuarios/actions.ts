"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateDisplayId } from "@/lib/display-id"
import { normalizeBirthdateInput } from "@/lib/birthdate"
import { sendWelcomeNotification } from "@/lib/welcome-message"
import { applyUserPlan } from "@/lib/activate-subscription"
import { revokeUserSessions } from "@/lib/revoke-user-sessions"
import { resetUserPassword } from "@/lib/reset-user-password"
import { routes } from "@/lib/routes"
import { parseManageableRole } from "@/lib/user-role"
import { changeUserRole } from "@/lib/user-role.server"
import { DEFAULT_STUDIO_NAME } from "@/lib/studio-branding"

const createAlumnoSchema = z.object({
  name: z.string().min(2, "Nombre demasiado corto"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Contraseña mínimo 6 caracteres"),
  phone: z.string().optional(),
  birthdate: z.string().min(1, "Fecha de cumpleaños requerida"),
  planId: z.string().optional(),
  billingCycle: z
    .enum(["mensual", "quincenal", "semanal", "efectivo"])
    .optional(),
  startDate: z.string().optional(),
})

const updateAlumnoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Nombre demasiado corto"),
  email: z.string().email("Correo inválido"),
  phone: z.string().optional(),
  birthdate: z.string().optional(),
  notes: z.string().optional(),
  planId: z.string().optional(),
  billingCycle: z
    .enum(["mensual", "quincenal", "semanal", "efectivo"])
    .optional(),
  startDate: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional(),
  role: z.enum(["alumno", "coach"]).optional(),
})

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  displayId?: string
  newPassword?: string
}

async function assertAdminLike() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const ok =
    session != null &&
    (session.user.role === "admin" || session.user.role === "root")
  return { session, ok }
}

export async function createAlumnoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertAdminLike()
  if (!ok) return { success: false, error: "No autorizado" }

  const parsed = createAlumnoSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? undefined,
    birthdate: formData.get("birthdate"),
    planId: formData.get("planId") || undefined,
    billingCycle: formData.get("billingCycle") || undefined,
    startDate: formData.get("startDate") || undefined,
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const birthdateIso = normalizeBirthdateInput(parsed.data.birthdate)
  if (!birthdateIso) {
    return {
      success: false,
      fieldErrors: { birthdate: ["Usa formato AAAA-MM-DD o DD/MM/AAAA"] },
    }
  }

  const planId = parsed.data.planId?.trim() ?? ""
  let planStart: Date | undefined
  if (planId !== "") {
    const startStr = parsed.data.startDate?.trim()
    if (startStr != null && startStr !== "") {
      planStart = new Date(`${startStr}T12:00:00`)
    }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
    })
    const db = getDb()
    const displayId = await generateDisplayId(db)
    await db
      .update(schema.user)
      .set({
        role: "alumno",
        phone: parsed.data.phone ?? null,
        displayId,
        birthdate: birthdateIso,
        enabled: true,
      })
      .where(eq(schema.user.email, parsed.data.email))

    const [row] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, parsed.data.email))
      .limit(1)

    if (row != null) {
      const [policy] = await db
        .select({
          studioName: schema.studioPolicy.studioName,
        })
        .from(schema.studioPolicy)
        .where(eq(schema.studioPolicy.id, "main"))
        .limit(1)

      await sendWelcomeNotification({
        userId: row.id,
        nombre: parsed.data.name,
        displayId,
        phone: parsed.data.phone ?? null,
        estudio: policy?.studioName ?? DEFAULT_STUDIO_NAME,
      })

      if (planId !== "") {
        const planResult = await applyUserPlan(db, {
          userId: row.id,
          planId,
          billingCycle: parsed.data.billingCycle ?? "mensual",
          startDate: planStart,
        })
        if (!planResult.ok) {
          return { success: false, error: planResult.error }
        }
      }
    }

    revalidatePath(routes.usuarios)
    revalidatePath("/dashboard/pagos")
    return { success: true, displayId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("unique")) {
      return { success: false, error: "El correo ya está registrado" }
    }
    return { success: false, error: msg }
  }
}

export async function updateAlumnoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { session, ok } = await assertAdminLike()
  if (!ok || session == null) return { success: false, error: "No autorizado" }

  const parsed = updateAlumnoSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    birthdate: formData.get("birthdate") ?? "",
    notes: formData.get("notes") ?? undefined,
    planId: formData.get("planId") ?? undefined,
    billingCycle: formData.get("billingCycle") || undefined,
    startDate: formData.get("startDate") || undefined,
    enabled: formData.get("enabled") ?? undefined,
    role: formData.get("role") || undefined,
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const birthdateRaw = (parsed.data.birthdate ?? "").trim()
  let birthdateIso: string | null = null
  if (birthdateRaw !== "") {
    birthdateIso = normalizeBirthdateInput(birthdateRaw)
    if (!birthdateIso) {
      return {
        success: false,
        fieldErrors: { birthdate: ["Usa formato AAAA-MM-DD o DD/MM/AAAA"] },
      }
    }
  }

  const planId = typeof parsed.data.planId === "string" ? parsed.data.planId.trim() : ""
  let planStart: Date | undefined
  if (planId !== "" && parsed.data.startDate) {
    const startStr = parsed.data.startDate.trim()
    if (startStr !== "") {
      planStart = new Date(`${startStr}T12:00:00`)
    }
  }

  const db = getDb()
  const enabledNext =
    parsed.data.enabled != null ? parsed.data.enabled === "true" : undefined

  if (enabledNext === false && session.user.id === parsed.data.id) {
    return { success: false, error: "No puedes inhabilitar tu propia cuenta" }
  }

  const [existing] = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      role: schema.user.role,
      enabled: schema.user.enabled,
    })
    .from(schema.user)
    .where(eq(schema.user.id, parsed.data.id))
    .limit(1)

  if (existing == null || parseManageableRole(existing.role) == null) {
    return { success: false, error: "Usuario no encontrado" }
  }

  const roleNext = parsed.data.role ?? null
  if (roleNext != null && roleNext !== existing.role && session.user.id === parsed.data.id) {
    return { success: false, error: "No puedes cambiar tu propio rol" }
  }

  if (parsed.data.email !== existing.email) {
    const [emailTaken] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, parsed.data.email))
      .limit(1)
    if (emailTaken != null && emailTaken.id !== parsed.data.id) {
      return { success: false, error: "El correo ya está registrado" }
    }
  }

  try {
    await db
      .update(schema.user)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
        birthdate: birthdateIso,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        ...(enabledNext !== undefined ? { enabled: enabledNext } : {}),
      })
      .where(eq(schema.user.id, parsed.data.id))

    if (enabledNext === false && existing.enabled !== false) {
      await revokeUserSessions(db, parsed.data.id)
    }

    if (parsed.data.planId !== undefined) {
      const planResult = await applyUserPlan(db, {
        userId: parsed.data.id,
        planId,
        billingCycle: parsed.data.billingCycle ?? "mensual",
        startDate: planStart,
      })
      if (!planResult.ok) {
        return { success: false, error: planResult.error }
      }
    }

    // El cambio de rol va al final: mueve al usuario de lista y limpia
    // los horarios donde figuraba como instructor.
    if (roleNext != null && roleNext !== existing.role) {
      const roleResult = await changeUserRole(db, {
        userId: parsed.data.id,
        nextRole: roleNext,
      })
      if (!roleResult.ok) {
        return { success: false, error: roleResult.error }
      }
      revalidatePath(routes.coaches)
      revalidatePath(routes.clases)
    }

    revalidatePath(routes.usuarios)
    revalidatePath("/dashboard/pagos")
    revalidatePath(routes.usuarioDetail(parsed.data.id))
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("unique")) {
      return { success: false, error: "El correo ya está registrado" }
    }
    return { success: false, error: msg }
  }
}

export async function toggleUserEnabledAction(
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
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (existing == null || existing.role !== "alumno") {
    return { success: false, error: "Usuario no encontrado" }
  }

  try {
    await db
      .update(schema.user)
      .set({ enabled: enabledNext })
      .where(eq(schema.user.id, id))

    if (!enabledNext) {
      await revokeUserSessions(db, id)
    }

    revalidatePath(routes.usuarios)
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    return { success: false, error: msg }
  }
}

export async function resetAlumnoPasswordAction(
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

  if (existing == null || existing.role !== "alumno") {
    return { success: false, error: "Usuario no encontrado" }
  }

  try {
    const newPassword = await resetUserPassword(id)
    revalidatePath(routes.usuarios)
    revalidatePath(routes.usuarioDetail(id))
    return { success: true, newPassword }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al restablecer contraseña"
    return { success: false, error: msg }
  }
}

export async function deleteAlumnoAction(
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

  if (existing == null || existing.role !== "alumno") {
    return { success: false, error: "Usuario no encontrado" }
  }

  try {
    await db
      .update(schema.saleItem)
      .set({ userId: null })
      .where(eq(schema.saleItem.userId, id))
    await db
      .update(schema.studioEvent)
      .set({ createdBy: null })
      .where(eq(schema.studioEvent.createdBy, id))
    await db.delete(schema.user).where(eq(schema.user.id, id))
    revalidatePath(routes.usuarios)
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    return { success: false, error: msg }
  }
}
