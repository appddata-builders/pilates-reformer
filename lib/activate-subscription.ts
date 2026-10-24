import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, gte, lte, sql } from "drizzle-orm"
import { withResultTransaction } from "@/lib/db/async-transaction"
import {
  computeSubscriptionEndDate,
  subscriptionEndOfDay,
  toSubscriptionLocalDate,
} from "@/lib/subscription-dates"
import { checkCoupon, priceWithCoupon } from "@/lib/coupons"
import { isSubscriptionCurrent, pickPrimarySubscription } from "@/lib/subscription-display"
import { voidPendingPaymentsForSubscriptions } from "@/lib/payment-cancellation"
import { createNotification } from "@/lib/notifications"
import { planCostPerClass, planIncludedClasses } from "@/lib/plan-quota"

export async function activateSubscriptionForUser(
  db: AnyDb,
  params: {
    userId: string
    planId: string
    startDate?: Date
    billingCycle?: string
    discountPct?: number | null
    discountReason?: string | null
    couponCode?: string | null
    /** Clases sin usar del periodo vencido que se suman al nuevo. */
    carriedClasses?: number
  },
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const [selectedPlan] = await db
    .select()
    .from(schema.plan)
    .where(eq(schema.plan.id, params.planId))
    .limit(1)

  if (!selectedPlan) {
    return { ok: false, error: "Plan no encontrado" }
  }

  if (!selectedPlan.isActive) {
    return { ok: false, error: "El plan no está activo" }
  }

  const startDate = toSubscriptionLocalDate(params.startDate ?? new Date())
  const endDate = computeSubscriptionEndDate(startDate, selectedPlan.durationDays)

  let discountPct = params.discountPct ?? null
  let discountReason = params.discountReason ?? null
  let finalPrice =
    discountPct != null ? selectedPlan.priceMxn * (1 - discountPct) : selectedPlan.priceMxn
  let couponId: string | null = null

  const couponCode = params.couponCode?.trim() ?? ""
  if (couponCode !== "") {
    const check = await checkCoupon(db, couponCode, { userId: params.userId, lock: true })
    if (!check.ok) {
      return { ok: false, error: check.message }
    }
    const priced = priceWithCoupon(check.coupon, selectedPlan.priceMxn)
    finalPrice = priced.finalPrice
    discountPct = priced.discountPct
    discountReason = priced.discountReason
    couponId = check.coupon.id
  }

  // Un plan mensual no trae `totalClasses`: su cupo sale de los días por semana
  // por las semanas que dura. Antes se guardaba `classesRemaining` en NULL y el
  // plan acababa sin tope de ningún tipo.
  const costPerClass = planCostPerClass(selectedPlan, finalPrice)

  const isUnlimited = selectedPlan.isUnlimited ?? false
  const includedClasses = planIncludedClasses(selectedPlan)
  const classesRemaining =
    includedClasses == null ? null : includedClasses + Math.max(0, params.carriedClasses ?? 0)

  const billingCycle = params.billingCycle ?? "mensual"
  const subId = crypto.randomUUID()

  const discountNote =
    discountReason != null && discountReason.startsWith("cupon:")
      ? ` (cupón ${discountReason.slice("cupon:".length)})`
      : discountPct
        ? ` (${Math.round(discountPct * 100)}% desc.)`
        : ""

  await db.insert(schema.subscription).values({
    id: subId,
    userId: params.userId,
    planId: params.planId,
    status: "active",
    startDate,
    endDate,
    classesRemaining,
    daysUsedThisWeek: 0,
    isUnlimited,
    billingCycle,
    discountPct,
    discountReason,
    couponId,
    costPerClass,
    paidAmount: finalPrice,
  })

  await db.insert(schema.payment).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    subscriptionId: subId,
    amount: finalPrice,
    method: billingCycle === "efectivo" ? "efectivo" : "transferencia",
    status: "pending",
    concept: `Suscripción: ${selectedPlan.name}${discountNote}`,
  })

  return { ok: true, amount: finalPrice }
}

/**
 * Cierra las suscripciones activas de un usuario.
 *
 * `status` distingue las dos razones por las que se cierra una: `cancelled` es
 * una baja de verdad (Reportes la cuenta como tal) y `expired` es el cierre
 * administrativo de un periodo que ya venció al renovarlo.
 *
 * `voidPendingCharges` sólo va en la baja explícita: renovar o cambiar de plan
 * no perdona lo que la alumna ya debía.
 */
export async function cancelActiveSubscriptionsForUser(
  db: AnyDb,
  userId: string,
  options?: {
    status?: "cancelled" | "expired"
    voidPendingCharges?: boolean
    actor?: string
    reason?: string
  },
) {
  const closed = await db
    .update(schema.subscription)
    .set({ status: options?.status ?? "cancelled", classesRemaining: 0 })
    .where(
      and(
        eq(schema.subscription.userId, userId),
        eq(schema.subscription.status, "active"),
      ),
    )
    .returning({ id: schema.subscription.id })

  if (options?.voidPendingCharges === true && closed.length > 0) {
    const voided = await voidPendingPaymentsForSubscriptions(db, {
      subscriptionIds: closed.map((row) => row.id),
      actor: options.actor ?? "sistema",
      reason: options.reason ?? "El plan se dio de baja",
    })

    if (voided.voidedAmount > 0) {
      const [user] = await db
        .select({ name: schema.user.name })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1)

      await createNotification(db, {
        userId,
        type: "payment_cancelled",
        title: "Plan dado de baja",
        body: `Hola ${user?.name ?? "Usuario"}, dimos de baja tu plan y su cobro pendiente de ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(voided.voidedAmount)}. Cuando quieras volver, aquí estamos.`,
      })
    }
  }

  return closed.map((row) => row.id)
}

/**
 * Cierra como vencidos los periodos que ya terminaron y devuelve las clases
 * que les quedaban, para sumarlas al periodo nuevo. Lo que la alumna pagó no se
 * pierde porque el plan venza: se redime después o pasa al siguiente plan.
 */
export async function closeExpiredSubscriptionsCarryingClasses(
  db: AnyDb,
  userId: string,
): Promise<number> {
  const active = await db
    .select({
      status: schema.subscription.status,
      endDate: schema.subscription.endDate,
      classesRemaining: schema.subscription.classesRemaining,
      isUnlimited: schema.subscription.isUnlimited,
    })
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.userId, userId),
        eq(schema.subscription.status, "active"),
      ),
    )

  const carried = active.reduce((sum, row) => {
    if (row.isUnlimited === true || isSubscriptionCurrent(row.status, row.endDate)) return sum
    return sum + Math.max(0, row.classesRemaining ?? 0)
  }, 0)

  await cancelActiveSubscriptionsForUser(db, userId, { status: "expired" })
  return carried
}

/**
 * Suscripciones cerradas de las que la alumna no alcanzó a usar nada: mismo
 * cupo con el que nacieron y sin reservas dentro del periodo. Su cobro
 * pendiente es un error de captura, no una venta, y por eso se puede anular.
 *
 * Se mide antes de cerrarlas, porque cerrarlas pone `classesRemaining` en 0.
 */
async function findUntouchedSubscriptions(
  db: AnyDb,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({
      id: schema.subscription.id,
      startDate: schema.subscription.startDate,
      endDate: schema.subscription.endDate,
      classesRemaining: schema.subscription.classesRemaining,
      isUnlimited: schema.subscription.isUnlimited,
      planType: schema.plan.planType,
      daysPerWeek: schema.plan.daysPerWeek,
      totalClasses: schema.plan.totalClasses,
      durationDays: schema.plan.durationDays,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(
      and(
        eq(schema.subscription.userId, userId),
        eq(schema.subscription.status, "active"),
      ),
    )

  const untouched: string[] = []
  for (const row of rows) {
    const included = planIncludedClasses({
      planType: row.planType,
      daysPerWeek: row.daysPerWeek,
      totalClasses: row.totalClasses,
      durationDays: row.durationDays,
      isUnlimited: row.isUnlimited === true,
    })

    // El contador y las reservas deben coincidir antes de anular un cobro.
    if (included != null) {
      if ((row.classesRemaining ?? 0) < included) continue
    }

    // Un plan sin cupo (ilimitado) no deja rastro en el contador: se mira si
    // hubo reservas dentro del periodo.
    const start = toSubscriptionLocalDate(
      row.startDate instanceof Date ? row.startDate : new Date(row.startDate as unknown as number),
    )
    const end = subscriptionEndOfDay(
      row.endDate instanceof Date ? row.endDate : new Date(row.endDate as unknown as number),
    )
    const taken = await db
      .select({ id: schema.booking.id })
      .from(schema.booking)
      .where(
        and(
          eq(schema.booking.userId, userId),
          eq(schema.booking.status, "confirmed"),
          gte(schema.booking.bookingDate, start),
          lte(schema.booking.bookingDate, end),
        ),
      )
      .limit(1)
    if (taken.length === 0) untouched.push(row.id)
  }

  return untouched
}

type ApplyUserPlanParams = {
  userId: string
  planId: string
  billingCycle?: string
  startDate?: Date
  /** Queda registrado en el pago que se anula al dar de baja el plan. */
  actor?: string
  /** Sólo aplica cuando se abre un periodo nuevo: asignar, cambiar o renovar. */
  couponCode?: string | null
}

/**
 * Asigna, renueva, cambia o da de baja el plan desde administración. Bloquea a
 * la alumna durante la operación: dos envíos del formulario leían el mismo
 * estado y podían abrir dos planes con dos cobros. Si el plan nuevo no se
 * puede abrir -un cupón que ya no aplica- se deshace todo y el anterior sigue
 * como estaba.
 */
export async function applyUserPlan(
  db: AnyDb,
  params: ApplyUserPlanParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withResultTransaction(db, async (tx) => {
    await tx.update(schema.user)
      .set({ updatedAt: sql`${schema.user.updatedAt}` })
      .where(eq(schema.user.id, params.userId))
    return applyUserPlanLocked(tx, params)
  })
}

async function applyUserPlanLocked(
  db: AnyDb,
  params: ApplyUserPlanParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const planId = params.planId.trim()

  const activeSubs = await db
    .select({
      id: schema.subscription.id,
      userId: schema.subscription.userId,
      planId: schema.subscription.planId,
      status: schema.subscription.status,
      endDate: schema.subscription.endDate,
    })
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.userId, params.userId),
        eq(schema.subscription.status, "active"),
      ),
    )

  const active = pickPrimarySubscription(activeSubs)
  const couponCode = params.couponCode?.trim() || null

  if (planId === "" && couponCode != null) {
    return { ok: false, error: "Elige un plan para aplicar el cupón" }
  }

  if (planId === "") {
    if (active != null) {
      // Baja explícita: es el único camino que borra lo que quedaba por cobrar.
      await cancelActiveSubscriptionsForUser(db, params.userId, {
        voidPendingCharges: true,
        actor: params.actor ?? "sistema",
        reason: "El plan se dio de baja",
      })
    }
    return { ok: true }
  }

  if (active != null && active.planId === planId) {
    // Mismo plan: si el periodo sigue corriendo no se toca nada, para que
    // reasignarlo por error no duplique el cobro. Ya vencido, se renueva: el
    // periodo nuevo dura lo que diga el plan (7, 15 o 30 días) y trae su propio
    // cobro pendiente, que se suma a lo que la alumna ya debiera.
    if (isSubscriptionCurrent(active.status, active.endDate)) {
      if (couponCode != null) {
        return {
          ok: false,
          error: "Ese plan sigue vigente: el cupón se aplica al asignar, cambiar o renovar un plan",
        }
      }
      return { ok: true }
    }
    const carriedClasses = await closeExpiredSubscriptionsCarryingClasses(db, params.userId)
    // Una renovación arranca hoy a propósito: heredar la fecha del formulario
    // podía abrir un periodo que nacía vencido y pedía renovarse otra vez.
    return activateSubscriptionForUser(db, {
      userId: params.userId,
      planId,
      billingCycle: params.billingCycle,
      carriedClasses,
      couponCode,
    })
  }

  if (active != null && !isSubscriptionCurrent(active.status, active.endDate)) {
    // Periodo vencido y plan distinto: es una renovación con otro plan. Las
    // clases que quedaban pasan al nuevo y el cobro anterior sigue vivo.
    const carriedClasses = await closeExpiredSubscriptionsCarryingClasses(db, params.userId)
    return activateSubscriptionForUser(db, {
      userId: params.userId,
      planId,
      billingCycle: params.billingCycle,
      startDate: params.startDate,
      carriedClasses,
      couponCode,
    })
  }

  let carriedClasses = 0
  if (active != null) {
    // Cambio de plan: se cierra el anterior. Su adeudo sigue vivo si alcanzó a
    // usarlo -esas clases se dieron y se cobran-, pero si no consumió nada el
    // cobro pendiente se anula: fue una corrección del plan, no una venta, y
    // dejarlo vivo le facturaba a la alumna dos planes por el mismo periodo.
    const untouched = await findUntouchedSubscriptions(db, params.userId)
    // Las clases que le quedaban a un plan ya usado pasan al nuevo: su cobro
    // sigue vivo, así que son clases pagadas y no se pierden con el cambio. Uno
    // sin usar no pasa sus clases propias, porque su cobro se anula, pero sí
    // las que había heredado de un plan anterior: esas ya estaban pagadas.
    const activeRows = await db
      .select({
        id: schema.subscription.id,
        classesRemaining: schema.subscription.classesRemaining,
        isUnlimited: schema.subscription.isUnlimited,
        planType: schema.plan.planType,
        daysPerWeek: schema.plan.daysPerWeek,
        totalClasses: schema.plan.totalClasses,
        durationDays: schema.plan.durationDays,
      })
      .from(schema.subscription)
      .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
      .where(
        and(
          eq(schema.subscription.userId, params.userId),
          eq(schema.subscription.status, "active"),
        ),
      )
    carriedClasses = activeRows.reduce((sum, row) => {
      if (row.isUnlimited === true) return sum
      const remaining = Math.max(0, row.classesRemaining ?? 0)
      if (!untouched.includes(row.id)) return sum + remaining
      const included = planIncludedClasses({
        planType: row.planType,
        daysPerWeek: row.daysPerWeek,
        totalClasses: row.totalClasses,
        durationDays: row.durationDays,
        isUnlimited: false,
      }) ?? 0
      return sum + Math.max(0, remaining - included)
    }, 0)
    const closed = await cancelActiveSubscriptionsForUser(db, params.userId)
    const toVoid = closed.filter((id) => untouched.includes(id))

    if (toVoid.length > 0) {
      const voided = await voidPendingPaymentsForSubscriptions(db, {
        subscriptionIds: toVoid,
        actor: params.actor ?? "sistema",
        reason: "Se cambió el plan antes de usarlo",
      })

      if (voided.voidedAmount > 0) {
        const [user] = await db
          .select({ name: schema.user.name })
          .from(schema.user)
          .where(eq(schema.user.id, params.userId))
          .limit(1)

        await createNotification(db, {
          userId: params.userId,
          type: "payment_cancelled",
          title: "Cambio de plan",
          body: `Hola ${user?.name ?? "Usuario"}, cambiamos tu plan antes de que lo usaras, así que cancelamos su cobro de ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(voided.voidedAmount)}. Sólo se te cobrará el plan nuevo.`,
        })
      }
    }
  }

  return activateSubscriptionForUser(db, {
    userId: params.userId,
    planId,
    billingCycle: params.billingCycle,
    startDate: params.startDate,
    carriedClasses,
    couponCode,
  })
}
