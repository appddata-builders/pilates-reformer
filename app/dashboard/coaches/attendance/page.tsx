export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { PageHeader } from "@/components/features/admin/page-header"
import { Button } from "@/components/shared/ui/button"
import { dateRangeForDay, localTodayStr } from "@/lib/booking-slot-options"
import { formatSlotInstructorLabel } from "@/lib/schedule-instructor"
import { formatTimeRange12h } from "@/lib/time-utils"
import { isSlotPastToday } from "@/lib/class-timing"
import { listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { AttendanceList, type AttendanceSlotGroup, type DaySlotOption } from "./attendance-list"
import { getAttendanceCatalog } from "@/lib/coach-attendance"
import { redirect } from "next/navigation"

type SearchParams = Promise<{ date?: string }>

export default async function CoachAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const session = await getSession()
  const role = typeof session?.user?.role === "string" ? session.user.role : ""

  if (!["coach", "admin", "root"].includes(role)) redirect("/dashboard")

  const todayStr = localTodayStr()
  const dateStr = params.date ?? todayStr
  const { start: dayStart, end: dayEnd } = dateRangeForDay(dateStr)

  const db = getDb()
  const catalog = await getAttendanceCatalog(db)

  const conditions = [
    gte(schema.booking.bookingDate, dayStart),
    lte(schema.booking.bookingDate, dayEnd),
    eq(schema.booking.status, "confirmed"),
  ]

  const bookingRows = await db
    .select({
      bookingId: schema.booking.id,
      bookingDate: schema.booking.bookingDate,
      status: schema.booking.status,
      attended: schema.booking.attended,
      countedAsAttended: schema.booking.countedAsAttended,
      studentId: schema.user.id,
      studentName: schema.user.name,
      studentEmail: schema.user.email,
      slotId: schema.scheduleSlot.id,
      className: schema.scheduleSlot.className,
      instructor: schema.scheduleSlot.instructor,
      alternateInstructor: schema.scheduleSlot.alternateInstructor,
      scheduleMode: schema.scheduleSlot.scheduleMode,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(and(...conditions))
    .orderBy(schema.scheduleSlot.startTime, schema.user.name)

  // Todas las clases del día, no sólo donde el coach figura como instructor:
  // cualquier coach puede cubrir una clase y registrar su asistencia.
  const slotMap = new Map<string, AttendanceSlotGroup & { startTime: string }>()

  for (const row of bookingRows) {
    if (!slotMap.has(row.slotId)) {
      const instructorLabel = formatSlotInstructorLabel({
        instructor: row.instructor,
        alternateInstructor: row.alternateInstructor,
        scheduleMode: row.scheduleMode,
      })
      const timeLabel = formatTimeRange12h(row.startTime, row.endTime ?? null)
      slotMap.set(row.slotId, {
        slotId: row.slotId,
        className: row.className,
        subtitle: instructorLabel ? `${timeLabel} · ${instructorLabel}` : timeLabel,
        startTime: row.startTime,
        bookings: [],
      })
    }
    slotMap.get(row.slotId)!.bookings.push({
      bookingId: row.bookingId,
      studentId: row.studentId,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      attended: row.attended,
    })
  }

  const slots = Array.from(slotMap.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )

  // Clases que se imparten ese día, para hacer presente a alguien sin reserva.
  const dayDate = new Date(`${dateStr}T12:00:00`)
  const [daySlotRows, disabledKeys] = await Promise.all([
    db
      .select({
        id: schema.scheduleSlot.id,
        className: schema.scheduleSlot.className,
        dayOfWeek: schema.scheduleSlot.dayOfWeek,
        startTime: schema.scheduleSlot.startTime,
        endTime: schema.scheduleSlot.endTime,
      })
      .from(schema.scheduleSlot)
      .where(and(eq(schema.scheduleSlot.isActive, true), eq(schema.scheduleSlot.dayOfWeek, dayDate.getDay())))
      .orderBy(schema.scheduleSlot.startTime),
    listDisabledSlotDateKeys(db, dayStart, dayEnd),
  ])
  const daySlots: DaySlotOption[] = daySlotRows
    .filter((slot) => !disabledKeys.has(`${slot.id}|${dateStr}`))
    .map((slot) => ({
      id: slot.id,
      label: `${formatTimeRange12h(slot.startTime, slot.endTime ?? null)} · ${slot.className}`,
    }))
  // Hoy se propone la clase en curso o la siguiente; otro día, la primera.
  const suggestedSlotId =
    (dateStr === todayStr
      ? daySlotRows.find((slot) => !isSlotPastToday(slot) && !disabledKeys.has(`${slot.id}|${dateStr}`))?.id
      : undefined) ?? daySlots[0]?.id ?? ""

  const dateLabel = dayDate.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const title = dateStr === todayStr ? "Asistencia de hoy" : "Asistencia"

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={title} description={dateLabel}>
        <form method="get" action="/dashboard/coaches/attendance" className="flex flex-wrap gap-2 items-center">
          <input
            key={dateStr}
            type="date"
            name="date"
            defaultValue={dateStr}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            Ver día
          </Button>
        </form>
      </PageHeader>

      <AttendanceList
        key={dateStr}
        slots={slots}
        catalog={catalog}
        dateStr={dateStr}
        daySlots={daySlots}
        suggestedSlotId={suggestedSlotId}
      />
    </div>
  )
}
