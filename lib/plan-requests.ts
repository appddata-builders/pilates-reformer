import { and, asc, eq, gt, inArray, isNotNull, ne } from "drizzle-orm"
import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  activateSubscriptionForUser,
  cancelActiveSubscriptionsForUser,
} from "@/lib/activate-subscription"
import { INDIVIDUAL_CLASS_PLAN_ID } from "@/lib/class-charge"
import { createNotification } from "@/lib/notifications"
import { subscriptionEndOfDay } from "@/lib/subscription-dates"
import { isSubscriptionCurrent, pickPrimarySubscription } from "@/lib/subscription-display"

/**
 * La alumna pide o renueva su plan desde "Mis planes". Reglas del estudio:
 * - el plan queda activo de inmediato, a cuenta: reserva desde ya y el cobro
 *   nace pendiente hasta que el admin lo confirma en Pagos;
 * - no se pide ni se renueva un plan si se debe el anterior (las clases
 *   individuales pendientes no cuentan);
 * - se renueva cuando termina el periodo, igual que cuando lo renueva el admin:
 *   dos periodos activos a la vez confundirían qué plan cubre cada reserva.
 */

export type RequestablePlan = {
  id: string
  name: string
  planType: string
  daysPerWeek: number
  durationDays: number
  totalClasses: number | null
  priceMxn: number
}

/** Planes públicos con precio; la clase muestra y la individual no son planes. */
export async function listRequestablePlans(db: AnyDb): Promise<RequestablePlan[]> {
  return db
    .select({
      id: schema.plan.id,
      name: schema.plan.name,
      planType: schema.plan.planType,
      daysPerWeek: schema.plan.daysPerWeek,
      durationDays: schema.plan.durationDays,
      totalClasses: schema.plan.totalClasses,
      priceMxn: schema.plan.priceMxn,
    })
    .from(schema.plan)
    .where(
      and(
        eq(schema.plan.isActive, true),
        eq(schema.plan.isPublic, true),
        gt(schema.plan.priceMxn, 0),
        ne(schema.plan.id, INDIVIDUAL_CLASS_PLAN_ID),
      ),
    )
    .orderBy(asc(schema.plan.durationDays), asc(schema.plan.priceMxn))
}

/** Lo que se debe de planes: cobros pendientes ligados a una suscripción. */
async function pendingPlanDebt(db: AnyDb, userId: string): Promise<number> {
  const rows = await db
    .select({ amount: schema.payment.amount })
    .from(schema.payment)
    .where(
      and(
        eq(schema.payment.userId, userId),
        eq(schema.payment.status, "pending"),
        isNotNull(schema.payment.subscriptionId),
      ),
    )
  return rows.reduce((sum, row) => sum + row.amount, 0)
}

async function loadPrimarySubscription(db: AnyDb, userId: string) {
  const subs = await db
    .select({
      id: schema.subscription.id,
      userId: schema.subscription.userId,
      planId: schema.subscription.planId,
      planName: schema.plan.name,
      status: schema.subscription.status,
      startDate: schema.subscription.startDate,
      endDate: schema.subscription.endDate,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(and(eq(schema.subscription.userId, userId), eq(schema.subscription.status, "active")))
  return pickPrimarySubscription(subs)
}

function toDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value)
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

export type PlanRequestState = {
  plans: RequestablePlan[]
  pendingPlanDebt: number
  /** Plan con periodo en curso: no se pide otro hasta que termine. */
  current: { planName: string; endDate: Date } | null
  /** Plan cuyo periodo ya terminó: se puede renovar o elegir otro. */
  renewable: { planId: string; planName: string; endDate: Date; available: boolean } | null
}

export async function getPlanRequestState(db: AnyDb, userId: string): Promise<PlanRequestState> {
  const [plans, debt, primary] = await Promise.all([
    listRequestablePlans(db),
    pendingPlanDebt(db, userId),
    loadPrimarySubscription(db, userId),
  ])

  const state: PlanRequestState = { plans, pendingPlanDebt: debt, current: null, renewable: null }
  if (primary == null) return state

  const endDate = toDate(primary.endDate)
  if (isSubscriptionCurrent(primary.status, endDate)) {
    state.current = { planName: primary.planName, endDate }
  } else {
    state.renewable = {
      planId: primary.planId,
      planName: primary.planName,
      endDate,
      available: plans.some((p) => p.id === primary.planId),
    }
  }
  return state
}

export type PlanRequestResult = { ok: true; message: string } | { ok: false; error: string }

async function notifyStaff(db: AnyDb, title: string, body: string): Promise<void> {
  const staff = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(inArray(schema.user.role, ["admin", "root"]), ne(schema.user.enabled, false)))
  for (const row of staff) {
    await createNotification(db, { userId: row.id, type: "plan_requested", title, body })
  }
}

/** Solicitar un plan, o renovar el que terminó (`renewal`). */
export async function requestPlan(
  db: AnyDb,
  params: { userId: string; planId: string; renewal?: boolean },
): Promise<PlanRequestResult> {
  const [user] = await db
    .select({ name: schema.user.name, role: schema.user.role, enabled: schema.user.enabled })
    .from(schema.user)
    .where(eq(schema.user.id, params.userId))
    .limit(1)
  if (user == null || user.enabled === false || user.role !== "alumno") {
    return { ok: false, error: "Esta cuenta no puede solicitar planes" }
  }

  const state = await getPlanRequestState(db, params.userId)
  const plan = state.plans.find((p) => p.id === params.planId)
  if (plan == null) {
    return { ok: false, error: "Ese plan ya no está disponible. Elige otro." }
  }
  if (state.pendingPlanDebt > 0) {
    return {
      ok: false,
      error: `Debes ${formatMxn(state.pendingPlanDebt)} de tu plan anterior. Págalo en el estudio y después podrás ${params.renewal ? "renovar" : "solicitar otro"}.`,
    }
  }
  if (state.current != null) {
    return {
      ok: false,
      error: `Tu ${state.current.planName} sigue vigente hasta el ${formatDay(state.current.endDate)}. Cuando termine podrás renovarlo o elegir otro.`,
    }
  }

  // El periodo anterior terminó: se cierra como vencido, no como baja.
  if (state.renewable != null) {
    await cancelActiveSubscriptionsForUser(db, params.userId, { status: "expired" })
  }

  const activated = await activateSubscriptionForUser(db, {
    userId: params.userId,
    planId: plan.id,
  })
  if (!activated.ok) return { ok: false, error: activated.error }

  const created = await loadPrimarySubscription(db, params.userId)
  const endLabel = created != null ? formatDay(toDate(created.endDate)) : ""
  const name = user.name?.trim() || "Usuario"
  const isRenewal = state.renewable != null && state.renewable.planId === plan.id

  await createNotification(db, {
    userId: params.userId,
    type: "plan_requested",
    title: isRenewal ? "Renovaste tu plan" : "Tu plan quedó activo",
    body: `Hola ${name}, ${plan.name} está activo hasta el ${endLabel}. Ya puedes reservar. Quedó pendiente el pago de ${formatMxn(plan.priceMxn)}: págalo en el estudio y ahí lo registran.`,
  })
  await notifyStaff(
    db,
    `${name} ${isRenewal ? "renovó" : "solicitó"} ${plan.name}`,
    `Quedó activo a cuenta hasta el ${endLabel}, con ${formatMxn(plan.priceMxn)} pendiente. Confírmalo en Pagos cuando lo recibas.`,
  )

  return {
    ok: true,
    message: `${plan.name} quedó activo hasta el ${endLabel}. Paga ${formatMxn(plan.priceMxn)} en el estudio.`,
  }
}

/**
 * Avisa a la alumna que su plan está por vencer (con los días de
 * Configuración) o que ya terminó. Se llama al abrir el panel, como los
 * cumpleaños: no hay tareas programadas. Cada aviso sale una sola vez.
 */
export async function sendPlanRenewalReminders(db: AnyDb, userId: string): Promise<void> {
  const primary = await loadPrimarySubscription(db, userId)
  if (primary == null) return

  const [policy] = await db
    .select({ days: schema.studioPolicy.alertDaysBeforeExpiry })
    .from(schema.studioPolicy)
    .limit(1)
  const daysBefore = policy?.days ?? 3

  const endDate = toDate(primary.endDate)
  const endOfPeriod = subscriptionEndOfDay(endDate)
  const now = new Date()
  const msLeft = endOfPeriod.getTime() - now.getTime()

  let title: string
  let body: string
  if (msLeft < 0) {
    title = `Tu plan terminó el ${formatDay(endDate)}`
    body = `Tu ${primary.planName} ya terminó. Renuévalo en «Mis planes» para seguir reservando con tu plan.`
  } else if (msLeft <= daysBefore * 24 * 60 * 60 * 1000) {
    title = `Tu plan vence el ${formatDay(endDate)}`
    body = `Tu ${primary.planName} vence el ${formatDay(endDate)}. Cuando termine podrás renovarlo en «Mis planes».`
  } else {
    return
  }

  const [already] = await db
    .select({ id: schema.notification.id })
    .from(schema.notification)
    .where(
      and(
        eq(schema.notification.userId, userId),
        eq(schema.notification.type, "plan_expiry"),
        eq(schema.notification.title, title),
      ),
    )
    .limit(1)
  if (already != null) return

  await createNotification(db, { userId, type: "plan_expiry", title, body })
}
