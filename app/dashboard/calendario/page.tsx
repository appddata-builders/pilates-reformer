export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { birthdateMonthDayKey } from "@/lib/birthdate"
import { formatSlotInstructorLabel } from "@/lib/schedule-instructor"
import { listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { formatTime12h } from "@/lib/time-utils"
import type { CalendarFeedEvent } from "./calendar-types"
import { CalendarShell } from "./calendar-shell"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function dayStart(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function localIsoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function colorForKind(kind: string) {
  if (kind === "general") return "#378ADD"
  if (kind === "class") return "#639922"
  if (kind === "holiday") return "#888780"
  if (kind === "birthday") return "#D4537E"
  if (kind === "expiry") return "#BA7517"
  if (kind === "maintenance") return "#E24B4A"
  return "#378ADD"
}

function includesStudioEvent(role: string, visibleTo: string) {
  if (role === "admin" || role === "root") return true
  if (role === "coach") return visibleTo === "coach" || visibleTo === "all"
  return false
}

function overlapsRange(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date) {
  const e = end ?? start
  return start.getTime() <= rangeEnd.getTime() && e.getTime() >= rangeStart.getTime()
}

export default async function CalendarioPage() {
  const session = await getSession()
  if (session == null) redirect("/login")

  const role = session.user.role
  if (role !== "admin" && role !== "root" && role !== "coach") redirect("/dashboard")

  const canManage = role === "admin" || role === "root"

  const now = new Date()
  const rangeStart = dayStart(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const rangeEnd = dayStart(new Date(now.getFullYear(), now.getMonth() + 2, 0))
  rangeEnd.setHours(23, 59, 59, 999)

  const db = getDb()
  const eventsOut: CalendarFeedEvent[] = []

  const [policyRow] = await db
    .select({ alertDaysBeforeExpiry: schema.studioPolicy.alertDaysBeforeExpiry })
    .from(schema.studioPolicy)
    .where(eq(schema.studioPolicy.id, "main"))
    .limit(1)
  const expiryDaysAhead = policyRow?.alertDaysBeforeExpiry ?? 14

  const slots = await db
    .select()
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.isActive, true))
    .orderBy(asc(schema.scheduleSlot.dayOfWeek), asc(schema.scheduleSlot.startTime))

  const slotById = new Map(slots.map((s) => [s.id, s]))
  const disabledKeys = await listDisabledSlotDateKeys(db, rangeStart, rangeEnd)

  const studioRows = await db.select().from(schema.studioEvent)
  for (const ev of studioRows) {
    if (!includesStudioEvent(role, ev.visibleTo)) continue
    const start = ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate as unknown as number)
    const end =
      ev.endDate == null
        ? null
        : ev.endDate instanceof Date
          ? ev.endDate
          : new Date(ev.endDate as unknown as number)
    if (!overlapsRange(start, end, rangeStart, rangeEnd)) continue
    const kind = ev.eventType
    const bg = ev.color != null && ev.color.trim() !== "" ? ev.color : colorForKind(kind)
    eventsOut.push({
      id: ev.id,
      title: ev.title,
      start: ev.allDay ? localDateStr(start) : localIsoFromDate(start),
      end:
        ev.allDay
          ? localDateStr(end ?? start)
          : end != null
            ? localIsoFromDate(end)
            : undefined,
      allDay: ev.allDay,
      backgroundColor: bg,
      extendedProps: {
        source: "studio",
        description: ev.description,
        eventType: ev.eventType,
        visibleTo: ev.visibleTo,
      },
    })
  }

  const bookingsData = await db
    .select({
      bookingDate: schema.booking.bookingDate,
      scheduleSlotId: schema.booking.scheduleSlotId,
      className: schema.scheduleSlot.className,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(
      and(
        gte(schema.booking.bookingDate, rangeStart),
        lte(schema.booking.bookingDate, rangeEnd),
        eq(schema.booking.status, "confirmed"),
      ),
    )

  const bookingMap = new Map<string, { count: number; className: string }>()
  for (const b of bookingsData) {
    const day = b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate as unknown as number)
    const ds = dayStart(day).getTime()
    const key = `${b.scheduleSlotId}_${ds}`
    const cur = bookingMap.get(key)
    const prevCount = cur?.count ?? 0
    bookingMap.set(key, { count: prevCount + 1, className: b.className })
  }

  for (const [key, v] of bookingMap.entries()) {
    const splitAt = key.lastIndexOf("_")
    if (splitAt <= 0) continue
    const slotId = key.slice(0, splitAt)
    const ms = Number(key.slice(splitAt + 1))
    if (Number.isNaN(ms)) continue
    const day = new Date(ms)
    const slotRow = slotById.get(slotId)
    const [sh, sm] = (slotRow?.startTime ?? "09:00").split(":").map(Number)
    const start = new Date(day)
    start.setHours(sh, sm ?? 0, 0, 0)
    let end: Date | null = null
    if (slotRow?.endTime != null && slotRow.endTime.includes(":")) {
      const [eh, em] = slotRow.endTime.split(":").map(Number)
      end = new Date(day)
      end.setHours(eh, em ?? 0, 0, 0)
    }
    const countLabel = v.count === 1 ? "1 reserva" : `${v.count} reservas`
    eventsOut.push({
      id: `booking:${key}`,
      title: `${countLabel} · ${v.className}`,
      start: localIsoFromDate(start),
      ...(end != null ? { end: localIsoFromDate(end) } : {}),
      backgroundColor: "#2d6b4f",
      borderColor: "#234f44",
      textColor: "#ffffff",
      classNames: ["cal-event-booking"],
      extendedProps: {
        source: "booking",
        description: null,
        eventType: "class",
      },
    })
  }

  const today = dayStart(now)
  const expiryHorizon = dayStart(now)
  expiryHorizon.setDate(expiryHorizon.getDate() + expiryDaysAhead)

  const subsExpiring = await db
    .select({
      userId: schema.subscription.userId,
      endDate: schema.subscription.endDate,
      userName: schema.user.name,
    })
    .from(schema.subscription)
    .innerJoin(schema.user, eq(schema.subscription.userId, schema.user.id))
    .where(
      and(
        eq(schema.subscription.status, "active"),
        gte(schema.subscription.endDate, today),
        lte(schema.subscription.endDate, expiryHorizon),
      ),
    )

  for (const s of subsExpiring) {
    const end = s.endDate instanceof Date ? s.endDate : new Date(s.endDate as unknown as number)
    const ds = dayStart(end)
    if (!overlapsRange(ds, ds, rangeStart, rangeEnd)) continue
    eventsOut.push({
      id: `expiry:${s.userId}:${ds.getTime()}`,
      title: `Vence plan: ${s.userName}`,
      start: localDateStr(ds),
      end: localDateStr(ds),
      allDay: true,
      backgroundColor: "#BA7517",
      borderColor: "#BA7517",
      textColor: "#ffffff",
      classNames: ["cal-event-expiry"],
      extendedProps: {
        source: "expiry",
        description: null,
        eventType: "expiry",
      },
    })
  }

  const alumnosBd = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      birthdate: schema.user.birthdate,
    })
    .from(schema.user)
    .where(eq(schema.user.role, "alumno"))

  for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t)
    const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    for (const u of alumnosBd) {
      if (typeof u.birthdate !== "string") continue
      const umb = birthdateMonthDayKey(u.birthdate)
      if (umb == null || umb !== md) continue
      const ds = dayStart(d)
      eventsOut.push({
        id: `bday:${u.id}:${ds.getTime()}`,
        title: `Cumpleaños: ${u.name}`,
        start: localDateStr(ds),
        end: localDateStr(ds),
        allDay: true,
        backgroundColor: "#D4537E",
        borderColor: "#D4537E",
        textColor: "#ffffff",
        classNames: ["cal-event-birthday"],
        extendedProps: {
          source: "birthday",
          description: null,
          eventType: "birthday",
        },
      })
    }
  }

  for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t)
    const dow = d.getDay()
    const dayKey = dayStart(d).getTime()
    const dateStr = localDateStr(d)
    for (const slot of slots) {
      if (slot.dayOfWeek !== dow) continue
      const bookingKey = `${slot.id}_${dayKey}`
      if (bookingMap.has(bookingKey)) continue
      const [sh, sm] = slot.startTime.split(":").map(Number)
      const start = new Date(d)
      start.setHours(sh, sm ?? 0, 0, 0)
      let end: Date | null = null
      if (slot.endTime != null && slot.endTime.includes(":")) {
        const [eh, em] = slot.endTime.split(":").map(Number)
        end = new Date(d)
        end.setHours(eh, em ?? 0, 0, 0)
      }
      const timeLabel = formatTime12h(slot.startTime)
      const disabled = disabledKeys.has(`${slot.id}|${dateStr}`)
      if (disabled) {
        eventsOut.push({
          id: `slot-off:${slot.id}:${dayKey}`,
          title: `${timeLabel} · ${slot.className} (no disponible)`,
          start: localIsoFromDate(start),
          ...(end != null ? { end: localIsoFromDate(end) } : {}),
          backgroundColor: "#f3f4f6",
          borderColor: "#9ca3af",
          textColor: "#6b7280",
          classNames: ["cal-event-schedule-off"],
          extendedProps: {
            source: "schedule",
            description: "Inhabilitada esta semana",
            eventType: "class",
          },
        })
        continue
      }
      eventsOut.push({
        id: `slot:${slot.id}:${dayKey}`,
        title: `${timeLabel} · ${slot.className} (libre)`,
        start: localIsoFromDate(start),
        ...(end != null ? { end: localIsoFromDate(end) } : {}),
        backgroundColor: "#e8f2ef",
        borderColor: "#2f6b5f",
        textColor: "#1a4d42",
        classNames: ["cal-event-schedule"],
        extendedProps: {
          source: "schedule",
          description: formatSlotInstructorLabel(slot),
          eventType: "class",
        },
      })
    }
  }

  return <CalendarShell events={eventsOut} canManage={canManage} />
}
