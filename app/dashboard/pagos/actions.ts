"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendPaymentConfirmedNotification } from "@/lib/payment-notifications"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

function isAdminOrRoot(role: string | null | undefined) {
  return role === "admin" || role === "root"
}

const createPaymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(["efectivo", "transferencia", "terminal", "mensual", "semestral"]),
  concept: z.string().optional(),
  subscriptionId: z.string().optional(),
})

export async function createPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session || !isAdminOrRoot(session.user.role)) {
    return { success: false, error: "No autorizado" }
  }

  const parsed = createPaymentSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    concept: formData.get("concept") || undefined,
    subscriptionId: formData.get("subscriptionId") || undefined,
  })
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const db = getDb()
  await db.insert(schema.payment).values({
    id: crypto.randomUUID(),
    userId: parsed.data.userId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    status: "succeeded",
    concept: parsed.data.concept ?? null,
    subscriptionId: parsed.data.subscriptionId ?? null,
    collectedBy: session.user.name ?? session.user.id,
  })

  revalidatePath("/dashboard/pagos")
  return { success: true }
}

export async function confirmPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session || !isAdminOrRoot(session.user.role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, error: "ID de pago inválido" }
  }

  const db = getDb()
  const [row] = await db
    .select({
      id: schema.payment.id,
      userId: schema.payment.userId,
      amount: schema.payment.amount,
      method: schema.payment.method,
      status: schema.payment.status,
      concept: schema.payment.concept,
      userName: schema.user.name,
    })
    .from(schema.payment)
    .innerJoin(schema.user, eq(schema.payment.userId, schema.user.id))
    .where(eq(schema.payment.id, id))
    .limit(1)

  if (row == null) {
    return { success: false, error: "Pago no encontrado" }
  }

  if (row.status !== "pending") {
    return { success: false, error: "Solo se pueden confirmar pagos pendientes" }
  }

  await db
    .update(schema.payment)
    .set({
      status: "succeeded",
      collectedBy: session.user.name ?? session.user.id,
    })
    .where(eq(schema.payment.id, id))

  await sendPaymentConfirmedNotification(db, {
    userId: row.userId,
    nombre: row.userName,
    amount: row.amount,
    method: row.method,
    concept: row.concept,
  })

  revalidatePath("/dashboard/pagos")
  revalidatePath("/dashboard/usuarios")
  revalidatePath(`/dashboard/usuarios/${row.userId}`)
  return { success: true }
}

export async function setPaymentValidatedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  if (!session || !isAdminOrRoot(session.user.role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, error: "ID de pago inválido" }
  }

  const validatedRaw = formData.get("validated")
  if (validatedRaw !== "true" && validatedRaw !== "false") {
    return { success: false, error: "Valor de validación inválido" }
  }
  const validated = validatedRaw === "true"

  const db = getDb()
  const [row] = await db
    .select({ id: schema.payment.id })
    .from(schema.payment)
    .where(eq(schema.payment.id, id))
    .limit(1)

  if (row == null) {
    return { success: false, error: "Pago no encontrado" }
  }

  await db
    .update(schema.payment)
    .set({ validated })
    .where(eq(schema.payment.id, id))

  revalidatePath("/dashboard/pagos")
  return { success: true }
}
