import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, isNotNull, ne, sql } from "drizzle-orm"
import { STUDIO_TIMEZONE, studioDateStrFromInstant } from "@/lib/studio-month"
import {
  couponDiscountLabel,
  normalizeCouponCode,
  priceAfterCoupon,
} from "@/lib/coupon-pricing"

/**
 * Un cupón se limita por usuarios y por fechas:
 * - `maxUses` es cuántos usuarios distintos pueden usarlo; cada uno, una vez.
 * - `validFrom` y `validUntil` son días completos del estudio (hora de la
 *   Ciudad de México), los dos incluidos.
 *
 * Los usos no se llevan en un contador: se cuentan desde las suscripciones que
 * traen el cupón (`subscription.couponId`) y cuyo cobro sigue en pie. Si el
 * cobro se anula -cambio de plan antes de usarlo, baja, pago mal capturado- el
 * lugar regresa al cupón y ese usuario puede volver a usarlo.
 */

export type CouponRow = {
  id: string
  code: string
  name: string
  discountType: string
  discountValue: number
  maxUses: number | null
  validFrom: Date | null
  validUntil: Date | null
  isActive: boolean
}

export type CouponCheck = { ok: true; coupon: CouponRow } | { ok: false; message: string }

export type CouponPrice = {
  finalPrice: number
  discountPct: number | null
  discountReason: string
  discountLabel: string
}

export type CouponPreview =
  | { ok: true; listPrice: number; finalPrice: number; discountLabel: string }
  | { ok: false; message: string }

export { normalizeCouponCode, priceAfterCoupon, couponDiscountLabel }

function toDateOrNull(value: Date | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return value
  return new Date(value)
}

function formatStudioDay(instant: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: STUDIO_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(instant)
}

export async function findCouponByCode(
  db: AnyDb,
  codeRaw: string,
): Promise<CouponRow | null> {
  const code = normalizeCouponCode(codeRaw)
  if (code === "") return null

  const [row] = await db
    .select({
      id: schema.coupon.id,
      code: schema.coupon.code,
      name: schema.coupon.name,
      discountType: schema.coupon.discountType,
      discountValue: schema.coupon.discountValue,
      maxUses: schema.coupon.maxUses,
      validFrom: schema.coupon.validFrom,
      validUntil: schema.coupon.validUntil,
      isActive: schema.coupon.isActive,
    })
    .from(schema.coupon)
    .where(eq(schema.coupon.code, code))
    .limit(1)

  if (row == null) return null

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxUses: row.maxUses,
    validFrom: toDateOrNull(row.validFrom as Date | number | null),
    validUntil: toDateOrNull(row.validUntil as Date | number | null),
    isActive: row.isActive,
  }
}

/** Reglas del cupón mismo: activo, dentro de sus fechas y con un descuento válido. */
export function couponUnavailableReason(coupon: CouponRow, now: Date): string | null {
  if (!coupon.isActive) {
    return "Este cupón no está activo"
  }

  const today = studioDateStrFromInstant(now)
  if (coupon.validFrom != null && today < studioDateStrFromInstant(coupon.validFrom)) {
    return `Este cupón es válido a partir del ${formatStudioDay(coupon.validFrom)}`
  }
  if (coupon.validUntil != null && today > studioDateStrFromInstant(coupon.validUntil)) {
    return "Este cupón ya venció"
  }

  if (coupon.discountType === "percent") {
    if (coupon.discountValue <= 0 || coupon.discountValue > 100) {
      return "El porcentaje del cupón no es válido"
    }
  } else if (coupon.discountType === "fixed") {
    if (coupon.discountValue <= 0) {
      return "El monto del cupón no es válido"
    }
  } else {
    return "Tipo de descuento de cupón inválido"
  }

  return null
}

/** Usuarios que usan el cupón con un cobro en pie. */
async function couponUsers(db: AnyDb, couponId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: schema.subscription.userId })
    .from(schema.subscription)
    .innerJoin(schema.payment, eq(schema.payment.subscriptionId, schema.subscription.id))
    .where(
      and(
        eq(schema.subscription.couponId, couponId),
        ne(schema.payment.status, "cancelled"),
      ),
    )
  return rows.map((row) => row.userId)
}

/** Usuarios por cupón, para el listado de Cupones. */
export async function countCouponUsers(db: AnyDb): Promise<Map<string, number>> {
  const rows = await db
    .select({
      couponId: schema.subscription.couponId,
      users: sql<number>`count(distinct ${schema.subscription.userId})`,
    })
    .from(schema.subscription)
    .innerJoin(schema.payment, eq(schema.payment.subscriptionId, schema.subscription.id))
    .where(
      and(
        isNotNull(schema.subscription.couponId),
        ne(schema.payment.status, "cancelled"),
      ),
    )
    .groupBy(schema.subscription.couponId)

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.couponId != null) counts.set(row.couponId, Number(row.users))
  }
  return counts
}

/**
 * ¿Puede `userId` usar el cupón hoy? Sin `userId` -una cuenta que aún no
 * existe- sólo se revisan el cupón y su límite de usuarios.
 *
 * Con `lock`, el cupón queda bloqueado hasta que termine la transacción: dos
 * usuarios que piden el último lugar al mismo tiempo no se lo llevan los dos.
 * Por eso se llama dentro de la transacción que crea la suscripción.
 */
export async function checkCoupon(
  db: AnyDb,
  codeRaw: string,
  params: { userId: string | null; lock?: boolean; now?: Date },
): Promise<CouponCheck> {
  const coupon = await findCouponByCode(db, codeRaw)
  if (coupon == null) {
    return { ok: false, message: "Cupón no encontrado" }
  }

  const reason = couponUnavailableReason(coupon, params.now ?? new Date())
  if (reason != null) {
    return { ok: false, message: reason }
  }

  if (params.lock === true) {
    await db.update(schema.coupon)
      .set({ code: sql`${schema.coupon.code}` })
      .where(eq(schema.coupon.id, coupon.id))
  }

  const users = await couponUsers(db, coupon.id)
  if (params.userId != null && users.includes(params.userId)) {
    return { ok: false, message: "Este cupón ya se usó en esta cuenta" }
  }
  if (coupon.maxUses != null && users.length >= coupon.maxUses) {
    return { ok: false, message: "Este cupón ya alcanzó su límite de usuarios" }
  }

  return { ok: true, coupon }
}

export function priceWithCoupon(coupon: CouponRow, priceMxn: number): CouponPrice {
  return {
    finalPrice: priceAfterCoupon(priceMxn, coupon.discountType, coupon.discountValue),
    discountPct: coupon.discountType === "percent" ? coupon.discountValue / 100 : null,
    discountReason: `cupon:${coupon.code}`,
    discountLabel: couponDiscountLabel(coupon.discountType, coupon.discountValue),
  }
}

/** Precio con el cupón antes de guardar, para mostrarlo en el formulario. */
export async function previewCoupon(
  db: AnyDb,
  params: { code: string; planId: string; userId: string | null },
): Promise<CouponPreview> {
  if (normalizeCouponCode(params.code) === "") {
    return { ok: false, message: "Escribe un código de cupón" }
  }

  const [plan] = await db
    .select({ priceMxn: schema.plan.priceMxn, isActive: schema.plan.isActive })
    .from(schema.plan)
    .where(eq(schema.plan.id, params.planId))
    .limit(1)
  if (plan == null || !plan.isActive) {
    return { ok: false, message: "Elige un plan para aplicar el cupón" }
  }

  const check = await checkCoupon(db, params.code, { userId: params.userId })
  if (!check.ok) return check

  const priced = priceWithCoupon(check.coupon, plan.priceMxn)
  return {
    ok: true,
    listPrice: plan.priceMxn,
    finalPrice: priced.finalPrice,
    discountLabel: priced.discountLabel,
  }
}
