/**
 * Cuántas clases incluye un plan y cuántas puede tomar por semana.
 *
 * Los planes mensuales del estudio se venden por días a la semana, no por un
 * total: Equilibrio son 3 por semana y Vitalidad 5. El total del periodo sale
 * de multiplicar eso por las semanas que dura la frecuencia, que es la misma
 * cuenta que ya hacía la landing y el seed:
 *
 *   Equilibrio  semanal 3 · quincenal 6  · mensual 12
 *   Vitalidad   semanal 5 · quincenal 10 · mensual 20
 *
 * El total topa el periodo completo. `daysPerWeek` es sólo una sugerencia por
 * semana: la alumna puede tomar sus clases como quiera dentro del periodo.
 */

export type PlanQuotaRow = {
  planType: string
  daysPerWeek: number
  totalClasses: number | null
  durationDays: number
  isUnlimited: boolean
}

export function weeksInPeriod(durationDays: number): number {
  return Math.max(1, Math.round(durationDays / 7))
}

/** Clases que incluye un periodo completo del plan. `null` es sin tope. */
export function planIncludedClasses(plan: PlanQuotaRow): number | null {
  if (plan.isUnlimited) return null
  if (plan.planType === "monthly") {
    if (plan.daysPerWeek <= 0) return null
    return plan.daysPerWeek * weeksInPeriod(plan.durationDays)
  }
  return plan.totalClasses ?? null
}

/** Clases sugeridas por semana del estudio (lunes a domingo). `null` es sin sugerencia. */
export function planWeeklyLimit(plan: {
  planType: string
  daysPerWeek: number
  isUnlimited: boolean
}): number | null {
  if (plan.isUnlimited) return null
  if (plan.planType === "monthly" && plan.daysPerWeek > 0) return plan.daysPerWeek
  return null
}

/** Precio por clase del plan, para el desglose de caja. */
export function planCostPerClass(plan: PlanQuotaRow, finalPrice: number): number | null {
  const classes = planIncludedClasses(plan)
  if (classes == null || classes <= 0) return null
  return finalPrice / classes
}
