export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { sortPlansByDisplayOrder } from "@/lib/site/plans"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { getPendingBalance } from "@/lib/class-charge"
import { isSubscriptionCurrent } from "@/lib/subscription-display"
import { PlanesFormsClient } from "./planes-forms"
import { MisPlanes, type MiPlanRow } from "./mis-planes"

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as number)
}

export default async function PlanesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = session?.user?.role ?? ""
  const userId = getSessionUserId(session?.user)
  const db = getDb()

  // La alumna ve lo que contrató; el admin, el catálogo que administra.
  if (isAlumnoRole(role) && userId != null) {
    const rows = await db
      .select({
        id: schema.subscription.id,
        status: schema.subscription.status,
        startDate: schema.subscription.startDate,
        endDate: schema.subscription.endDate,
        classesRemaining: schema.subscription.classesRemaining,
        isUnlimited: schema.subscription.isUnlimited,
        paidAmount: schema.subscription.paidAmount,
        planName: schema.plan.name,
        planType: schema.plan.planType,
      })
      .from(schema.subscription)
      .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
      .where(eq(schema.subscription.userId, userId))
      .orderBy(desc(schema.subscription.startDate))

    const misPlanes: MiPlanRow[] = rows.map((row) => {
      const endDate = toDate(row.endDate)
      return {
        id: row.id,
        planName: row.planName,
        planType: row.planType,
        status: row.status,
        startDate: toDate(row.startDate),
        endDate,
        classesRemaining: row.classesRemaining,
        isUnlimited: row.isUnlimited,
        paidAmount: row.paidAmount,
        vigente: isSubscriptionCurrent(row.status, endDate),
      }
    })

    const pendingBalance = await getPendingBalance(db, userId)
    return <MisPlanes rows={misPlanes} pendingBalance={pendingBalance} />
  }

  const planes = await db
    .select()
    .from(schema.plan)
    .where(eq(schema.plan.isActive, true))
    .orderBy(schema.plan.createdAt)

  const catalogo = sortPlansByDisplayOrder(
    planes
      .filter((p) => p.planType !== "add_on")
      .map((p) => ({
        id: p.id,
        name: p.name,
        planType: p.planType,
        daysPerWeek: p.daysPerWeek,
        totalClasses: p.totalClasses,
        priceMxn: p.priceMxn,
        durationDays: p.durationDays,
        isActive: p.isActive,
        isPublic: p.isPublic,
      })),
  )

  return <PlanesFormsClient planes={catalogo} />
}
