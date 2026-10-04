import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gt, inArray, isNull, ne } from "drizzle-orm"
import { createNotification } from "@/lib/notifications"
import { formatTime12h } from "@/lib/time-utils"

export const INDIVIDUAL_CLASS_PLAN_ID = "plan-individual"

/**
 * Precio de la clase suelta: el plan `plan-individual` y, si no existe, el
 * paquete activo más barato de una sola clase con precio mayor a cero.
 */
export async function getIndividualClassPlan(
  db: AnyDb,
): Promise<{ id: string; name: string; priceMxn: number } | null> {
  const [exact] = await db
    .select({
      id: schema.plan.id,
      name: schema.plan.name,
      priceMxn: schema.plan.priceMxn,
    })
    .from(schema.plan)
    .where(and(eq(schema.plan.id, INDIVIDUAL_CLASS_PLAN_ID), eq(schema.plan.isActive, true)))
    .limit(1)

  if (exact != null) return exact

  // La cortesía "Clase Muestra" también es un paquete de 1 clase, pero vale 0:
  // si se colara aquí, cada clase suelta se cobraría en cero.
  const [fallback] = await db
    .select({
      id: schema.plan.id,
      name: schema.plan.name,
      priceMxn: schema.plan.priceMxn,
    })
    .from(schema.plan)
    .where(
      and(
        eq(schema.plan.isActive, true),
        eq(schema.plan.totalClasses, 1),
        gt(schema.plan.priceMxn, 0),
      ),
    )
    .orderBy(asc(schema.plan.priceMxn))
    .limit(1)

  return fallback ?? null
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

export type ClassChargeResult =
  | { ok: true; amount: number; concept: string }
  | { ok: false; error: string }

/**
 * Registra el adeudo de una clase que no quedó cubierta por un plan vigente.
 * El pago nace en `pending`: es el admin quien lo marca como recibido.
 */
export async function chargeIndividualClass(
  db: AnyDb,
  params: {
    userId: string
    userName: string
    className: string
    bookingDate: Date
    startTime: string
    /** Reserva que originó el cobro: al cancelarla, el adeudo se anula. */
    bookingId?: string | null
  },
): Promise<ClassChargeResult> {
  const plan = await getIndividualClassPlan(db)
  if (plan == null) {
    return { ok: false, error: "No hay un plan de clase individual configurado" }
  }

  const fechaLabel = params.bookingDate.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  })
  const concept = `Clase individual · ${params.className} ${fechaLabel} ${formatTime12h(params.startTime)}`

  await db.insert(schema.payment).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    bookingId: params.bookingId ?? null,
    amount: plan.priceMxn,
    method: "efectivo",
    status: "pending",
    concept,
  })

  await createNotification(db, {
    userId: params.userId,
    type: "class_charge_pending",
    title: "Clase reservada, pago pendiente",
    body: `Hola ${params.userName}, apartamos tu lugar en ${params.className} del ${fechaLabel}. Queda pendiente el pago de ${formatMxn(plan.priceMxn)}; el estudio lo registra cuando lo recibe.`,
  })

  return { ok: true, amount: plan.priceMxn, concept }
}

/**
 * Aviso al staff cuando una reserva se quedó sin adeudo por falta de un plan de
 * clase individual: si nadie lo ve, esa clase se regala en silencio.
 */
export async function notifyStaffChargeNotRegistered(
  db: AnyDb,
  params: { userName: string; className: string; bookingDate: Date },
): Promise<void> {
  const staff = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      and(
        inArray(schema.user.role, ["admin", "root"]),
        ne(schema.user.enabled, false),
      ),
    )

  if (staff.length === 0) return

  const fechaLabel = params.bookingDate.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  })

  for (const row of staff) {
    await createNotification(db, {
      userId: row.id,
      type: "class_charge_missing_plan",
      title: "Clase reservada sin adeudo",
      body: `${params.userName} reservó ${params.className} del ${fechaLabel} sin plan que la cubra, pero no hay un plan de clase individual activo, así que no se registró ningún cobro. Configura el plan "Clase Individual" y cobra esa clase a mano.`,
    })
  }
}

export async function hasUsedTrialClass(db: AnyDb, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ usedAt: schema.user.trialClassUsedAt })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  return row?.usedAt != null
}

export type TrialClassResult = { ok: true } | { ok: false; error: string }

/**
 * Redime la clase muestra. La marca se escribe condicionada a que siga en NULL,
 * para que dos reservas simultáneas no puedan gastar la misma cortesía. La
 * reserva queda marcada para devolver la cortesía si se cancela.
 */
export async function consumeTrialClass(
  db: AnyDb,
  params: {
    userId: string
    userName: string
    className: string
    bookingDate: Date
    bookingId: string
  },
): Promise<TrialClassResult> {
  const marked = await db
    .update(schema.user)
    .set({ trialClassUsedAt: new Date() })
    .where(and(eq(schema.user.id, params.userId), isNull(schema.user.trialClassUsedAt)))
    .returning({ id: schema.user.id })

  if (marked.length === 0) {
    return { ok: false, error: "Ya redimiste tu clase muestra" }
  }

  await db
    .update(schema.booking)
    .set({ trialClass: true })
    .where(eq(schema.booking.id, params.bookingId))

  const fechaLabel = params.bookingDate.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  })

  await createNotification(db, {
    userId: params.userId,
    type: "trial_class",
    title: "Clase muestra confirmada",
    body: `Hola ${params.userName}, tu clase muestra de ${params.className} del ${fechaLabel} quedó apartada sin costo. Es una cortesía de una sola vez; las siguientes se cobran o van con tu plan.`,
  })

  return { ok: true }
}

/** Devuelve la clase muestra cuando se cancela la reserva que la usó. */
export async function restoreTrialClass(
  db: AnyDb,
  params: { userId: string; userName: string },
): Promise<void> {
  await db
    .update(schema.user)
    .set({ trialClassUsedAt: null })
    .where(eq(schema.user.id, params.userId))

  await createNotification(db, {
    userId: params.userId,
    type: "trial_class",
    title: "Tu clase muestra está disponible",
    body: `Hola ${params.userName}, cancelaste tu clase muestra. Sigue disponible para que la uses en otra fecha.`,
  })
}

/**
 * Anula el adeudo de una clase que se canceló. Sólo toca cobros que siguen
 * pendientes: si el estudio ya lo cobró, el reembolso es decisión humana.
 */
export async function voidPendingChargeForBooking(
  db: AnyDb,
  params: { bookingId: string; userId: string; userName: string },
): Promise<{ voidedAmount: number }> {
  const rows = await db
    .update(schema.payment)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "sistema",
      cancelReason: "La reserva se canceló",
    })
    .where(
      and(
        eq(schema.payment.bookingId, params.bookingId),
        eq(schema.payment.status, "pending"),
        eq(schema.payment.isNegative, false),
      ),
    )
    .returning({ amount: schema.payment.amount })

  const voidedAmount = rows.reduce((sum, row) => sum + row.amount, 0)
  if (voidedAmount <= 0) return { voidedAmount: 0 }

  await createNotification(db, {
    userId: params.userId,
    type: "class_charge_voided",
    title: "Adeudo cancelado",
    body: `Hola ${params.userName}, al cancelar tu clase dimos de baja el pago pendiente de ${formatMxn(voidedAmount)}. Ya no aparece en tu cuenta.`,
  })

  return { voidedAmount }
}

/** Saldo pendiente de la cuenta, para mostrárselo a la alumna. */
export async function getPendingBalance(db: AnyDb, userId: string): Promise<number> {
  const rows = await db
    .select({ amount: schema.payment.amount })
    .from(schema.payment)
    .where(
      and(
        eq(schema.payment.userId, userId),
        eq(schema.payment.status, "pending"),
        eq(schema.payment.isNegative, false),
      ),
    )

  return rows.reduce((sum, row) => sum + row.amount, 0)
}
