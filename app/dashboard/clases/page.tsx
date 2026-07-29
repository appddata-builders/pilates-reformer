export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and, gte, lte, asc } from "drizzle-orm"
import { hidesInstructorAssignment } from "@/lib/instructor-visibility"
import { nextOccurrenceForDayOfWeek, toLocalDateStr } from "@/lib/booking-slot-options"
import { isSlotPastToday } from "@/lib/class-timing"
import { listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { getMondayOfWeek } from "@/lib/site/schedule"
import { ClasesClient } from "./clases-client"
import type { SlotCardData } from "./slot-card"
export default async function ClasesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = session?.user?.role ?? ""
  const hideInstructor = hidesInstructorAssignment(role)
  const canManage = role === "admin" || role === "root"

  const db = getDb()

  const allSlots = await db
    .select()
    .from(schema.scheduleSlot)
    .orderBy(schema.scheduleSlot.dayOfWeek, schema.scheduleSlot.startTime)

  // Sin filtro por instructor: el coach ve todo el horario para poder cubrir.
  const slots = allSlots

  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + 7)
  rangeEnd.setHours(23, 59, 59, 999)

  const exceptionRangeStart = getMondayOfWeek(new Date(), 0)
  exceptionRangeStart.setHours(0, 0, 0, 0)
  const exceptionRangeEnd = new Date(exceptionRangeStart)
  exceptionRangeEnd.setDate(exceptionRangeEnd.getDate() + 7 * 8 + 6)
  exceptionRangeEnd.setHours(23, 59, 59, 999)

  const bookingCounts = await db
    .select({
      slotId: schema.booking.scheduleSlotId,
      bookingDate: schema.booking.bookingDate,
    })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, rangeStart),
        lte(schema.booking.bookingDate, rangeEnd),
      ),
    )

  const countMap = new Map<string, number>()
  for (const slot of slots) {
    const nextDateStr = toLocalDateStr(nextOccurrenceForDayOfWeek(slot.dayOfWeek))
    let n = 0
    for (const row of bookingCounts) {
      if (row.slotId !== slot.id) continue
      if (toLocalDateStr(row.bookingDate) !== nextDateStr) continue
      n++
    }
    countMap.set(slot.id, n)
  }

  const disabledKeys = await listDisabledSlotDateKeys(db, exceptionRangeStart, exceptionRangeEnd)
  const disabledBySlot = new Map<string, string[]>()
  for (const key of disabledKeys) {
    const sep = key.indexOf("|")
    if (sep < 0) continue
    const slotId = key.slice(0, sep)
    const dateStr = key.slice(sep + 1)
    const list = disabledBySlot.get(slotId) ?? []
    list.push(dateStr)
    disabledBySlot.set(slotId, list)
  }

  const activeCount = slots.filter((s) => s.isActive).length

  const coaches = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
    })
    .from(schema.user)
    .where(eq(schema.user.role, "coach"))
    .orderBy(asc(schema.user.name))

  const slotCards: SlotCardData[] = slots.map((slot) => ({
    id: slot.id,
    className: slot.className,
    // Al coach ni se le manda la asignación: no viaja al navegador.
    instructor: hideInstructor ? null : slot.instructor,
    alternateInstructor: hideInstructor ? null : (slot.alternateInstructor ?? null),
    scheduleMode: slot.scheduleMode ?? "fixed",
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    classType: slot.classType,
    isActive: slot.isActive,
    bookedToday: countMap.get(slot.id) ?? 0,
    disabledDates: disabledBySlot.get(slot.id) ?? [],
    nextDateStr: toLocalDateStr(nextOccurrenceForDayOfWeek(slot.dayOfWeek)),
    isPast: isSlotPastToday(slot, now),
  }))

  return (
    <ClasesClient
      slots={slotCards}
      activeCount={activeCount}
      coaches={canManage ? coaches : []}
      canManage={canManage}
      todayDow={now.getDay()}
      todayKey={toLocalDateStr(now)}
    />
  )
}
