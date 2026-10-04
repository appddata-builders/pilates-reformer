import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { eq } from "drizzle-orm"
import type { AnyDb } from "../lib/db"
import * as schema from "../lib/db/schema.sqlite"
import { recordCoachAttendance } from "../lib/coach-attendance"
import { requestPlan } from "../lib/plan-requests"

// DB_DRIVER=sqlite node --import tsx --test scripts/coach-attendance.test.ts
async function fixture() {
  const raw = new Database(":memory:")
  for (const table of [schema.user, schema.plan, schema.subscription, schema.payment,
    schema.booking, schema.scheduleSlot, schema.notification]) {
    const config = getTableConfig(table)
    raw.exec(`CREATE TABLE "${config.name}" (${config.columns.map((c) =>
      `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}`).join(", ")})`)
  }
  const db = drizzle(raw) as AnyDb
  await db.insert(schema.user).values({ id: "u", name: "Alumna", email: "alumna@example.test", cognitoId: "u", role: "alumno" })
  await db.insert(schema.plan).values([
    { id: "plan-individual", name: "Individual", priceMxn: 200, totalClasses: 1, planType: "class_pack", daysPerWeek: 0, durationDays: 1 },
    { id: "monthly", name: "Mensual", priceMxn: 1800, totalClasses: null, planType: "monthly", daysPerWeek: 3, durationDays: 30 },
  ])
  await db.insert(schema.scheduleSlot).values({ id: "slot", className: "Pilates", instructor: "Coach", dayOfWeek: new Date().getDay(), startTime: "08:00" })
  await db.insert(schema.booking).values({ id: "b", userId: "u", scheduleSlotId: "slot", bookingDate: new Date(), status: "confirmed" })
  const actor = { id: "c", role: "coach", name: "Coach" }
  const mark = (catalogId?: string, attended = true) => recordCoachAttendance(db, { bookingId: "b", attended, catalogId, actor })
  const payments = () => db.select().from(schema.payment)
  return { db, raw, actor, mark, payments }
}

test("La coach genera adeudo de catálogo; repetir o cambiar asistencia no lo duplica ni lo salda", async () => {
  const f = await fixture()
  try {
    assert.deepEqual(await f.mark("plan-individual"), { success: true })
    assert.deepEqual(await f.mark("plan-individual"), { success: true })
    assert.deepEqual(await f.mark(undefined, false), { success: true })
    const charges = await f.payments()
    assert.equal(charges.length, 1)
    assert.equal(charges[0].status, "pending")
    assert.equal(charges[0].amount, 200)
    assert.equal(charges[0].bookingId, "b")
    assert.equal(charges[0].collectedBy, null)
  } finally { f.raw.close() }
})

test("El cargo de la reserva se reutiliza y cambiarlo a mensualidad requiere administración", async () => {
  const f = await fixture()
  try {
    await f.db.insert(schema.payment).values({ id: "original", userId: "u", bookingId: "b", amount: 200, status: "pending" })
    assert.equal((await f.mark("plan-individual")).success, true)
    assert.equal((await f.mark("monthly")).success, false)
    assert.equal((await f.payments()).length, 1)
    assert.equal((await f.db.select().from(schema.subscription)).length, 0)
  } finally { f.raw.close() }
})

test("Asignar un plan crea un solo cobro pendiente y consume exactamente una clase", async () => {
  const f = await fixture()
  try {
    assert.deepEqual(await f.mark("monthly"), { success: true })
    assert.deepEqual(await f.mark("monthly"), { success: true })
    assert.equal((await f.mark("plan-individual")).success, false)
    const [sub] = await f.db.select().from(schema.subscription)
    assert.equal(sub.status, "active")
    assert.equal(sub.classesRemaining, 11)
    const charges = await f.payments()
    assert.equal(charges.length, 1)
    assert.equal(charges[0].subscriptionId, sub.id)
    assert.equal(charges[0].bookingId, null)
    assert.equal(charges[0].status, "pending")
    assert.equal(charges[0].amount, 1800)
  } finally { f.raw.close() }
})

test("Con plan vigente la asistencia no vuelve a cobrar o consumir", async () => {
  const f = await fixture()
  try {
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly" })).ok, true)
    await f.db.update(schema.subscription).set({ classesRemaining: 11 })
    assert.equal((await f.mark("monthly")).success, true)
    assert.equal((await f.payments()).length, 1)
    assert.equal((await f.db.select().from(schema.subscription))[0].classesRemaining, 11)
  } finally { f.raw.close() }
})

test("Sólo staff autorizado en su clase puede modificar reservas confirmadas", async () => {
  const f = await fixture()
  try {
    for (const actor of [{ ...f.actor, name: "Otra coach" }, { ...f.actor, role: "alumno" }]) {
      assert.equal((await recordCoachAttendance(f.db, { bookingId: "b", attended: true, catalogId: "monthly", actor })).success, false)
    }
    await f.db.update(schema.booking).set({ status: "cancelled" })
    assert.equal((await f.mark("plan-individual")).success, false)
    assert.equal((await f.payments()).length, 0)
  } finally { f.raw.close() }
})

test("Falla al guardar: se revierte tanto el plan y cargo como la asistencia", async () => {
  const f = await fixture()
  try {
    f.raw.exec("CREATE TRIGGER fail_notification BEFORE INSERT ON notification BEGIN SELECT RAISE(ABORT, 'test failure'); END")
    await assert.rejects(() => f.mark("monthly"))
    assert.equal((await f.payments()).length, 0)
    assert.equal((await f.db.select().from(schema.subscription)).length, 0)
    assert.equal((await f.db.select().from(schema.booking))[0].attended, null)
  } finally { f.raw.close() }
})

test("Cobros anulados, clases muestra y catálogo inactivo requieren revisión; no crean cargos", async () => {
  const f = await fixture()
  try {
    await f.db.update(schema.plan).set({ isActive: false }).where(eq(schema.plan.id, "monthly"))
    assert.equal((await f.mark("monthly")).success, false)
    await f.db.update(schema.booking).set({ trialClass: true })
    assert.equal((await f.mark("plan-individual")).success, false)
    await f.db.update(schema.booking).set({ trialClass: false })
    await f.db.insert(schema.payment).values({ id: "cancelled", userId: "u", bookingId: "b", amount: 200, status: "cancelled" })
    assert.equal((await f.mark("plan-individual")).success, false)
    assert.equal((await f.mark()).success, true)
    assert.equal((await f.payments()).length, 1)
  } finally { f.raw.close() }
})

test("El alumno renueva desde su cuenta al vencer y después de que admin salde el periodo anterior", async () => {
  const f = await fixture()
  try {
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly" })).ok, true)
    await f.db.update(schema.subscription).set({ endDate: new Date("2020-01-01") })
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly", renewal: true })).ok, false)
    await f.db.update(schema.payment).set({ status: "succeeded" })
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly", renewal: true })).ok, true)
    const charges = await f.payments()
    assert.equal(charges.length, 2)
    assert.equal(charges.filter((p) => p.status === "pending").length, 1)
  } finally { f.raw.close() }
})


test("Dos envíos simultáneos no duplican el plan ni descuentan dos clases", async () => {
  const f = await fixture()
  try {
    const results = await Promise.all([f.mark("monthly"), f.mark("monthly")])
    assert.ok(results.every((result) => result.success))
    assert.equal((await f.payments()).length, 1)
    assert.equal((await f.db.select().from(schema.subscription))[0].classesRemaining, 11)
  } finally { f.raw.close() }
})
