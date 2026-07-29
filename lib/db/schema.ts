import { shouldUseSqlite, getPgDatabaseUrl, shouldUsePgBuildFallback } from "./runtime-driver"
import * as schemaSqlite from "./schema.sqlite"
import * as schemaPg from "./schema.pg"

function usePgSchema(): boolean {
  if (shouldUseSqlite()) return false
  if (shouldUsePgBuildFallback()) return false
  return Boolean(getPgDatabaseUrl())
}

const runtimeSchema = usePgSchema() ? schemaPg : schemaSqlite

type RuntimeSchema = typeof schemaSqlite

function table<K extends keyof RuntimeSchema>(key: K): RuntimeSchema[K] {
  return runtimeSchema[key as keyof typeof runtimeSchema] as RuntimeSchema[K]
}

export const user = table("user")
export const session = table("session")
export const account = table("account")
export const verification = table("verification")
export const plan = table("plan")
export const reformer = table("reformer")
export const scheduleSlot = table("scheduleSlot")
export const scheduleSlotException = table("scheduleSlotException")
export const subscription = table("subscription")
export const booking = table("booking")
export const payment = table("payment")
export const saleItem = table("saleItem")
export const coachPayrollPeriod = table("coachPayrollPeriod")
export const studioKpiSnapshot = table("studioKpiSnapshot")
export const coupon = table("coupon")
export const studioPolicy = table("studioPolicy")
export const studioEvent = table("studioEvent")
export const notification = table("notification")
export const userRelations = table("userRelations")
export const sessionRelations = table("sessionRelations")
export const accountRelations = table("accountRelations")
export const planRelations = table("planRelations")
export const reformerRelations = table("reformerRelations")
export const scheduleSlotRelations = table("scheduleSlotRelations")
export const scheduleSlotExceptionRelations = table("scheduleSlotExceptionRelations")
export const subscriptionRelations = table("subscriptionRelations")
export const bookingRelations = table("bookingRelations")
export const paymentRelations = table("paymentRelations")
export const saleItemRelations = table("saleItemRelations")
export const coachPayrollRelations = table("coachPayrollRelations")
export const studioEventRelations = table("studioEventRelations")
export const notificationRelations = table("notificationRelations")
