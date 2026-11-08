import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import type { AnyDb } from "../lib/db"
import { checkBookableSubscriptionForUser, findBookingOnDate } from "../lib/booking-service"

// Ejecutar con DB_DRIVER=sqlite node --import tsx --test scripts/booking-availability.test.ts
function fixture(weeklyLimit: number, unlimited = false) {
  const raw = new Database(":memory:")
  raw.exec(`
    CREATE TABLE plan (id TEXT, plan_type TEXT, days_per_week INTEGER);
    CREATE TABLE subscription (id TEXT, user_id TEXT, status TEXT, end_date INTEGER,
      is_unlimited INTEGER, classes_remaining INTEGER, plan_id TEXT);
    CREATE TABLE schedule_slot (id TEXT, start_time TEXT, class_name TEXT);
    CREATE TABLE booking (id TEXT, user_id TEXT, schedule_slot_id TEXT,
      booking_date INTEGER, status TEXT, taken_at INTEGER);
  `)
  raw.prepare("INSERT INTO plan VALUES ('p', 'monthly', ?)").run(weeklyLimit)
  raw.prepare("INSERT INTO subscription VALUES ('sub', 'u', 'active', ?, ?, 20, 'p')")
    .run(new Date("2099-12-31T12:00:00").getTime(), Number(unlimited))
  raw.exec("INSERT INTO schedule_slot VALUES ('slot', '07:00', 'Pilates')")
  const day = new Date("2026-09-07T12:00:00")
  function add(id: string, taken: boolean) {
    raw.prepare("INSERT INTO booking VALUES (?, 'u', 'slot', ?, 'confirmed', ?)")
      .run(id, day.getTime(), taken ? day.getTime() : null)
  }
  return { raw, db: drizzle(raw) as AnyDb, day, add }
}

for (const limit of [3, 5]) {
  test(`Las ${limit} por semana son sugerencia: pasarse sólo avisa`, async () => {
    const { raw, db, day, add } = fixture(limit)
    try {
      add("taken", true)
      assert.equal(await findBookingOnDate(db, "u", day), null)
      for (let used = 1; used < limit; used++) {
        const below = await checkBookableSubscriptionForUser(db, "u", day)
        assert.equal(below.ok, true)
        if (below.ok) assert.equal(below.overWeeklySuggestion, undefined)
        add(`reserved-${used}`, false)
      }
      // Ya va en lo sugerido: se puede reservar igual, con el aviso.
      const result = await checkBookableSubscriptionForUser(db, "u", day)
      assert.equal(result.ok, true)
      if (result.ok) assert.deepEqual(result.overWeeklySuggestion, { limit, usedThisWeek: limit })
      assert.equal((await findBookingOnDate(db, "u", day))?.id, "reserved-1")
      const nextWeek = new Date(day)
      nextWeek.setDate(day.getDate() + 7)
      const fresh = await checkBookableSubscriptionForUser(db, "u", nextWeek)
      assert.equal(fresh.ok, true)
      if (fresh.ok) assert.equal(fresh.overWeeklySuggestion, undefined)
    } finally { raw.close() }
  })
}

test("El plan ilimitado no hereda el límite semanal", async () => {
  const { raw, db, day, add } = fixture(3, true)
  try {
    for (let i = 0; i < 6; i++) add(String(i), true)
    assert.equal((await checkBookableSubscriptionForUser(db, "u", day)).ok, true)
  } finally { raw.close() }
})
