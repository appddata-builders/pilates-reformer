import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, count, eq, gt, gte, isNull, ne, notExists } from "drizzle-orm"
import { INDIVIDUAL_CLASS_PLAN_ID } from "@/lib/class-charge"
import { toLocalDateStr } from "@/lib/booking-slot-options"
import { subscriptionEndOfDay } from "@/lib/subscription-dates"
import { planIncludedClasses } from "@/lib/plan-quota"

export type ActivePlanSummary = {
  name: string
  /** Fin de vigencia en YYYY-MM-DD, para formatear del lado del cliente. */
  endDate: string
  /** Días completos que faltan; 0 es "vence hoy". */
  daysLeft: number
  /** El periodo ya venció y sólo se están tomando las clases que sobraron. */
  expired: boolean
  /** Días que abarca la vigencia completa, para dibujar la barra de avance. */
  totalDays: number
  classesRemaining: number | null
  isUnlimited: boolean
  /** Clases sugeridas por semana; no es un tope. */
  daysPerWeek: number | null
  /** Clases del plan ya usadas (reservadas o tomadas), el "3" de "3 de 12". */
  classesUsed: number
  /** Clases del periodo, el "12" de "3 de 12". `null` en el ilimitado. */
  classesTotal: number | null
}

export type PlanProgress = {
  used: number
  /** `null` en el plan ilimitado: no hay de cuántas. */
  total: number | null
}

/**
 * Cuántas clases lleva la alumna de su plan y de cuántas ("3 de 12").
 *
 * El total no se guarda en la suscripción, así que se reconstruye: lo que le
 * queda más las reservas confirmadas que hizo desde que contrató el plan, sin
 * la clase muestra ni las individuales (las mismas que, al cancelarse, no
 * devuelven clase). Eso incluye las clases que pasaron del plan anterior. Nunca
 * baja de lo que el plan incluye, por si una clase se descontó de otra forma.
 */
export async function loadPlanProgress(
  db: AnyDb,
  subscriptionId: string,
): Promise<PlanProgress | undefined> {
  const [row] = await db
    .select({
      userId: schema.subscription.userId,
      createdAt: schema.subscription.createdAt,
      classesRemaining: schema.subscription.classesRemaining,
      isUnlimited: schema.subscription.isUnlimited,
      planType: schema.plan.planType,
      daysPerWeek: schema.plan.daysPerWeek,
      totalClasses: schema.plan.totalClasses,
      durationDays: schema.plan.durationDays,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(eq(schema.subscription.id, subscriptionId))
    .limit(1)
  if (row == null) return undefined

  const createdAt =
    row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as unknown as number)
  const individualCharge = db
    .select({ id: schema.payment.id })
    .from(schema.payment)
    .where(and(eq(schema.payment.bookingId, schema.booking.id), isNull(schema.payment.subscriptionId)))
  const [counted] = await db
    .select({ n: count() })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.userId, row.userId),
        eq(schema.booking.status, "confirmed"),
        eq(schema.booking.trialClass, false),
        gte(schema.booking.createdAt, createdAt),
        notExists(individualCharge),
      ),
    )
  const booked = Number(counted?.n ?? 0)

  if (row.isUnlimited === true) return { used: booked, total: null }

  const remaining = Math.max(0, row.classesRemaining ?? 0)
  const included =
    planIncludedClasses({
      planType: row.planType,
      daysPerWeek: row.daysPerWeek,
      totalClasses: row.totalClasses,
      durationDays: row.durationDays,
      isUnlimited: false,
    }) ?? 0
  const total = Math.max(included, booked + remaining)
  return { used: total - remaining, total }
}

export type SuggestedPlan = {
  id: string
  name: string
  priceMxn: number
  totalClasses: number | null
  isUnlimited: boolean
}


/** Plan vigente de la alumna, resumido para la tarjeta del modal. */
export async function loadActivePlanSummary(
  db: AnyDb,
  subscriptionId: string,
): Promise<ActivePlanSummary | undefined> {
  const [row] = await db
    .select({
      name: schema.plan.name,
      planType: schema.plan.planType,
      daysPerWeek: schema.plan.daysPerWeek,
      startDate: schema.subscription.startDate,
      endDate: schema.subscription.endDate,
      classesRemaining: schema.subscription.classesRemaining,
      isUnlimited: schema.subscription.isUnlimited,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(eq(schema.subscription.id, subscriptionId))
    .limit(1)

  if (row == null) return undefined

  const progress = await loadPlanProgress(db, subscriptionId)

  const end = subscriptionEndOfDay(
    row.endDate instanceof Date ? row.endDate : new Date(row.endDate as unknown as number),
  )
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const daysLeft = Math.max(
    0,
    Math.floor((end.getTime() - startOfToday.getTime()) / 86_400_000),
  )
  const expired = end.getTime() < Date.now()

  const start =
    row.startDate instanceof Date
      ? row.startDate
      : new Date(row.startDate as unknown as number)
  const totalDays = Math.max(
    1,
    Math.round((subscriptionEndOfDay(end).getTime() - start.getTime()) / 86_400_000),
  )

  // Todo plan con cupo lleva cuenta: el mensual también, porque su total sale
  // de los días por semana por las semanas del periodo. Sólo el ilimitado no.
  const countsClasses = row.isUnlimited !== true

  return {
    name: row.name,
    endDate: toLocalDateStr(end),
    daysLeft,
    expired,
    totalDays,
    classesRemaining: countsClasses ? (row.classesRemaining ?? 0) : null,
    isUnlimited: row.isUnlimited === true,
    daysPerWeek: row.daysPerWeek > 0 ? row.daysPerWeek : null,
    classesUsed: progress?.used ?? 0,
    classesTotal: progress?.total ?? null,
  }
}

/** Planes públicos que valen la pena frente a pagar la clase suelta. */
export async function loadSuggestedPlans(
  db: AnyDb,
): Promise<SuggestedPlan[]> {
  const rows = await db
    .select({
      id: schema.plan.id,
      name: schema.plan.name,
      priceMxn: schema.plan.priceMxn,
      totalClasses: schema.plan.totalClasses,
      isUnlimited: schema.plan.isUnlimited,
    })
    .from(schema.plan)
    .where(
      and(
        eq(schema.plan.isActive, true),
        eq(schema.plan.isPublic, true),
        eq(schema.plan.isAddOn, false),
        gt(schema.plan.priceMxn, 0),
        ne(schema.plan.id, INDIVIDUAL_CLASS_PLAN_ID),
      ),
    )
    .orderBy(asc(schema.plan.priceMxn))
    .limit(3)

  return rows
}
