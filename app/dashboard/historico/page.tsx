export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { PageHeader } from "@/components/features/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import { Button } from "@/components/shared/ui/button"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { countAttendanceStats } from "@/lib/attendance-report-utils"
import { getFirstAllowedDashboardUrl } from "@/lib/nav-permissions"
import { routes } from "@/lib/routes"
import {
  HistoricoBookingCard,
  type HistoricoBookingData,
} from "./historico-booking-card"

type SearchParams = Promise<{ from?: string; to?: string; alumna?: string }>

function isAdminOrRoot(role: string) {
  return role === "admin" || role === "root"
}

function toTs(d: Date | number | unknown): Date {
  if (d instanceof Date) return d
  return new Date(d as number)
}

export default async function HistoricoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })

  const role = session?.user?.role ?? ""
  const sessionUserId = getSessionUserId(session?.user)
  const isAlumno = isAlumnoRole(role)
  const isAdminRoot = isAdminOrRoot(role)
  const isCoach = role === "coach"

  if (!session || (!isAlumno && !isAdminRoot && !isCoach)) {
    redirect(getFirstAllowedDashboardUrl(role))
  }

  if (isAlumno && sessionUserId == null) {
    redirect(getFirstAllowedDashboardUrl(role))
  }

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const defaultTo = now.toISOString().split("T")[0]

  const fromStr = params.from ?? defaultFrom
  const toStr = params.to ?? defaultTo
  const alumnaFilter = isAlumno ? "" : (params.alumna ?? "")

  const fromDate = new Date(`${fromStr}T00:00:00`)
  const toDate = new Date(`${toStr}T23:59:59.999`)

  const db = getDb()

  let alumnas: { id: string; name: string; displayId: string | null }[] = []
  if (isAdminRoot) {
    alumnas = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        displayId: schema.user.displayId,
      })
      .from(schema.user)
      .where(eq(schema.user.role, "alumno"))
      .orderBy(schema.user.name)
  }

  const bookingConditions = [
    eq(schema.booking.status, "confirmed"),
    gte(schema.booking.bookingDate, fromDate),
    lte(schema.booking.bookingDate, toDate),
  ]

  if (isAlumno && sessionUserId != null) {
    bookingConditions.push(eq(schema.booking.userId, sessionUserId))
  } else if (isAdminRoot && alumnaFilter.length > 0) {
    bookingConditions.push(eq(schema.booking.userId, alumnaFilter))
  }

  const rawRows = await db
    .select({
      bookingId: schema.booking.id,
      bookingDate: schema.booking.bookingDate,
      attended: schema.booking.attended,
      className: schema.scheduleSlot.className,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      instructor: schema.scheduleSlot.instructor,
      alternateInstructor: schema.scheduleSlot.alternateInstructor,
      scheduleMode: schema.scheduleSlot.scheduleMode,
      studentName: schema.user.name,
      studentDisplayId: schema.user.displayId,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(and(...bookingConditions))
    .orderBy(desc(schema.booking.bookingDate), schema.scheduleSlot.startTime)

  const bookings: HistoricoBookingData[] = rawRows.map((row) => ({
    bookingId: row.bookingId,
    bookingDate: toTs(row.bookingDate),
    attended: row.attended,
    className: row.className,
    startTime: row.startTime,
    endTime: row.endTime,
    instructor: row.instructor,
    alternateInstructor: row.alternateInstructor,
    scheduleMode: row.scheduleMode,
    studentName: row.studentName,
    studentDisplayId: row.studentDisplayId,
  }))

  const stats = countAttendanceStats(bookings)
  const showAlumnaOnCard = isAdminRoot || isCoach

  let emptyMessage = "Sin reservas confirmadas en el periodo"
  if (isAdminRoot && alumnaFilter.length > 0 && bookings.length === 0) {
    emptyMessage = "Sin reservas confirmadas para esta alumna en el periodo"
  }

  const description = isAlumno
    ? `${bookings.length} ${bookings.length === 1 ? "clase reservada" : "clases reservadas"} en el periodo`
    : isCoach
      ? `${bookings.length} reservas confirmadas en el periodo`
      : alumnaFilter.length > 0
        ? (() => {
            const a = alumnas.find((x) => x.id === alumnaFilter)
            if (a == null) return "Reservas por alumna"
            return `${a.name}${a.displayId ? ` (${a.displayId})` : ""}`
          })()
        : `${bookings.length} reservas confirmadas en el periodo`

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Histórico" description={description} />

      <form method="get" action={routes.historico} className="flex flex-wrap gap-2 items-end">
        {isAdminRoot ? (
          <div className="space-y-1 min-w-[220px]">
            <label htmlFor="alumna" className="text-sm text-muted-foreground">
              Alumna
            </label>
            <select
              id="alumna"
              name="alumna"
              defaultValue={alumnaFilter}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas las alumnas</option>
              {alumnas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.displayId ? ` (${a.displayId})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <label htmlFor="from" className="text-sm text-muted-foreground">
            Desde
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={fromStr}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-sm text-muted-foreground">
            Hasta
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={toStr}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Reporte de asistencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">Asistió</p>
              <p className="text-xl font-semibold text-green-700">{stats.asistio}</p>
            </div>
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">No asistió</p>
              <p className="text-xl font-semibold text-red-700">{stats.noAsistio}</p>
            </div>
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">Pendiente</p>
              <p className="text-xl font-semibold">{stats.pendiente}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bookings.map((booking) => (
            <div key={booking.bookingId} className="h-full">
              <HistoricoBookingCard
                booking={booking}
                showAlumna={showAlumnaOnCard}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

