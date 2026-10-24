import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { eq } from "drizzle-orm"
import type { AnyDb } from "../lib/db"
import * as schema from "../lib/db/schema.sqlite"
import { requestPlan } from "../lib/plan-requests"
import { applyUserPlan } from "../lib/activate-subscription"
import { studioDateStrFromInstant, studioLocalDateTimeToInstant } from "../lib/studio-month"

// DB_DRIVER=sqlite node --import tsx --test scripts/coupons.test.ts
const DAY = 24 * 60 * 60 * 1000

/** Mediodía del estudio a `offset` días de hoy: así guarda Cupones sus fechas. */
function studioDay(offset: number): Date {
  const dateStr = studioDateStrFromInstant(new Date(Date.now() + offset * DAY))
  return studioLocalDateTimeToInstant(dateStr, 12, 0)
}

async function fixture() {
  const raw = new Database(":memory:")
  for (const table of [schema.user, schema.plan, schema.subscription, schema.payment,
    schema.booking, schema.notification, schema.coupon]) {
    const config = getTableConfig(table)
    raw.exec(`CREATE TABLE "${config.name}" (${config.columns.map((c) =>
      `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}`).join(", ")})`)
  }
  const db = drizzle(raw) as AnyDb
  await db.insert(schema.user).values(["a", "b", "c"].map((id) => ({
    id, name: `Alumna ${id}`, email: `${id}@example.test`, cognitoId: id, role: "alumno",
  })))
  await db.insert(schema.plan).values([
    { id: "semanal", name: "Semanal", priceMxn: 400, totalClasses: null, planType: "monthly", daysPerWeek: 3, durationDays: 7 },
    { id: "mensual", name: "Mensual", priceMxn: 1000, totalClasses: null, planType: "monthly", daysPerWeek: 3, durationDays: 30 },
  ])
  const coupon = (values: Partial<typeof schema.coupon.$inferInsert> = {}) =>
    db.insert(schema.coupon).values({
      id: "promo", code: "PROMO", name: "Promo", discountType: "percent", discountValue: 20, ...values,
    })
  const subs = (userId: string) =>
    db.select().from(schema.subscription).where(eq(schema.subscription.userId, userId))
  const charges = (userId: string) =>
    db.select().from(schema.payment).where(eq(schema.payment.userId, userId))
  return { db, raw, coupon, subs, charges }
}

test("El límite cuenta usuarios distintos y cada uno usa el cupón una vez", async () => {
  const f = await fixture()
  try {
    await f.coupon({ maxUses: 2 })
    const a = await requestPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" })
    assert.equal(a.ok, true)
    assert.match(a.ok ? a.message : "", /\$320 con el cupón PROMO/)
    const [sub] = await f.subs("a")
    assert.equal(sub.couponId, "promo")
    assert.equal(sub.paidAmount, 320)
    assert.equal((await f.charges("a"))[0].amount, 320)

    assert.equal((await requestPlan(f.db, { userId: "b", planId: "semanal", couponCode: " promo " })).ok, true)
    assert.deepEqual(await requestPlan(f.db, { userId: "c", planId: "semanal", couponCode: "PROMO" }),
      { ok: false, error: "Este cupón ya alcanzó su límite de usuarios" })
    assert.equal((await f.subs("c")).length, 0)

    // Al renovar, la misma alumna ya no lo puede usar; el periodo vencido no se cierra.
    await f.db.update(schema.subscription).set({ endDate: new Date(Date.now() - 3 * DAY) })
      .where(eq(schema.subscription.id, sub.id))
    await f.db.update(schema.payment).set({ status: "succeeded" }).where(eq(schema.payment.userId, "a"))
    assert.deepEqual(await requestPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" }),
      { ok: false, error: "Este cupón ya se usó en esta cuenta" })
    const after = await f.subs("a")
    assert.equal(after.length, 1)
    assert.equal(after[0].status, "active")
  } finally { f.raw.close() }
})

test("Las fechas del cupón son días completos del estudio", async () => {
  const f = await fixture()
  try {
    await f.coupon({ validFrom: studioDay(1) })
    const early = await requestPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" })
    assert.equal(early.ok, false)
    assert.match(early.ok ? "" : early.error, /válido a partir del/)

    await f.db.update(schema.coupon).set({ validFrom: studioDay(0), validUntil: studioDay(0) })
    assert.equal((await requestPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" })).ok, true)

    await f.db.update(schema.coupon).set({ validFrom: null, validUntil: studioDay(-1) })
    assert.deepEqual(await requestPlan(f.db, { userId: "b", planId: "semanal", couponCode: "PROMO" }),
      { ok: false, error: "Este cupón ya venció" })
  } finally { f.raw.close() }
})

test("Si el cobro se anula, el lugar regresa al cupón", async () => {
  const f = await fixture()
  try {
    await f.coupon({ maxUses: 1 })
    assert.equal((await applyUserPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" })).ok, true)
    assert.equal((await applyUserPlan(f.db, { userId: "b", planId: "semanal", couponCode: "PROMO" })).ok, false)

    // El admin corrige el plan antes de que se use: el cobro del primero se
    // anula y el cupón vuelve a alcanzar para el plan correcto.
    assert.equal((await applyUserPlan(f.db, { userId: "a", planId: "mensual", couponCode: "PROMO" })).ok, true)
    const active = (await f.subs("a")).filter((s) => s.status === "active")
    assert.equal(active.length, 1)
    assert.equal(active[0].planId, "mensual")
    assert.equal(active[0].couponId, "promo")
    const statuses = (await f.charges("a")).map((p) => `${p.amount}:${p.status}`).sort()
    assert.deepEqual(statuses, ["320:cancelled", "800:pending"])

    assert.equal((await applyUserPlan(f.db, { userId: "b", planId: "semanal", couponCode: "PROMO" })).ok, false)
  } finally { f.raw.close() }
})

test("Un cupón que no aplica no le quita el plan a la alumna", async () => {
  const f = await fixture()
  try {
    await f.coupon()
    assert.equal((await applyUserPlan(f.db, { userId: "a", planId: "semanal" })).ok, true)

    assert.deepEqual(await applyUserPlan(f.db, { userId: "a", planId: "mensual", couponCode: "NOEXISTE" }),
      { ok: false, error: "Cupón no encontrado" })
    const subs = await f.subs("a")
    assert.equal(subs.length, 1)
    assert.equal(subs[0].planId, "semanal")
    assert.equal(subs[0].status, "active")
    assert.equal((await f.charges("a"))[0].status, "pending")

    const same = await applyUserPlan(f.db, { userId: "a", planId: "semanal", couponCode: "PROMO" })
    assert.equal(same.ok, false)
    assert.match(same.ok ? "" : same.error, /sigue vigente/)
  } finally { f.raw.close() }
})
