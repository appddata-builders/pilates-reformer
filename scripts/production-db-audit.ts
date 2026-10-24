/** Auditoría de solo lectura. No cambia esquema, saldos ni reservas. */
import postgres from "postgres"
import { is } from "drizzle-orm"
import { PgTable, getTableConfig } from "drizzle-orm/pg-core"
import * as schema from "../lib/db/schema.pg"

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) throw new Error("Falta DATABASE_URL_UNPOOLED o DATABASE_URL")
  const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 2 })
  try {
    await sql.begin("read only", async (tx) => {
      await tx`SET LOCAL statement_timeout = '15s'`
      const [server] = await tx`SELECT current_setting('server_version') AS version,
        current_setting('TimeZone') AS timezone, current_setting('transaction_read_only') AS read_only`
      const columns = await tx`SELECT table_name, column_name, data_type, is_nullable, datetime_precision
        FROM information_schema.columns WHERE table_schema = 'public'`
      const available = new Set(columns.map((c) => `${c.table_name}.${c.column_name}`))
      const missing: string[] = []
      for (const value of Object.values(schema)) {
        if (!is(value, PgTable)) continue
        const table = getTableConfig(value)
        for (const column of table.columns) {
          if (!available.has(`${table.name}.${column.name}`)) missing.push(`${table.name}.${column.name}`)
        }
      }
      console.log(JSON.stringify({ server, missingColumns: missing,
        takenAt: columns.find((c) => c.table_name === "booking" && c.column_name === "taken_at") ?? null }, null, 2))
      if (["subscription.classes_remaining", "plan.days_per_week", "booking.status", "payment.booking_id"].some((c) => !available.has(c))) {
        process.exitCode = 1
        return
      }
      const [balances] = await tx`SELECT
        count(*) FILTER (WHERE s.status = 'active' AND NOT s.is_unlimited AND p.plan_type = 'monthly' AND s.classes_remaining IS NULL)::int AS active_monthly_null_balances,
        count(*) FILTER (WHERE s.classes_remaining < 0)::int AS negative_balances,
        count(*) FILTER (WHERE s.status = 'active' AND p.plan_type = 'monthly' AND NOT s.is_unlimited AND p.days_per_week <= 0)::int AS monthly_plans_without_weekly_limit
        FROM subscription s JOIN plan p ON p.id = s.plan_id`
      const [duplicates] = await tx`SELECT count(*)::int AS duplicate_confirmed_groups FROM (
        SELECT user_id, schedule_slot_id, booking_date::date FROM booking WHERE status = 'confirmed'
        GROUP BY user_id, schedule_slot_id, booking_date::date HAVING count(*) > 1
      ) d`
      const [overbooked] = await tx`SELECT count(*)::int AS overbooked_classes FROM (
        SELECT b.schedule_slot_id, b.booking_date::date FROM booking b JOIN schedule_slot s ON s.id = b.schedule_slot_id
        WHERE b.status = 'confirmed' GROUP BY b.schedule_slot_id, b.booking_date::date, s.capacity HAVING count(*) > s.capacity
      ) d`
      const [individual] = await tx`SELECT count(*)::int AS active_individual_prices FROM plan
        WHERE is_active AND price_mxn > 0 AND (id = 'plan-individual' OR total_classes = 1)`
      const [overlapping] = await tx`SELECT count(*)::int AS users_with_multiple_active_plans FROM (
        SELECT user_id FROM subscription WHERE status = 'active' GROUP BY user_id HAVING count(*) > 1
      ) d`
      console.log(JSON.stringify({ balances, duplicates, overbooked, individual, overlapping }, null, 2))
      if (missing.length || balances.active_monthly_null_balances || balances.negative_balances || balances.monthly_plans_without_weekly_limit || duplicates.duplicate_confirmed_groups || overbooked.overbooked_classes || !individual.active_individual_prices || overlapping.users_with_multiple_active_plans) process.exitCode = 1
    })
  } finally { await sql.end() }
}
main().catch((error: unknown) => {
  const code = (error as { code?: string }).code ?? "AUDIT_FAILED"
  console.error(`Auditoría PostgreSQL no completada (${code}).`)
  process.exitCode = 1
})
