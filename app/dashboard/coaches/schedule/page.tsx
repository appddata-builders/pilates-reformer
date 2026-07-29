export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { PageHeader } from "@/components/features/admin/page-header"
import { Badge } from "@/components/shared/ui/badge"
import { Card, CardContent } from "@/components/shared/ui/card"
import { CalendarDays, Clock, Users } from "lucide-react"
import { ScheduleSlotCard } from "./schedule-slot-card"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { formatTime12h, formatTimeRange12h } from "@/lib/time-utils"
import { nextOccurrenceForDayOfWeek, toLocalDateStr } from "@/lib/booking-slot-options"
import { listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { isSlotPastToday } from "@/lib/class-timing"
import { DaySection } from "./day-section"

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function formatBookingDateLabel(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Un horario sin hora de fin cuenta como una clase de 60 minutos.
function minutesBetween(start: string, end: string | null): number {
  if (end == null || end.trim() === "") return 60
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}

function StatTile(props: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {props.label}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">{props.value}</p>
          {props.hint ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{props.hint}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 p-2">
          <props.icon className="h-4 w-4 text-primary" />
        </span>
      </div>
    </div>
  )
}

export default async function CoachSchedulePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = session?.user?.role ?? ""
  const userId = getSessionUserId(session?.user)
  const isAlumno = isAlumnoRole(role)
  const canSeeRoster = role === "admin" || role === "root" || role === "coach"

  const db = getDb()

  if (isAlumno && userId != null) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const rows = await db
      .select({
        bookingId: schema.booking.id,
        bookingDate: schema.booking.bookingDate,
        status: schema.booking.status,
        className: schema.scheduleSlot.className,
        startTime: schema.scheduleSlot.startTime,
        endTime: schema.scheduleSlot.endTime,
      })
      .from(schema.booking)
      .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
      .where(
        and(
          eq(schema.booking.userId, userId),
          eq(schema.booking.status, "confirmed"),
          gte(schema.booking.bookingDate, today),
        ),
      )
      .orderBy(asc(schema.booking.bookingDate), asc(schema.scheduleSlot.startTime))

    const grouped = new Map<string, typeof rows>()
    for (const row of rows) {
      const d =
        row.bookingDate instanceof Date
          ? row.bookingDate
          : new Date(row.bookingDate as unknown as number)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    const days = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))

    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Mi Horario"
          description={`${rows.length} ${rows.length === 1 ? "clase reservada" : "clases reservadas"}`}
        />

        {days.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No tienes clases reservadas próximamente
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {days.map(([key, dayBookings]) => {
              const firstDate =
                dayBookings[0].bookingDate instanceof Date
                  ? dayBookings[0].bookingDate
                  : new Date(dayBookings[0].bookingDate as unknown as number)
              return (
                <section key={key}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatBookingDateLabel(firstDate)}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {dayBookings.map((row) => (
                      <Card key={row.bookingId} className="border shadow-sm">
                        <CardContent className="p-5">
                          <div className="mb-3 flex items-start justify-between">
                            <h3 className="text-base font-semibold">{row.className}</h3>
                            <Badge className="border-green-200 bg-green-100 text-xs text-green-700">
                              Confirmada
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>{formatTimeRange12h(row.startTime, row.endTime)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Horario completo del estudio: cualquier coach puede cubrir cualquier clase.
  const slots = await db
    .select()
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.isActive, true))
    .orderBy(schema.scheduleSlot.dayOfWeek, schema.scheduleSlot.startTime)

  const rangeStart = new Date()
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + 7)
  rangeEnd.setHours(23, 59, 59, 999)

  const [bookingRows, disabledKeys] = await Promise.all([
    db
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
      ),
    listDisabledSlotDateKeys(db, rangeStart, rangeEnd),
  ])

  // Reservas de la próxima ocurrencia de cada horario, para saber cómo viene.
  const bookedByKey = new Map<string, number>()
  for (const row of bookingRows) {
    const d =
      row.bookingDate instanceof Date
        ? row.bookingDate
        : new Date(row.bookingDate as unknown as number)
    const key = `${row.slotId}|${toLocalDateStr(d)}`
    bookedByKey.set(key, (bookedByKey.get(key) ?? 0) + 1)
  }

  const now = new Date()
  const todayDow = now.getDay()

  const cards = slots.map((slot) => {
    const occurrence = nextOccurrenceForDayOfWeek(slot.dayOfWeek)
    const dateStr = toLocalDateStr(occurrence)
    return {
      slot,
      occurrence,
      dateStr,
      booked: bookedByKey.get(`${slot.id}|${dateStr}`) ?? 0,
      disabled: disabledKeys.has(`${slot.id}|${dateStr}`),
      isPast: isSlotPastToday(slot, now),
      minutes: minutesBetween(slot.startTime, slot.endTime),
    }
  })

  const grouped = new Map<number, typeof cards>()
  for (const card of cards) {
    if (!grouped.has(card.slot.dayOfWeek)) grouped.set(card.slot.dayOfWeek, [])
    grouped.get(card.slot.dayOfWeek)!.push(card)
  }
  const days = Array.from(grouped.entries()).sort(([a], [b]) => a - b)

  const totalMinutes = cards.reduce((sum, c) => sum + c.minutes, 0)
  const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10
  const weekBookings = bookingRows.length
  const todayCards = grouped.get(todayDow) ?? []
  const activeDays = days.length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Horario semanal"
        description="Horario completo del estudio · cualquier coach puede cubrir una clase"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Clases por semana"
          value={String(cards.length)}
          hint={`${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}`}
          icon={CalendarDays}
        />
        <StatTile
          label="Reservas (7 días)"
          value={String(weekBookings)}
          hint={`${weeklyHours} h de clase`}
          icon={Clock}
        />
        <StatTile
          label="Hoy"
          value={String(todayCards.length)}
          hint={DAY_NAMES[todayDow]}
          icon={Users}
        />
        <StatTile
          label="Cupo por clase"
          value={String(slots[0]?.capacity ?? 0)}
          hint="Lugares disponibles"
          icon={Users}
        />
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Sin clases programadas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([dow, dayCards]) => (
            <DaySection
              key={dow}
              dayName={DAY_NAMES[dow]}
              dayShort={DAY_SHORT[dow]}
              classCount={dayCards.length}
              isToday={dow === todayDow}
            >
              <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dayCards.map(({ slot, booked, disabled, isPast, dateStr }) => (
                  <ScheduleSlotCard
                    key={slot.id}
                    canSeeRoster={canSeeRoster}
                    slot={{
                      id: slot.id,
                      className: slot.className,
                      startTime: slot.startTime,
                      timeLabel: formatTime12h(slot.startTime),
                      rangeLabel: formatTimeRange12h(slot.startTime, slot.endTime),
                      capacity: slot.capacity,
                      booked,
                      disabled,
                      isPast,
                      dateStr,
                    }}
                  />
                ))}
              </div>
            </DaySection>
          ))}
        </div>
      )}
    </div>
  )
}
