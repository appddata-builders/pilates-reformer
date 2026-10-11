import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { eq } from "drizzle-orm"
import type { AnyDb } from "../lib/db"
import * as schema from "../lib/db/schema.sqlite"
import { recordCoachAttendance, recordWalkInAttendance, searchAttendanceCandidates } from "../lib/coach-attendance"
import { requestPlan } from "../lib/plan-requests"
import { applyUserPlan } from "../lib/activate-subscription"

// DB_DRIVER=sqlite node --import tsx --test scripts/coach-attendance.test.ts
async function fixture() {
  const raw = new Database(":memory:")
  for (const table of [schema.user, schema.plan, schema.subscription, schema.payment,
    schema.booking, schema.scheduleSlot, schema.notification, schema.scheduleSlotException]) {
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

test("Cualquier coach registra asistencia, aunque no sea la instructora; una alumna no", async () => {
  const f = await fixture()
  try {
    const alumna = { ...f.actor, role: "alumno" }
    assert.equal((await recordCoachAttendance(f.db, { bookingId: "b", attended: true, catalogId: "monthly", actor: alumna })).success, false)
    const otraCoach = { ...f.actor, name: "Otra coach" }
    assert.deepEqual(await recordCoachAttendance(f.db, { bookingId: "b", attended: false, actor: otraCoach }), { success: true })
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

test("Al renovar, las clases sin usar del plan vencido pasan al plan nuevo", async () => {
  const f = await fixture()
  try {
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly" })).ok, true)
    // Usó 7 de 12 y el periodo venció; ya pagó el plan anterior.
    await f.db.update(schema.subscription).set({ endDate: new Date("2020-01-01"), classesRemaining: 5 })
    await f.db.update(schema.payment).set({ status: "succeeded" })
    const renewed = await requestPlan(f.db, { userId: "u", planId: "monthly", renewal: true })
    assert.equal(renewed.ok, true)
    assert.match(renewed.ok ? renewed.message : "", /5 clases/)
    const subs = await f.db.select().from(schema.subscription)
    const old = subs.find((s) => s.status === "expired")
    const current = subs.find((s) => s.status === "active")
    assert.equal(old?.classesRemaining, 0)
    assert.equal(current?.classesRemaining, 12 + 5)
  } finally { f.raw.close() }
})

test("El admin renueva o cambia un plan vencido y conserva las clases que quedaban", async () => {
  const f = await fixture()
  try {
    assert.equal((await applyUserPlan(f.db, { userId: "u", planId: "monthly" })).ok, true)
    await f.db.update(schema.subscription).set({ endDate: new Date("2020-01-01"), classesRemaining: 4 })
    await f.db.insert(schema.plan).values({ id: "pack", name: "Paquete", priceMxn: 900, totalClasses: 8, planType: "class_pack", daysPerWeek: 0, durationDays: 30 })
    assert.equal((await applyUserPlan(f.db, { userId: "u", planId: "pack" })).ok, true)
    const active = (await f.db.select().from(schema.subscription)).filter((s) => s.status === "active")
    assert.equal(active.length, 1)
    assert.equal(active[0].classesRemaining, 8 + 4)
    // El cobro del periodo vencido sigue vivo: esas clases se pagan.
    assert.equal((await f.payments()).filter((p) => p.status === "pending").length, 2)
  } finally { f.raw.close() }
})

test("La coach inicia plan con la asistencia y suma las clases del periodo vencido", async () => {
  const f = await fixture()
  try {
    assert.equal((await requestPlan(f.db, { userId: "u", planId: "monthly" })).ok, true)
    await f.db.update(schema.subscription).set({ endDate: new Date("2020-01-01"), classesRemaining: 2 })
    await f.db.update(schema.payment).set({ status: "succeeded" })
    assert.deepEqual(await f.mark("monthly"), { success: true })
    const active = (await f.db.select().from(schema.subscription)).filter((s) => s.status === "active")
    // 12 del plan + 2 heredadas - 1 de la asistencia de hoy.
    assert.equal(active[0].classesRemaining, 12 + 2 - 1)
  } finally { f.raw.close() }
})

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

async function walkInFixture() {
  const f = await fixture()
  // Otra alumna, sin reserva, y la clase de hoy llena con la reserva "b".
  await f.db.insert(schema.user).values({ id: "w", name: "Walk In", email: "walk.in@example.test", cognitoId: "w", role: "alumno", enabled: true })
  await f.db.update(schema.scheduleSlot).set({ isActive: true, capacity: 1 })
  const walkIn = (catalogId?: string, userId = "w") =>
    recordWalkInAttendance(f.db, { userId, scheduleSlotId: "slot", dateStr: todayStr(), catalogId, actor: f.actor })
  return { ...f, walkIn }
}

test("Asistencia sin reserva: aparta el lugar aunque la clase esté llena y descuenta del plan", async () => {
  const f = await walkInFixture()
  try {
    assert.equal((await requestPlan(f.db, { userId: "w", planId: "monthly" })).ok, true)
    assert.deepEqual(await f.walkIn(), { success: true })
    const bookings = (await f.db.select().from(schema.booking)).filter((b) => b.userId === "w")
    assert.equal(bookings.length, 1)
    assert.equal(bookings[0].attended, true)
    assert.equal(bookings[0].status, "confirmed")
    const sub = (await f.db.select().from(schema.subscription)).find((s) => s.userId === "w")
    assert.equal(sub?.classesRemaining, 11)
    // Repetirlo reutiliza la reserva: no duplica ni vuelve a descontar.
    assert.deepEqual(await f.walkIn(), { success: true })
    assert.equal((await f.db.select().from(schema.booking)).filter((b) => b.userId === "w").length, 1)
    assert.equal((await f.db.select().from(schema.subscription)).find((s) => s.userId === "w")?.classesRemaining, 11)
  } finally { f.raw.close() }
})

test("Asistencia sin reserva sin plan: cobra la clase elegida o inicia el plan con una sola clase descontada", async () => {
  const f = await walkInFixture()
  try {
    assert.deepEqual(await f.walkIn("plan-individual"), { success: true })
    const charges = (await f.payments()).filter((p) => p.userId === "w")
    assert.equal(charges.length, 1)
    assert.equal(charges[0].amount, 200)

    await f.db.insert(schema.user).values({ id: "x", name: "Nueva", email: "nueva@example.test", cognitoId: "x", role: "alumno", enabled: true })
    assert.deepEqual(await f.walkIn("monthly", "x"), { success: true })
    const sub = (await f.db.select().from(schema.subscription)).find((s) => s.userId === "x")
    assert.equal(sub?.classesRemaining, 11)
  } finally { f.raw.close() }
})

test("Asistencia sin reserva que no procede no deja reserva a medias", async () => {
  const f = await walkInFixture()
  try {
    await f.db.update(schema.plan).set({ isActive: false }).where(eq(schema.plan.id, "monthly"))
    assert.equal((await f.walkIn("monthly")).success, false)
    assert.equal((await f.db.select().from(schema.booking)).filter((b) => b.userId === "w").length, 0)
    // Ni para staff que no es coach/admin ni para cuentas que no son alumn@s.
    const asAlumna = await recordWalkInAttendance(f.db, { userId: "w", scheduleSlotId: "slot", dateStr: todayStr(), actor: { ...f.actor, role: "alumno" } })
    assert.equal(asAlumna.success, false)
    await f.db.insert(schema.user).values({ id: "c2", name: "Coach Dos", email: "coach@example.test", cognitoId: "c2", role: "coach", enabled: true })
    assert.equal((await f.walkIn(undefined, "c2")).success, false)
    assert.equal((await f.db.select().from(schema.booking)).length, 1)
  } finally { f.raw.close() }
})

test("El buscador encuentra a cualquier alumn@ por correo o nombre, con su plan", async () => {
  const f = await walkInFixture()
  try {
    await f.db.update(schema.user).set({ enabled: true })
    assert.equal((await requestPlan(f.db, { userId: "w", planId: "monthly" })).ok, true)
    const byEmail = await searchAttendanceCandidates(f.db, "WALK.IN@")
    assert.deepEqual(byEmail.map((c) => [c.id, c.planLabel]), [["w", "Plan vigente · 12 clases"]])
    const byName = await searchAttendanceCandidates(f.db, "alumna")
    assert.deepEqual(byName.map((c) => [c.id, c.planLabel]), [["u", "Sin plan"]])
    assert.deepEqual(await searchAttendanceCandidates(f.db, "a"), [])
  } finally { f.raw.close() }
})
