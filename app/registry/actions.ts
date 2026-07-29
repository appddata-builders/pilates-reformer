"use server"

import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateDisplayId } from "@/lib/display-id"
import { normalizeBirthdateInput } from "@/lib/birthdate"
import {
  USER_ID_PREFIX_REGULAR,
  parseUserIdPrefix,
} from "@/lib/id-prefix"
import {
  REGISTRY_EMAIL_FIELD_ERROR,
  REGISTRY_GENERIC_ERROR,
} from "@/lib/registry-errors"
import { sendWelcomeNotification } from "@/lib/welcome-message"
import {
  canAccessHiddenRegistry,
  hiddenRegistrySchema,
  isRegistryPolicyComplete,
  sanitizeEmail,
  sanitizePersonName,
  sanitizePhone,
} from "@/lib/hidden-registry"

export type RegistryActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  displayId?: string
}

function getRegistryTokenFromForm(formData: FormData): string | undefined {
  const raw = formData.get("registryToken")
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  return trimmed === "" ? undefined : trimmed
}

export async function hiddenRegistryAction(
  _prev: RegistryActionState,
  formData: FormData,
): Promise<RegistryActionState> {
  const registryToken = getRegistryTokenFromForm(formData)
  if (!canAccessHiddenRegistry(registryToken)) {
    return { success: false, error: "Registro no disponible" }
  }

  const honeypot = formData.get("company")
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { success: true, displayId: `${USER_ID_PREFIX_REGULAR}0000` }
  }

  if (!isRegistryPolicyComplete(formData)) {
    return {
      success: false,
      error: "Debes descargar el acuerdo y aceptar las políticas para registrarte",
    }
  }

  const idPrefix = parseUserIdPrefix(formData.get("idPrefix"))

  const parsed = hiddenRegistrySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? undefined,
    birthdate: formData.get("birthdate"),
    company: formData.get("company") ?? undefined,
  })

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const name = sanitizePersonName(parsed.data.name)
  const email = sanitizeEmail(parsed.data.email)
  const phoneRaw = parsed.data.phone?.trim() ?? ""
  const phone = sanitizePhone(parsed.data.phone)

  if (phoneRaw !== "" && phone == null) {
    return {
      success: false,
      fieldErrors: { phone: ["Teléfono inválido (10 a 15 dígitos)"] },
    }
  }

  if (name.length < 2) {
    return { success: false, fieldErrors: { name: ["Nombre inválido"] } }
  }

  const birthdateRaw = (parsed.data.birthdate ?? "").trim()
  let birthdateIso: string | null = null
  if (birthdateRaw !== "") {
    birthdateIso = normalizeBirthdateInput(birthdateRaw)
    if (!birthdateIso) {
      return {
        success: false,
        fieldErrors: { birthdate: ["Usa formato AAAA-MM-DD"] },
      }
    }
  }

  const db = getDb()

  const [emailTaken] = await db
    .select({ id: schema.user.id, displayId: schema.user.displayId })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  if (emailTaken != null) {
    return {
      success: false,
      fieldErrors: { email: [REGISTRY_EMAIL_FIELD_ERROR] },
    }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password: parsed.data.password,
      },
    })

    const [created] = await db
      .select({ id: schema.user.id, displayId: schema.user.displayId })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1)

    if (created == null) {
      return { success: false, error: REGISTRY_GENERIC_ERROR }
    }

    if (created.displayId != null && created.displayId.trim() !== "") {
      return {
        success: false,
        fieldErrors: { email: [REGISTRY_EMAIL_FIELD_ERROR] },
      }
    }

    const displayId = await generateDisplayId(db, idPrefix)

    await db
      .update(schema.user)
      .set({
        role: "alumno",
        phone,
        displayId,
        birthdate: birthdateIso,
        enabled: true,
        emailVerified: true,
        idPrefix,
      })
      .where(eq(schema.user.id, created.id))

    const [accountRow] = await db
      .select({ id: schema.account.id, password: schema.account.password })
      .from(schema.account)
      .where(eq(schema.account.userId, created.id))
      .limit(1)

    if (accountRow == null || accountRow.password == null || accountRow.password.trim() === "") {
      return { success: false, error: REGISTRY_GENERIC_ERROR }
    }

    const row = created

    if (row != null) {
      const [policy] = await db
        .select({ studioName: schema.studioPolicy.studioName })
        .from(schema.studioPolicy)
        .where(eq(schema.studioPolicy.id, "main"))
        .limit(1)

      await sendWelcomeNotification({
        userId: row.id,
        nombre: name,
        displayId,
        phone,
        estudio: policy?.studioName ?? "Pilates Studio",
      })
    }

    return { success: true, displayId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("unique")) {
      return {
        success: false,
        fieldErrors: { email: [REGISTRY_EMAIL_FIELD_ERROR] },
      }
    }
    return { success: false, error: REGISTRY_GENERIC_ERROR }
  }
}
