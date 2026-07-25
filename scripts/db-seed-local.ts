/**
 * Siembra los planes y los horarios oficiales del estudio en la BD local
 * de SQLite (`local.db`), sin tocar el resto de los datos.
 *
 * Los planes salen de STUDIO_PLAN_DEFINITIONS y la parrilla de
 * scheduleDayLabels × scheduleTimes, así que el local siempre queda igual a lo
 * que declara el código (y a scripts/postgres-manual/10-planes-studio57-y-horarios.sql).
 *
 * Uso:
 *   npm run db:seed:local
 */

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "../lib/db/schema.sqlite"
import { STUDIO_PLAN_DEFINITIONS } from "../lib/site/plans"
import { scheduleDayLabels, scheduleTimes } from "../lib/site/schedule"

const MORNING_INSTRUCTOR = "Elena Morales"
const EVENING_INSTRUCTOR = "Lucía Paredes"

function weeksIn(durationDays: number): number {
  return Math.max(1, Math.round(durationDays / 7))
}

function costPerClass(plan: (typeof STUDIO_PLAN_DEFINITIONS)[number]): number | null {
  if (plan.planType === "monthly") {
    const classes = plan.daysPerWeek * weeksIn(plan.durationDays)
    return classes > 0 ? Math.round((plan.priceMxn / classes) * 100) / 100 : null
  }
  if (plan.totalClasses != null && plan.totalClasses > 0) {
    return Math.round((plan.priceMxn / plan.totalClasses) * 100) / 100
  }
  return null
}

function nextHour(time: string): string {
  const hour = Number(time.slice(0, 2))
  return `${String(hour + 1).padStart(2, "0")}:00`
}

function main() {
  const raw = new Database("local.db")
  raw.pragma("foreign_keys = ON")
  const db = drizzle(raw, { schema })
  const now = new Date()

  for (const plan of STUDIO_PLAN_DEFINITIONS) {
    const values = {
      id: plan.id,
      name: plan.name,
      planType: plan.planType,
      daysPerWeek: plan.daysPerWeek,
      totalClasses: plan.totalClasses,
      priceMxn: plan.priceMxn,
      costPerClass: costPerClass(plan),
      durationDays: plan.durationDays,
      isActive: true,
      isPublic: plan.isPublic,
      isAddOn: plan.isAddOn,
      isUnlimited: plan.isUnlimited,
      createdAt: now,
    }
    db.insert(schema.plan)
      .values(values)
      .onConflictDoUpdate({ target: schema.plan.id, set: values })
      .run()
  }

  for (const day of scheduleDayLabels) {
    for (const startTime of scheduleTimes) {
      const isDual = day.dayOfWeek === 6 && startTime === "08:00"
      const values = {
        id: `slot-d${day.dayOfWeek}-t${startTime.replace(":", "")}`,
        className: "Pilates Reformer",
        instructor: startTime < "12:00" ? MORNING_INSTRUCTOR : EVENING_INSTRUCTOR,
        alternateInstructor: isDual ? EVENING_INSTRUCTOR : null,
        scheduleMode: isDual ? "dual" : "fixed",
        dayOfWeek: day.dayOfWeek,
        startTime,
        endTime: nextHour(startTime),
        capacity: 8,
        classType: "reformer",
        isActive: true,
        createdAt: now,
      }
      db.insert(schema.scheduleSlot)
        .values(values)
        .onConflictDoUpdate({ target: schema.scheduleSlot.id, set: values })
        .run()
    }
  }

  const count = (table: string) =>
    (raw.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n

  console.log(
    `local.db listo: ${STUDIO_PLAN_DEFINITIONS.length} planes sembrados (${count("plan")} en total), ` +
      `${scheduleDayLabels.length * scheduleTimes.length} horarios sembrados (${count("schedule_slot")} en total).`,
  )
  raw.close()
}

main()
