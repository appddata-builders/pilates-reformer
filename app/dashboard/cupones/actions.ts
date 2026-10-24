"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { canManageModule } from "@/lib/staff-access.server"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { normalizeCouponCode } from "@/lib/coupon-pricing"
import { studioLocalDateTimeToInstant } from "@/lib/studio-month"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

async function assertStaff() {
  const session = await getSession()
  const ok =
    session != null && (await canManageModule(session.user.role, "cupones"))
  return { session, ok }
}

// Mediodía del estudio: el día se lee igual en cualquier zona horaria del servidor.
function parseOptionalDate(raw: FormDataEntryValue | null): Date | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return studioLocalDateTimeToInstant(value, 12, 0)
}

const couponSchema = z
  .object({
    code: z.string().min(2, "Código muy corto").max(32),
    name: z.string().min(2, "Nombre muy corto"),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.coerce.number().positive("El descuento debe ser mayor a 0"),
    maxUses: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null
      return val
    }, z.coerce.number().int().min(1).nullable()),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El porcentaje no puede ser mayor a 100",
        path: ["discountValue"],
      })
    }
    if (data.validFrom && data.validUntil && data.validFrom > data.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha final no puede ser anterior a la inicial",
        path: ["validUntil"],
      })
    }
  })

export async function createCouponAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertStaff()
  if (!ok) return { success: false, error: "No autorizado" }

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    maxUses: formData.get("maxUses"),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? ""),
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const code = normalizeCouponCode(parsed.data.code)
  const db = getDb()

  const [existing] = await db
    .select({ id: schema.coupon.id })
    .from(schema.coupon)
    .where(eq(schema.coupon.code, code))
    .limit(1)

  if (existing != null) {
    return { success: false, error: "Ya existe un cupón con ese código" }
  }

  await db.insert(schema.coupon).values({
    id: crypto.randomUUID(),
    code,
    name: parsed.data.name.trim(),
    discountType: parsed.data.discountType,
    discountValue: parsed.data.discountValue,
    maxUses: parsed.data.maxUses,
    validFrom: parseOptionalDate(parsed.data.validFrom ?? null),
    validUntil: parseOptionalDate(parsed.data.validUntil ?? null),
    isActive: true,
  })

  revalidatePath("/dashboard/cupones")
  return { success: true }
}

export async function updateCouponAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertStaff()
  if (!ok) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, error: "ID inválido" }
  }

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    maxUses: formData.get("maxUses"),
    validFrom: String(formData.get("validFrom") ?? ""),
    validUntil: String(formData.get("validUntil") ?? ""),
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const code = normalizeCouponCode(parsed.data.code)
  const db = getDb()

  const [existing] = await db
    .select({ id: schema.coupon.id })
    .from(schema.coupon)
    .where(eq(schema.coupon.code, code))
    .limit(1)

  if (existing != null && existing.id !== id) {
    return { success: false, error: "Ya existe un cupón con ese código" }
  }

  await db
    .update(schema.coupon)
    .set({
      code,
      name: parsed.data.name.trim(),
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      maxUses: parsed.data.maxUses,
      validFrom: parseOptionalDate(parsed.data.validFrom ?? null),
      validUntil: parseOptionalDate(parsed.data.validUntil ?? null),
    })
    .where(eq(schema.coupon.id, id))

  revalidatePath("/dashboard/cupones")
  return { success: true }
}

export async function toggleCouponAction(
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertStaff()
  if (!ok) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const [row] = await db
    .select({ isActive: schema.coupon.isActive })
    .from(schema.coupon)
    .where(eq(schema.coupon.id, id))
    .limit(1)

  if (row == null) return { success: false, error: "Cupón no encontrado" }

  await db
    .update(schema.coupon)
    .set({ isActive: !row.isActive })
    .where(eq(schema.coupon.id, id))

  revalidatePath("/dashboard/cupones")
  return { success: true }
}

export async function deleteCouponAction(
  formData: FormData,
): Promise<ActionState> {
  const { ok } = await assertStaff()
  if (!ok) return { success: false, error: "No autorizado" }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  await db
    .update(schema.coupon)
    .set({ isActive: false })
    .where(eq(schema.coupon.id, id))

  revalidatePath("/dashboard/cupones")
  return { success: true }
}
