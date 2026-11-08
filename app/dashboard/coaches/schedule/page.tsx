export const dynamic = "force-dynamic"

import Link from "next/link"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { PageHeader } from "@/components/features/admin/page-header"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { Card, CardContent } from "@/components/shared/ui/card"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react"
import { ScheduleSlotCard } from "./schedule-slot-card"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { formatTime12h, formatTimeRange12h } from "@/lib/time-utils"
import { toLocalDateStr } from "@/lib/booking-slot-options"
import { listDisabledSlotDateKeys } from "@/lib/slot-exceptions"
import { isSlotPastToday } from "@/lib/class-timing"
import { occurrenceDateForWeek } from "@/lib/slot-week-options"
import { getMondayOfWeek } from "@/lib/site/schedule"
import { routes } from "@/lib/routes"
import { DaySection } from "./day-section"

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MAX_WEEK_OFFSET = 52

type SearchParams = Promise<{ semana?: string }>

/** `?semana=` es el desplazamiento en semanas respecto a la actual (negativo = pasadas). */
function parseWeekOffset(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10)
  if (Number.isNaN(n)) return 0
  return Math.max(-MAX_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, n))
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  const year = sunday.getFullYear()
  if (monday.getMonth() === sunday.getMonth()) {
    const month = sunday.toLocaleDateString("es-MX", { month: "long" })
    return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${month} de ${year}`
  }
  return `Semana del ${formatDayMonth(monday)} al ${formatDayMonth(sunday)} de ${year}`
}

function weekCaption(offset: number): string {
  if (offset === 0) return "Esta semana"
  if (offset === 1) return "Próxima semana"
  if (offset === -1) return "Semana pasada"
  return offset > 0 ? `En ${offset} semanas` : `Hace ${-offset} semanas`
}

function weekHref(offset: number): string {
  return offset === 0 ? routes.coachSchedule : `${routes.coachSchedule}?semana=${offset}`
}

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

export default async function CoachSchedulePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const session = await getSession()
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

  // Semana que se consulta (lunes a domingo). En domingo el estudio no abre, así
  // que "esta semana" pasa a ser la que empieza mañana.
  const now = new Date()
  const todayStr = toLocalDateStr(now)
  const todayDow = now.getDay()
  const weekOffset = parseWeekOffset(params.semana)
  const monday = getMondayOfWeek(now, (todayDow === 0 ? 1 : 0) + weekOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

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
          gte(schema.booking.bookingDate, monday),
          lte(schema.booking.bookingDate, sunday),
        ),
      ),
    listDisabledSlotDateKeys(db, monday, sunday),
  ])

  const bookedByKey = new Map<string, number>()
  for (const row of bookingRows) {
    const d =
      row.bookingDate instanceof Date
        ? row.bookingDate
        : new Date(row.bookingDate as unknown as number)
    const key = `${row.slotId}|${toLocalDateStr(d)}`
    bookedByKey.set(key, (bookedByKey.get(key) ?? 0) + 1)
  }

  const cards = slots.map((slot) => {
    const occurrence = occurrenceDateForWeek(slot.dayOfWeek, monday)
    const dateStr = toLocalDateStr(occurrence)
    // Los días anteriores a hoy quedan de solo lectura.
    const isPastDay = dateStr < todayStr
    return {
      slot,
      occurrence,
      dateStr,
      booked: bookedByKey.get(`${slot.id}|${dateStr}`) ?? 0,
      disabled: disabledKeys.has(`${slot.id}|${dateStr}`),
      isPast: isPastDay || (dateStr === todayStr && isSlotPastToday(slot, now)),
      readOnly: isPastDay,
      minutes: minutesBetween(slot.startTime, slot.endTime),
    }
  })

  const grouped = new Map<string, typeof cards>()
  for (const card of cards) {
    if (!grouped.has(card.dateStr)) grouped.set(card.dateStr, [])
    grouped.get(card.dateStr)!.push(card)
  }
  const days = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Se abre el día de hoy; si no cae en esta semana, el siguiente día con clases
  // y, en semanas pasadas, el primero.
  const openDateStr =
    days.find(([dateStr]) => dateStr === todayStr)?.[0] ??
    days.find(([dateStr]) => dateStr > todayStr)?.[0] ??
    days[0]?.[0]

  const weekCards = cards.filter((c) => !c.disabled)
  const totalMinutes = weekCards.reduce((sum, c) => sum + c.minutes, 0)
  const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10
  const weekBookings = bookingRows.length
  const todayCount = slots.filter((s) => s.dayOfWeek === todayDow).length
  const activeDays = days.length
  const todayLabel = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Horario semanal"
        description="Horario completo del estudio · cualquier coach puede cubrir una clase"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {weekCaption(weekOffset)}
          </p>
          <p className="text-base font-semibold">{formatWeekLabel(monday, sunday)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href={weekHref(weekOffset - 1)} aria-label="Semana anterior" title="Semana anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          {weekOffset !== 0 ? (
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href={weekHref(0)}>Esta semana</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href={weekHref(weekOffset + 1)} aria-label="Semana siguiente" title="Semana siguiente">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Clases de la semana"
          value={String(weekCards.length)}
          hint={`${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}`}
          icon={CalendarDays}
        />
        <StatTile
          label="Reservas de la semana"
          value={String(weekBookings)}
          hint={`${weeklyHours} h de clase`}
          icon={Clock}
        />
        <StatTile
          label="Hoy"
          value={String(todayCount)}
          hint={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
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
          {days.map(([dateStr, dayCards]) => {
            const dow = dayCards[0].slot.dayOfWeek
            return (
              <DaySection
                key={dateStr}
                dayName={DAY_NAMES[dow]}
                dayShort={DAY_SHORT[dow]}
                dateLabel={formatDayMonth(dayCards[0].occurrence)}
                classCount={dayCards.length}
                isToday={dateStr === todayStr}
                isPastDay={dateStr < todayStr}
                defaultOpen={dateStr === openDateStr}
              >
                <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {dayCards.map(({ slot, booked, disabled, isPast, readOnly }) => (
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
                        readOnly,
                        dateStr,
                      }}
                    />
                  ))}
                </div>
              </DaySection>
            )
          })}
        </div>
      )}
    </div>
  )
}
