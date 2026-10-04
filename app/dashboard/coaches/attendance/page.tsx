export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { PageHeader } from "@/components/features/admin/page-header"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { dateRangeForDay, localTodayStr } from "@/lib/booking-slot-options"
import { coachTeachesSlot, formatSlotInstructorLabel } from "@/lib/schedule-instructor"
import { formatTimeRange12h } from "@/lib/time-utils"
import { AttendanceMarkForm } from "./attendance-mark-form"

type SearchParams = Promise<{ date?: string }>

export default async function CoachAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const session = await getSession()
  const role = typeof session?.user?.role === "string" ? session.user.role : ""
  const coachName =
    typeof session?.user?.name === "string" ? session.user.name.trim() : ""

  const todayStr = localTodayStr()
  const dateStr = params.date ?? todayStr
  const { start: dayStart, end: dayEnd } = dateRangeForDay(dateStr)

  const db = getDb()

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
      studentName: schema.user.name,
      studentEmail: schema.user.email,
      slotId: schema.scheduleSlot.id,
      className: schema.scheduleSlot.className,
      instructor: schema.scheduleSlot.instructor,
      alternateInstructor: schema.scheduleSlot.alternateInstructor,
      scheduleMode: schema.scheduleSlot.scheduleMode,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(and(...conditions))
    .orderBy(schema.scheduleSlot.startTime, schema.user.name)

  const bookings =
    role === "coach" && coachName !== ""
      ? bookingRows.filter((row) =>
          coachTeachesSlot(
            {
              instructor: row.instructor,
              alternateInstructor: row.alternateInstructor,
              scheduleMode: row.scheduleMode,
            },
            coachName,
          ),
        )
      : bookingRows

  type SlotGroup = {
    slotId: string
    className: string
    instructor: string | null
    startTime: string
    endTime: string | null
    dayOfWeek: number
    bookings: typeof bookings
  }
  const slotMap = new Map<string, SlotGroup>()

  for (const row of bookings) {
    const instructorLabel = formatSlotInstructorLabel({
      instructor: row.instructor,
      alternateInstructor: row.alternateInstructor,
      scheduleMode: row.scheduleMode,
    })
    if (!slotMap.has(row.slotId)) {
      slotMap.set(row.slotId, {
        slotId: row.slotId,
        className: row.className,
        instructor: instructorLabel,
        startTime: row.startTime,
        endTime: row.endTime ?? null,
        dayOfWeek: row.dayOfWeek,
        bookings: [],
      })
    }
    slotMap.get(row.slotId)!.bookings.push(row)
  }

  const slots = Array.from(slotMap.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )

  const dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const title = dateStr === todayStr ? "Asistencia de hoy" : "Asistencia"

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={title} description={dateLabel}>
        <form method="get" action="/dashboard/coaches/attendance" className="flex gap-2 items-center">
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

      {slots.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No hay reservas confirmadas para este día
          {role === "coach" && coachName !== "" ? " en tus clases" : ""}.
        </div>
      ) : (
        <div className="space-y-6">
          {slots.map((slot) => (
            <div key={slot.slotId} className="rounded-lg border bg-card">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                  <p className="font-semibold text-base">{slot.className}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatTimeRange12h(slot.startTime, slot.endTime)}
                    {slot.instructor ? ` · ${slot.instructor}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {slot.bookings.length} reserva{slot.bookings.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <ul className="divide-y">
                {slot.bookings.map((b) => (
                  <li key={b.bookingId} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{b.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.studentEmail}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <AttendanceMarkForm bookingId={b.bookingId} attended="true" dateStr={dateStr}>
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            b.attended === true
                              ? "bg-green-100 border-green-300 text-green-700"
                              : "border-border text-muted-foreground hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                          }`}
                        >
                          ✓ Asistió
                        </button>
                      </AttendanceMarkForm>

                      <AttendanceMarkForm bookingId={b.bookingId} attended="false" dateStr={dateStr}>
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            b.attended === false
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "border-border text-muted-foreground hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                          }`}
                        >
                          ✗ No asistió
                        </button>
                      </AttendanceMarkForm>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
