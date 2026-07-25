export type StudioPlanDefinition = {
  id: string
  name: string
  planType: "class_pack" | "monthly" | "add_on"
  daysPerWeek: number
  totalClasses: number | null
  priceMxn: number
  durationDays: number
  isAddOn: boolean
  isUnlimited: boolean
  /** Sólo Clase Muestra, Equilibrio y Vitalidad se publican en la landing. */
  isPublic: boolean
}

export const STUDIO_PLAN_DEFINITIONS: StudioPlanDefinition[] = [
  {
    id: "plan-apertura",
    name: "Clase Muestra",
    planType: "class_pack",
    daysPerWeek: 0,
    totalClasses: 1,
    priceMxn: 0,
    durationDays: 30,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-equilibrio-semanal",
    name: "Plan Equilibrio Semanal",
    planType: "monthly",
    daysPerWeek: 3,
    totalClasses: null,
    priceMxn: 400,
    durationDays: 7,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-equilibrio-quincenal",
    name: "Plan Equilibrio Quincenal",
    planType: "monthly",
    daysPerWeek: 3,
    totalClasses: null,
    priceMxn: 700,
    durationDays: 15,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-equilibrio-mensual",
    name: "Plan Equilibrio Mensual",
    planType: "monthly",
    daysPerWeek: 3,
    totalClasses: null,
    priceMxn: 1350,
    durationDays: 30,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-vitalidad-semanal",
    name: "Plan Vitalidad Semanal",
    planType: "monthly",
    daysPerWeek: 5,
    totalClasses: null,
    priceMxn: 650,
    durationDays: 7,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-vitalidad-quincenal",
    name: "Plan Vitalidad Quincenal",
    planType: "monthly",
    daysPerWeek: 5,
    totalClasses: null,
    priceMxn: 1150,
    durationDays: 15,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
  {
    id: "plan-vitalidad-mensual",
    name: "Plan Vitalidad Mensual",
    planType: "monthly",
    daysPerWeek: 5,
    totalClasses: null,
    priceMxn: 2200,
    durationDays: 30,
    isAddOn: false,
    isUnlimited: false,
    isPublic: true,
  },
]

/** Orden de la vitrina pública: Clase Muestra, Equilibrio y Vitalidad. */
export const PUBLIC_RESERVACIONES_PLAN_IDS: string[] = STUDIO_PLAN_DEFINITIONS.filter(
  (p) => p.isPublic,
).map((p) => p.id)

/**
 * Planes que en la BD viven como una fila por frecuencia de cobro (semanal,
 * quincenal y mensual) pero que en la landing se muestran como una sola
 * tarjeta con sus tres precios, tal como los publica Studio 57.
 */
export type PlanFamily = {
  id: string
  name: string
  daysNote: string
}

export const PLAN_FAMILIES: PlanFamily[] = [
  {
    id: "plan-equilibrio",
    name: "Plan Equilibrio",
    daysNote: "Lunes, Miércoles y Viernes · Martes, Jueves y Sábado",
  },
  {
    id: "plan-vitalidad",
    name: "Plan Vitalidad",
    daysNote: "Lunes a Viernes",
  },
]

export function planFamilyOf(planId: string): PlanFamily | null {
  return PLAN_FAMILIES.find((family) => planId.startsWith(`${family.id}-`)) ?? null
}

export const PLAN_DISPLAY_ORDER = STUDIO_PLAN_DEFINITIONS.map((p) => p.id)

export const SINGLE_CLASS_LABEL = "Clase individual"

export const FREE_SAMPLE_PLAN_ID = "plan-apertura"

export const FREE_SAMPLE_CLASS_LABEL = "Clase muestra gratis"

export type PublicPlanPrice = {
  /** Fila de `plan` que corresponde a esta frecuencia de cobro. */
  planId: string
  label: string
  /** Clases que incluye la frecuencia: "3 clases por semana", "6 por quincena"… */
  includes: string
  priceLabel: string
}

export type PublicPlan = {
  id: string
  name: string
  /**
   * "card" para los planes con frecuencias seleccionables (Equilibrio,
   * Vitalidad); "bar" para las clases sueltas, que van sin foto debajo.
   */
  layout: "card" | "bar"
  includes: string
  note: string | null
  badge: string | null
  prices: PublicPlanPrice[]
}

export function planPromoBadge(planId: string): string | null {
  if (planId === FREE_SAMPLE_PLAN_ID) return FREE_SAMPLE_CLASS_LABEL
  return null
}

export type PlanLabelRow = {
  name: string
  planType: string
  priceMxn: number
}

export function formatPlanPrice(priceMxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(priceMxn)
}

export function formatPlanTypeLabel(planType: string): string {
  if (planType === "class_pack") return "Paquete de clases"
  if (planType === "monthly") return "Mensual"
  if (planType === "add_on") return "Complemento"
  return planType
}

export function formatPublicPlanPrice(planType: string, priceMxn: number): string {
  return formatPlanPrice(priceMxn)
}

export function formatPlanPickerLabel(plan: PlanLabelRow): string {
  const price = formatPublicPlanPrice(plan.planType, plan.priceMxn)
  return `${plan.name} — ${price}`
}

export function formatPlanIncludes(
  planType: string,
  totalClasses: number | null,
  isUnlimited: boolean,
  daysPerWeek = 0,
): string {
  if (isUnlimited) return "Acceso flexible"
  if (planType === "monthly" && daysPerWeek > 0) {
    return `${daysPerWeek} clases por semana`
  }
  if (totalClasses === 1) return SINGLE_CLASS_LABEL
  if (totalClasses != null && totalClasses > 1) return `${totalClasses} clases`
  return "—"
}

export function formatPlanValidity(durationDays: number): string {
  return `${durationDays} días`
}

/**
 * Frecuencias de cobro del estudio. `weeks` es lo que multiplica a las clases
 * por semana del plan para saber cuántas incluye cada frecuencia.
 */
export const CADENCE_CONFIG = [
  { durationDays: 7, label: "Semanal", period: "semana", weeks: 1 },
  { durationDays: 15, label: "Quincenal", period: "quincena", weeks: 2 },
  { durationDays: 30, label: "Mensual", period: "mes", weeks: 4 },
] as const

export type Cadence = (typeof CADENCE_CONFIG)[number]

export function cadenceFor(durationDays: number): Cadence {
  if (durationDays <= 7) return CADENCE_CONFIG[0]
  if (durationDays <= 15) return CADENCE_CONFIG[1]
  return CADENCE_CONFIG[2]
}

export function formatBillingCycleLabel(durationDays: number): string {
  return cadenceFor(durationDays).label
}

export function formatCadenceIncludes(daysPerWeek: number, cadence: Cadence): string {
  return `${daysPerWeek * cadence.weeks} clases por ${cadence.period}`
}

export type PublicPlanRow = {
  id: string
  name: string
  planType: string
  daysPerWeek: number
  totalClasses: number | null
  durationDays: number
  priceMxn: number
  isUnlimited: boolean
}

function planRowToPublicPlan(row: PublicPlanRow): PublicPlan {
  const includes = formatPlanIncludes(
    row.planType,
    row.totalClasses,
    row.isUnlimited,
    row.daysPerWeek,
  )
  return {
    id: row.id,
    name: row.name,
    layout: "bar",
    includes,
    note: formatPlanValidity(row.durationDays),
    badge: planPromoBadge(row.id),
    prices: [
      {
        planId: row.id,
        label: "Precio",
        includes,
        priceLabel: formatPublicPlanPrice(row.planType, row.priceMxn),
      },
    ],
  }
}

/**
 * Convierte las filas de `plan` en las tarjetas de la landing: las frecuencias
 * de una misma familia (Equilibrio / Vitalidad) se colapsan en una tarjeta con
 * sus precios Semanal · Quincenal · Mensual; el resto es una tarjeta por fila.
 */
export function buildPublicPlanCards(rows: PublicPlanRow[]): PublicPlan[] {
  const cards: PublicPlan[] = []
  const cardsByFamily = new Map<string, PublicPlan>()

  for (const row of rows) {
    const family = planFamilyOf(row.id)
    if (family == null) {
      cards.push(planRowToPublicPlan(row))
      continue
    }

    const cadence = cadenceFor(row.durationDays)
    const price: PublicPlanPrice = {
      planId: row.id,
      label: cadence.label,
      includes: formatCadenceIncludes(row.daysPerWeek, cadence),
      priceLabel: formatPublicPlanPrice(row.planType, row.priceMxn),
    }

    const existing = cardsByFamily.get(family.id)
    if (existing != null) {
      existing.prices.push(price)
      continue
    }

    const card: PublicPlan = {
      id: family.id,
      name: family.name,
      layout: "card",
      includes: price.includes,
      note: family.daysNote,
      badge: planPromoBadge(row.id),
      prices: [price],
    }
    cardsByFamily.set(family.id, card)
    cards.push(card)
  }

  for (const card of cardsByFamily.values()) {
    card.prices.sort(
      (a, b) =>
        CADENCE_CONFIG.findIndex((c) => c.label === a.label) -
        CADENCE_CONFIG.findIndex((c) => c.label === b.label),
    )
    card.includes = card.prices[0].includes
  }

  return cards
}

export function sortPlansByDisplayOrder<T extends { id: string }>(rows: T[]): T[] {
  const order = new Map(PLAN_DISPLAY_ORDER.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => {
    const ai = order.get(a.id)
    const bi = order.get(b.id)
    if (ai != null && bi != null) return ai - bi
    if (ai != null) return -1
    if (bi != null) return 1
    return a.id.localeCompare(b.id)
  })
}

export function sortPublicPlans<T extends { id: string }>(rows: T[]): T[] {
  const preferred = new Map(
    PUBLIC_RESERVACIONES_PLAN_IDS.map((id, index) => [id, index]),
  )
  const fallback = new Map(PLAN_DISPLAY_ORDER.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => {
    const ap = preferred.get(a.id)
    const bp = preferred.get(b.id)
    if (ap != null && bp != null) return ap - bp
    if (ap != null) return -1
    if (bp != null) return 1
    const af = fallback.get(a.id)
    const bf = fallback.get(b.id)
    if (af != null && bf != null) return af - bf
    if (af != null) return -1
    if (bf != null) return 1
    return a.id.localeCompare(b.id)
  })
}

export type PlanDuplicateCandidate = {
  id: string
  name: string
  planType: string
  daysPerWeek: number
  totalClasses: number | null
  priceMxn: number
  durationDays: number
  isActive: boolean
}

export type PlanDuplicateIncoming = {
  name: string
  planType: string
  daysPerWeek: number
  totalClasses: number | null
  priceMxn: number
  durationDays: number
}

export function normalizePlanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function plansHaveSameName(a: string, b: string): boolean {
  return normalizePlanName(a) === normalizePlanName(b)
}

export function plansHaveSameCharacteristics(
  a: Omit<PlanDuplicateIncoming, "name">,
  b: Omit<PlanDuplicateIncoming, "name">,
): boolean {
  return (
    a.planType === b.planType &&
    a.daysPerWeek === b.daysPerWeek &&
    (a.totalClasses ?? null) === (b.totalClasses ?? null) &&
    a.priceMxn === b.priceMxn &&
    a.durationDays === b.durationDays
  )
}

export function findDuplicatePlan(
  candidates: PlanDuplicateCandidate[],
  incoming: PlanDuplicateIncoming,
  excludeId?: string,
): { reason: "name" | "characteristics"; plan: PlanDuplicateCandidate } | null {
  for (const plan of candidates) {
    if (!plan.isActive) continue
    if (excludeId != null && plan.id === excludeId) continue
    if (plansHaveSameName(plan.name, incoming.name)) {
      return { reason: "name", plan }
    }
    if (plansHaveSameCharacteristics(plan, incoming)) {
      return { reason: "characteristics", plan }
    }
  }
  return null
}

export function duplicatePlanErrorMessage(
  duplicate: { reason: "name" | "characteristics"; plan: PlanDuplicateCandidate },
): string {
  if (duplicate.reason === "name") {
    return `Ya existe un plan activo con el nombre "${duplicate.plan.name}".`
  }
  return `Ya existe un plan activo con las mismas características ("${duplicate.plan.name}").`
}
