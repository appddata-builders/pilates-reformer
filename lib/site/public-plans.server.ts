import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  buildPublicPlanCards,
  sortPublicPlans,
  type PublicPlan,
} from "@/lib/site/plans"

export async function loadReservacionesPlans(): Promise<PublicPlan[]> {
  try {
    const db = getDb()
    const rows = await db
      .select({
        id: schema.plan.id,
        name: schema.plan.name,
        planType: schema.plan.planType,
        daysPerWeek: schema.plan.daysPerWeek,
        totalClasses: schema.plan.totalClasses,
        durationDays: schema.plan.durationDays,
        priceMxn: schema.plan.priceMxn,
        isUnlimited: schema.plan.isUnlimited,
        createdAt: schema.plan.createdAt,
      })
      .from(schema.plan)
      .where(
        and(
          eq(schema.plan.isActive, true),
          eq(schema.plan.isPublic, true),
        ),
      )
      .orderBy(asc(schema.plan.createdAt))

    return buildPublicPlanCards(sortPublicPlans(rows))
  } catch (error) {
    // La landing se prerenderiza en build: si la BD está caída o le falta una
    // migración de scripts/postgres-manual, preferimos publicar sin planes antes
    // que tumbar el deploy completo. El log debe ser ruidoso para que no pase
    // inadvertido en Netlify.
    console.error(
      "[public-plans] No se pudieron cargar los planes públicos; la landing se renderizará sin planes. " +
        "Revisa que las migraciones de scripts/postgres-manual estén aplicadas en la BD.",
      error,
    )
    return []
  }
}
