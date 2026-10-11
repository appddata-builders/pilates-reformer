import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateStudentRelease } from "../lib/cancellation-policy"

// node --import tsx --test scripts/student-release.test.ts
const policy = { cancelMinutes: 360 }
const classStart = new Date("2026-10-20T08:00:00")
const hoursBefore = (h: number) => new Date(classStart.getTime() - h * 60 * 60 * 1000)

test("Con 6 horas o más se libera cualquier clase del plan, de esta semana o de otra", () => {
  assert.deepEqual(evaluateStudentRelease(hoursBefore(6), classStart, policy), { ok: true, restoreClass: true, late: false })
  assert.equal(evaluateStudentRelease(hoursBefore(24 * 9), classStart, policy).ok, true)
})

test("Con menos de 6 horas no se libera ni se cambia de horario", () => {
  assert.deepEqual(evaluateStudentRelease(hoursBefore(5.9), classStart, policy), {
    ok: false,
    message: "Solo se pueden liberar las clases con 6 horas de anticipación.",
  })
  assert.deepEqual(evaluateStudentRelease(hoursBefore(1), classStart, policy, "cambiar de horario"), {
    ok: false,
    message: "Solo se pueden cambiar de horario las clases con 6 horas de anticipación.",
  })
  assert.equal(evaluateStudentRelease(hoursBefore(-1), classStart, policy).ok, false)
})
