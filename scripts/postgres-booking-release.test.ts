import assert from "node:assert/strict"
import { test } from "node:test"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { AnyDb } from "../lib/db"
import {
  createBookingForUser, cancelBookingById, markBookingTakenForUser,
} from "../lib/booking-service"

// Sólo se permite la instancia desechable de esta auditoría; nunca producción.
const url = process.env.PG_RELEASE_TEST_URL
const enabled = url != null && process.env.DB_DRIVER === "postgres"

test("PostgreSQL: extra individual, cancelación y clase tomada", { skip: !enabled }, async () => {
  assert.equal(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, url)
  const parsed = new URL(url!)
  assert.equal(parsed.hostname, "127.0.0.1")
  assert.equal(parsed.port, "55439")
  assert.equal(parsed.pathname, "/pilates_audit")
  const sql = postgres(url!, { max: 2 })
  const db = drizzle(sql) as unknown as AnyDb
  const prefix = `release-${crypto.randomUUID()}`
  const userId = `${prefix}-user`
  const planId = `${prefix}-plan`
  const subId = `${prefix}-sub`
  const slotId = `${prefix}-slot`
  const otherSlot = `${prefix}-other`
  const bookingDate = new Date()
  bookingDate.setDate(bookingDate.getDate() + 14)
  bookingDate.setHours(12, 0, 0, 0)
  if (bookingDate.getDay() === 0) bookingDate.setDate(bookingDate.getDate() + 1)
  const day = bookingDate.getDay()
  try {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${userId}, 'Release test', ${userId + '@example.invalid'})`
    await sql`INSERT INTO plan (id, name, plan_type, days_per_week, price_mxn, duration_days)
      VALUES (${planId}, 'Test 3 por semana', 'monthly', 3, 1000, 30)`
    await sql`INSERT INTO subscription (id, user_id, plan_id, end_date, classes_remaining)
      VALUES (${subId}, ${userId}, ${planId}, '2099-12-31', 9)`
    for (const id of [slotId, otherSlot]) await sql`INSERT INTO schedule_slot
      (id, class_name, day_of_week, start_time, end_time, capacity)
      VALUES (${id}, 'Test Pilates', ${day}, '10:00', '11:00', 10)`
    for (let i = 0; i < 3; i++) await sql`INSERT INTO booking
      (id, user_id, schedule_slot_id, booking_date) VALUES (${prefix + '-' + i}, ${userId}, ${otherSlot}, ${bookingDate.toISOString()})`
    const params = { userId, scheduleSlotId: slotId, bookingDate }
    // Las 3 por semana son sugerencia: la cuarta se descuenta del plan.
    const overSuggestion = await createBookingForUser(db, params)
    if (!overSuggestion.ok) throw new Error(overSuggestion.message)
    assert.equal(overSuggestion.coveredByPlan, true)
    const [afterPlan] = await sql`SELECT classes_remaining FROM subscription WHERE id = ${subId}`
    assert.equal(afterPlan.classes_remaining, 8)
    const released = await cancelBookingById(db, overSuggestion.bookingId, { bypassPolicy: true })
    assert.equal(released.ok, true)
    if (released.ok) assert.equal(released.restoredClass, true)
    // Sin clases en el plan, la reserva queda fuera de él: es una individual.
    await sql`UPDATE subscription SET classes_remaining = 0 WHERE id = ${subId}`
    const extra = await createBookingForUser(db, params)
    if (!extra.ok) throw new Error(extra.message)
    assert.equal(extra.coveredByPlan, false)
    await sql`INSERT INTO payment (id, user_id, booking_id, amount, method, status)
      VALUES (${prefix + '-payment'}, ${userId}, ${extra.bookingId}, 250, 'efectivo', 'pending')`
    const cancelled = await cancelBookingById(db, extra.bookingId, { bypassPolicy: true })
    assert.equal(cancelled.ok, true)
    if (cancelled.ok) assert.equal(cancelled.restoredClass, false)
    const [balance] = await sql`SELECT classes_remaining FROM subscription WHERE id = ${subId}`
    assert.equal(balance.classes_remaining, 0)
    const [payment] = await sql`SELECT status FROM payment WHERE booking_id = ${extra.bookingId}`
    assert.equal(payment.status, 'cancelled')
    assert.equal((await cancelBookingById(db, extra.bookingId, { bypassPolicy: true })).ok, false)

    const takenId = `${prefix}-taken`
    await sql`INSERT INTO booking (id, user_id, schedule_slot_id, booking_date, attended)
      VALUES (${takenId}, ${userId}, ${slotId}, '2026-01-05 12:00:00', false)`
    const now = new Date("2026-01-05T16:00:00Z")
    const takenResults = await Promise.all([
      markBookingTakenForUser(db, { userId, bookingId: takenId, now }),
      markBookingTakenForUser(db, { userId, bookingId: takenId, now }),
    ])
    assert.equal(takenResults.filter((r) => r.ok).length, 1)
    const [taken] = await sql`SELECT taken_at, attended, status FROM booking WHERE id = ${takenId}`
    assert.ok(taken.taken_at)
    assert.equal(taken.attended, false)
    assert.equal(taken.status, 'confirmed')
    assert.equal((await cancelBookingById(db, takenId, { bypassPolicy: true })).ok, false)
  } finally {
    await sql`DELETE FROM "user" WHERE id = ${userId}`
    await sql`DELETE FROM plan WHERE id = ${planId}`
    await sql`DELETE FROM schedule_slot WHERE id IN (${slotId}, ${otherSlot})`
    await sql.end()
  }
})
