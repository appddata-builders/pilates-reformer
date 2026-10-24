export const dynamic = "force-dynamic"

import { desc } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { countCouponUsers } from "@/lib/coupons"
import { studioDateStrFromInstant } from "@/lib/studio-month"
import { CuponesFormsClient, type CouponRow } from "./cupones-forms"

function toDateOrNull(value: Date | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return value
  return new Date(value)
}

function toDateInputValue(value: Date | null): string {
  if (value == null) return ""
  return studioDateStrFromInstant(value)
}

export default async function CuponesPage() {
  const db = getDb()
  const [rows, usersByCoupon] = await Promise.all([
    db.select().from(schema.coupon).orderBy(desc(schema.coupon.createdAt)),
    countCouponUsers(db),
  ])

  const cupones: CouponRow[] = rows.map((c) => {
    const validFrom = toDateOrNull(c.validFrom as Date | number | null)
    const validUntil = toDateOrNull(c.validUntil as Date | number | null)
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxUses: c.maxUses,
      usedBy: usersByCoupon.get(c.id) ?? 0,
      validFrom: toDateInputValue(validFrom),
      validUntil: toDateInputValue(validUntil),
      isActive: c.isActive,
    }
  })

  return <CuponesFormsClient cupones={cupones} />
}
