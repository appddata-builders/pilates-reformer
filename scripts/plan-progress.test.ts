import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import type { AnyDb } from "../lib/db"
import * as schema from "../lib/db/schema.sqlite"
import { loadPlanProgress } from "../lib/booking-plan-info"

// DB_DRIVER=sqlite node --import tsx --test scripts/plan-progress.test.ts
const DAY = 24 * 60 * 60 * 1000

async function fixture(sub: { classesRemaining: number | null; isUnlimited?: boolean }) {
  const raw = new Database(":memory:")
  for (const table of [schema.plan, schema.subscription, schema.payment, schema.booking]) {
    const config = getTableConfig(table)
    raw.exec(`CREATE TABLE "${config.name}" (${config.columns.map((c) =>
      `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}`).join(", ")})`)
  }
  const db = drizzle(raw) as AnyDb
  // Mensual de 3 por semana: 3 × 4 semanas = 12 clases.
  await db.insert(schema.plan).values({
    id: "mensual", name: "Mensual", priceMxn: 1000, totalClasses: null,
    planType: "monthly", daysPerWeek: 3, durationDays: 30, isUnlimited: false,
  })
  const subCreatedAt = new Date(Date.now() - 10 * DAY)
  await db.insert(schema.subscription).values({
    id: "sub", userId: "u", planId: "mensual", status: "active",
    startDate: subCreatedAt, endDate: new Date(Date.now() + 20 * DAY), createdAt: subCreatedAt,
    classesRemaining: sub.classesRemaining, isUnlimited: sub.isUnlimited ?? false,
  })
  let n = 0
  async function book(opts: { trial?: boolean; individual?: boolean; status?: string; before?: boolean } = {}) {
    const id = `b${n++}`
    await db.insert(schema.booking).values({
      id, userId: "u", scheduleSlotId: "slot", bookingDate: new Date(Date.now() + n * DAY),
      status: opts.status ?? "confirmed", trialClass: opts.trial ?? false,
      createdAt: opts.before ? new Date(subCreatedAt.getTime() - DAY) : new Date(),
    })
    if (opts.individual) {
      await db.insert(schema.payment).values({
        id: `p-${id}`, userId: "u", bookingId: id, subscriptionId: null, amount: 250, status: "pending",
      })
    }
  }
  return { raw, db, book }
}

test("Plan nuevo: 0 de 12", async () => {
  const f = await fixture({ classesRemaining: 12 })
  try {
    assert.deepEqual(await loadPlanProgress(f.db, "sub"), { used: 0, total: 12 })
  } finally { f.raw.close() }
})

test("Cuenta sólo las clases del plan: ni muestra, ni individuales, ni canceladas", async () => {
  const f = await fixture({ classesRemaining: 9 })
  try {
    for (let i = 0; i < 3; i++) await f.book()
    await f.book({ trial: true })
    await f.book({ individual: true })
    await f.book({ status: "cancelled" })
    assert.deepEqual(await loadPlanProgress(f.db, "sub"), { used: 3, total: 12 })
  } finally { f.raw.close() }
})

test("Las clases que pasaron del plan anterior suman al total", async () => {
  // 12 del plan + 2 que traía; ya reservó 3.
  const f = await fixture({ classesRemaining: 11 })
  try {
    for (let i = 0; i < 3; i++) await f.book()
    await f.book({ before: true })
    assert.deepEqual(await loadPlanProgress(f.db, "sub"), { used: 3, total: 14 })
  } finally { f.raw.close() }
})

test("Una clase descontada sin reserva propia no baja el total de lo que incluye el plan", async () => {
  // P. ej. el plan arrancó desde Asistencia sobre una reserva previa.
  const f = await fixture({ classesRemaining: 11 })
  try {
    await f.book({ before: true })
    assert.deepEqual(await loadPlanProgress(f.db, "sub"), { used: 1, total: 12 })
  } finally { f.raw.close() }
})

test("Ilimitado: sólo cuántas lleva", async () => {
  const f = await fixture({ classesRemaining: null, isUnlimited: true })
  try {
    await f.book()
    await f.book()
    assert.deepEqual(await loadPlanProgress(f.db, "sub"), { used: 2, total: null })
  } finally { f.raw.close() }
})
