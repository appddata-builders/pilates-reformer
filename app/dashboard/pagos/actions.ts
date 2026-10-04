"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendPaymentConfirmedNotification } from "@/lib/payment-notifications"
import { cancelPaymentById } from "@/lib/payment-cancellation"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

function isAdminOrRoot(role: string | null | undefined) {
  return role === "admin" || role === "root"
}

export async function confirmPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
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
  // Confirmar el cobro es lo que la alumna ve como "ya tengo plan": sus dos
  // vistas tienen que quedar frescas junto con las del admin.
  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/planes")
  return { success: true }
}

/**
 * Anula un pago mal capturado o una clase que ya no se va a cobrar. No borra la
 * fila: la deja en `cancelled` con quién y por qué, para que el histórico de
 * caja siga cuadrando.
 *
 * El pago de una suscripción ya confirmada queda fuera: ese cobro es lo que
 * sostiene un plan vigente, y anularlo dejaría a la alumna con clases pagadas
 * que la caja ya no registra.
 *
 * En cambio, un plan que todavía no se cobra se da de baja junto con su cobro:
 * si la alumna se arrepiente, no queda ni deuda ni plan.
 */
export async function cancelPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session || !isAdminOrRoot(session.user.role)) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, error: "ID de pago inválido" }
  }

  const reasonRaw = formData.get("reason")

  const result = await cancelPaymentById(getDb(), {
    paymentId: id,
    actor: session.user.name ?? session.user.id,
    reason: typeof reasonRaw === "string" ? reasonRaw : "",
  })

  if (!result.ok) {
    return { success: false, error: result.error }
  }

  revalidatePath("/dashboard/pagos")
  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/planes")
  revalidatePath("/dashboard/usuarios")
  return { success: true }
}
