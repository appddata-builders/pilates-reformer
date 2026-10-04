export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and, gte, lte, sql, asc, desc } from "drizzle-orm"
import { PageHeader } from "@/components/features/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import { Badge } from "@/components/shared/ui/badge"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/shared/ui/table"
import {
  Users, Calendar, BookOpen, DollarSign,
  RefreshCw, UserPlus, UserMinus, UserCheck,
} from "lucide-react"
import { ClassesBarChart } from "./_classes-chart"
import { formatTime12h } from "@/lib/time-utils"

type SearchParams = Promise<{ from?: string; to?: string }>

function toTs(d: Date | number | unknown): Date {
  if (d instanceof Date) return d
  return new Date(d as number)
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

export default async function ReportesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const defaultTo = now.toISOString().split("T")[0]

  const fromStr = params.from ?? defaultFrom
  const toStr = params.to ?? defaultTo

  const fromDate = new Date(`${fromStr}T00:00:00`)
  const toDate = new Date(`${toStr}T23:59:59.999`)

  const db = getDb()

  const [
    activeSubs,
    totalReservas,
    ingresos,
    slots,
    bookingsWithUser,
    allPayments,
    allSubsFull,
    cancelledSubsInPeriod,
    newUsersInPeriod,
    firstBookingPerUser,
    alertSubsRaw,
    policy,
    bookingsPerSlot,
    attendanceRows,
  ] = await Promise.all([
    // Alumnos activos (suscripciones vigentes)
    db
      .select({ count: sql<number>`count(distinct ${schema.subscription.userId})` })
      .from(schema.subscription)
      .where(and(
        eq(schema.subscription.status, "active"),
        gte(schema.subscription.endDate, now),
      )),

    // Reservas confirmadas en el periodo
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.booking)
      .where(and(
        gte(schema.booking.bookingDate, fromDate),
        lte(schema.booking.bookingDate, toDate),
        eq(schema.booking.status, "confirmed"),
      )),

    // Ingresos del periodo
    db
      .select({ total: sql<number>`coalesce(sum(${schema.payment.amount}), 0)` })
      .from(schema.payment)
      .where(and(
        eq(schema.payment.status, "succeeded"),
        gte(schema.payment.createdAt, fromDate),
        lte(schema.payment.createdAt, toDate),
      )),

    // Slots activos (clases recurrentes semanales, para aforo)
    db.select().from(schema.scheduleSlot).where(eq(schema.scheduleSlot.isActive, true)),

    // Bookings del periodo
    db
      .select({
        bookingDate: schema.booking.bookingDate,
      })
      .from(schema.booking)
      .where(and(
        gte(schema.booking.bookingDate, fromDate),
        lte(schema.booking.bookingDate, toDate),
        eq(schema.booking.status, "confirmed"),
      )),

    // Pagos del periodo para tabla mensual
    db
      .select({ amount: schema.payment.amount, createdAt: schema.payment.createdAt })
      .from(schema.payment)
      .where(and(
        eq(schema.payment.status, "succeeded"),
        gte(schema.payment.createdAt, fromDate),
        lte(schema.payment.createdAt, toDate),
      )),

    // Todas las suscripciones (para renovaciones y activos por mes)
    db
      .select({
        userId: schema.subscription.userId,
        startDate: schema.subscription.startDate,
        endDate: schema.subscription.endDate,
        status: schema.subscription.status,
        isUnlimited: schema.subscription.isUnlimited,
      })
      .from(schema.subscription),

    // Bajas: suscripciones canceladas con endDate dentro del periodo
    db
      .select({
        userId: schema.subscription.userId,
        endDate: schema.subscription.endDate,
      })
      .from(schema.subscription)
      .where(and(
        eq(schema.subscription.status, "cancelled"),
        gte(schema.subscription.endDate, fromDate),
        lte(schema.subscription.endDate, toDate),
      )),

    // Nuevas inscripciones de alumnos (no admin/coach/root) en el periodo
    db
      .select({ id: schema.user.id, createdAt: schema.user.createdAt })
      .from(schema.user)
      .where(and(
        gte(schema.user.createdAt, fromDate),
        lte(schema.user.createdAt, toDate),
        sql`${schema.user.role} NOT IN ('admin', 'coach', 'root')`,
      )),

    // Primera booking confirmada por usuario (sin filtro de fecha, para visitas nuevas)
    db
      .select({
        userId: schema.booking.userId,
        firstDate: sql<number>`min(${schema.booking.bookingDate})`.as("first_date"),
      })
      .from(schema.booking)
      .where(eq(schema.booking.status, "confirmed"))
      .groupBy(schema.booking.userId),

    // Alumnos en alerta: suscripciones activas con classesRemaining <= 2
    db
      .select({
        userId: schema.subscription.userId,
        name: schema.user.name,
        classesRemaining: schema.subscription.classesRemaining,
        endDate: schema.subscription.endDate,
      })
      .from(schema.subscription)
      .innerJoin(schema.user, eq(schema.subscription.userId, schema.user.id))
      .where(and(
        eq(schema.subscription.status, "active"),
        eq(schema.subscription.isUnlimited, false),
        sql`${schema.subscription.classesRemaining} IS NOT NULL AND ${schema.subscription.classesRemaining} <= 2`,
      ))
      .orderBy(asc(schema.subscription.classesRemaining), asc(schema.subscription.endDate)),

    // Studio policy (reformers, umbral de alerta)
    db
      .select({
        totalReformers: schema.studioPolicy.totalReformers,
        alertThreshold: schema.studioPolicy.alertLastClassThreshold,
      })
      .from(schema.studioPolicy)
      .limit(1),

    // Clases por coach en el periodo
    db
      .select({
        instructor: schema.scheduleSlot.instructor,
        count: sql<number>`count(*)`,
      })
      .from(schema.booking)
      .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
      .where(and(
        gte(schema.booking.bookingDate, fromDate),
        lte(schema.booking.bookingDate, toDate),
        eq(schema.booking.status, "confirmed"),
      ))
      .groupBy(schema.scheduleSlot.instructor),

    db
      .select({
        bookingDate: schema.booking.bookingDate,
        attended: schema.booking.attended,
        studentName: schema.user.name,
        studentEmail: schema.user.email,
        className: schema.scheduleSlot.className,
        instructor: schema.scheduleSlot.instructor,
        startTime: schema.scheduleSlot.startTime,
      })
      .from(schema.booking)
      .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
      .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
      .where(and(
        gte(schema.booking.bookingDate, fromDate),
        lte(schema.booking.bookingDate, toDate),
        eq(schema.booking.status, "confirmed"),
      ))
      .orderBy(desc(schema.booking.bookingDate), asc(schema.scheduleSlot.startTime), asc(schema.user.name)),
  ])

  // ── métricas derivadas ───────────────────────────────────────────────────────

  const totalReformers = policy[0]?.totalReformers ?? 8

  // Visitas nuevas: usuarios cuya primera booking cae en el periodo
  const visitasNuevas = firstBookingPerUser.filter((r) => {
    const d = new Date(r.firstDate)
    return d >= fromDate && d <= toDate
  }).length

  // Renovaciones: usuario que inició sub en el periodo Y tenía sub anterior
  // Mapa userId → fecha más temprana de su primera suscripción
  const userEarliestSub = new Map<string, Date>()
  for (const sub of allSubsFull) {
    const start = toTs(sub.startDate)
    const prev = userEarliestSub.get(sub.userId)
    if (!prev || start < prev) userEarliestSub.set(sub.userId, start)
  }

  const renovacionesUsers = new Set<string>()
  const renovacionesByMonth = new Map<string, Set<string>>()

  for (const sub of allSubsFull) {
    const start = toTs(sub.startDate)
    if (start < fromDate || start > toDate) continue
    const earliest = userEarliestSub.get(sub.userId)
    if (earliest && earliest < start) {
      renovacionesUsers.add(sub.userId)
      const month = start.toISOString().slice(0, 7)
      if (!renovacionesByMonth.has(month)) renovacionesByMonth.set(month, new Set())
      renovacionesByMonth.get(month)!.add(sub.userId)
    }
  }
  const renovaciones = renovacionesUsers.size

  // Bajas: usuarios únicos con sub cancelada y endDate en el periodo
  const bajasByMonth = new Map<string, Set<string>>()
  for (const sub of cancelledSubsInPeriod) {
    const month = toTs(sub.endDate).toISOString().slice(0, 7)
    if (!bajasByMonth.has(month)) bajasByMonth.set(month, new Set())
    bajasByMonth.get(month)!.add(sub.userId)
  }
  const bajas = new Set(cancelledSubsInPeriod.map((s) => s.userId)).size

  // Nuevas inscripciones por mes
  const nuevasByMonth = new Map<string, number>()
  for (const u of newUsersInPeriod) {
    const month = toTs(u.createdAt).toISOString().slice(0, 7)
    nuevasByMonth.set(month, (nuevasByMonth.get(month) ?? 0) + 1)
  }
  const nuevasInscripciones = newUsersInPeriod.length

  // ── tabla mensual ────────────────────────────────────────────────────────────

  type MonthRow = {
    reservas: number; ingresos: number; activos: number
    renovaciones: number; nuevas: number; bajas: number
    aforo: number; weekOccupancies: number[]
  }

  const monthMap = new Map<string, MonthRow>()

  const ensureMonth = (month: string) => {
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        reservas: 0, ingresos: 0, activos: 0,
        renovaciones: 0, nuevas: 0, bajas: 0,
        aforo: 0, weekOccupancies: [],
      })
    }
  }

  for (const b of bookingsWithUser) {
    const month = toTs(b.bookingDate).toISOString().slice(0, 7)
    ensureMonth(month)
    monthMap.get(month)!.reservas++
  }

  // Pagos
  for (const p of allPayments) {
    const month = toTs(p.createdAt).toISOString().slice(0, 7)
    ensureMonth(month)
    monthMap.get(month)!.ingresos += p.amount
  }

  // Activos por mes
  for (const [month] of monthMap) {
    const [y, m] = month.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999)
    const activeInMonth = new Set(
      allSubsFull
        .filter((s) => {
          const start = toTs(s.startDate)
          const end = toTs(s.endDate)
          return start <= monthEnd && end >= monthStart && s.status === "active"
        })
        .map((s) => s.userId)
    ).size
    monthMap.get(month)!.activos = activeInMonth
  }

  // Renovaciones por mes
  for (const [month, users] of renovacionesByMonth) {
    ensureMonth(month)
    monthMap.get(month)!.renovaciones = users.size
  }

  // Nuevas inscripciones por mes
  for (const [month, count] of nuevasByMonth) {
    ensureMonth(month)
    monthMap.get(month)!.nuevas = count
  }

  // Bajas por mes
  for (const [month, users] of bajasByMonth) {
    ensureMonth(month)
    monthMap.get(month)!.bajas = users.size
  }

  // ── aforo semanal ────────────────────────────────────────────────────────────

  const activeSlotCount = slots.length
  const weeklyCapacity = activeSlotCount * totalReformers

  // Timestamps de bookings para filtrado rápido por semana
  const bookingTimes = bookingsWithUser.map((b) => toTs(b.bookingDate).getTime()).sort((a, b) => a - b)

  let weekCursor = getMonday(fromDate)
  const allWeekOccupancies: number[] = []

  while (weekCursor <= toDate) {
    const weekEnd = new Date(weekCursor)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const ws = weekCursor.getTime()
    const we = weekEnd.getTime()
    const weekBookings = bookingTimes.filter((t) => t >= ws && t <= we).length
    const occupancy = weeklyCapacity > 0 ? (weekBookings / weeklyCapacity) * 100 : 0

    allWeekOccupancies.push(occupancy)

    const month = weekCursor.toISOString().slice(0, 7)
    ensureMonth(month)
    monthMap.get(month)!.weekOccupancies.push(occupancy)

    weekCursor = new Date(weekCursor)
    weekCursor.setDate(weekCursor.getDate() + 7)
  }

  // Aforo promedio por mes
  for (const [, row] of monthMap) {
    if (row.weekOccupancies.length > 0) {
      row.aforo = row.weekOccupancies.reduce((a, b) => a + b, 0) / row.weekOccupancies.length
    }
  }

  const avgAforo = allWeekOccupancies.length > 0
    ? allWeekOccupancies.reduce((a, b) => a + b, 0) / allWeekOccupancies.length
    : 0

  // ── totales de periodo ───────────────────────────────────────────────────────

  const totalClases = bookingsWithUser.length

  const monthRows = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  const coachStats = bookingsPerSlot
    .filter((r) => r.instructor)
    .sort((a, b) => b.count - a.count)

  const chartData = monthRows.map(([month, row]) => {
    const [y, m] = month.split("-")
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-MX", { month: "short" })
    return { month: label, clases: row.reservas }
  })

  const fmt = new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  })

  const metricsRow1 = [
    { title: "USUARIOS ACTIVOS", value: String(activeSubs[0]?.count ?? 0), icon: Users },
    { title: "RESERVAS TOTALES", value: String(totalReservas[0]?.count ?? 0), icon: BookOpen },
    { title: "CLASES IMPARTIDAS", value: String(slots.length), icon: Calendar },
    { title: "INGRESOS", value: fmt.format(ingresos[0]?.total ?? 0), icon: DollarSign },
  ]

  let attendanceAsistio = 0
  let attendanceNoAsistio = 0
  let attendancePendiente = 0
  for (const row of attendanceRows) {
    if (row.attended === true) attendanceAsistio++
    else if (row.attended === false) attendanceNoAsistio++
    else attendancePendiente++
  }

  function formatSlotTime(t: string) {
    return formatTime12h(t)
  }

  const metricsRow2 = [
    { title: "RENOVACIONES", value: String(renovaciones), icon: RefreshCw },
    { title: "VISITAS NUEVAS", value: String(visitasNuevas), icon: UserCheck },
    { title: "NUEVAS INSCRIPCIONES", value: String(nuevasInscripciones), icon: UserPlus },
    { title: "BAJAS", value: String(bajas), icon: UserMinus },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Reportes" description="Análisis del periodo seleccionado" />

      {/* Filtro de fechas */}
      <form data-tour="reportes-filter" method="get" action="/dashboard/reportes" className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="from">Desde</label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={fromStr}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="to">Hasta</label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={toStr}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Aplicar
        </button>
      </form>

      {/* Fila 1: métricas base */}
      <div data-tour="reportes-metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricsRow1.map((m) => (
          <Card key={m.title} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground tracking-wide">{m.title}</p>
                  <p className="text-2xl font-bold mt-1">{m.value}</p>
                </div>
                <div className="rounded-full p-2.5 bg-primary/10">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fila 2: métricas de movimiento */}
      <div data-tour="reportes-metrics-movimiento" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricsRow2.map((m) => (
          <Card key={m.title} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground tracking-wide">{m.title}</p>
                  <p className="text-2xl font-bold mt-1">{m.value}</p>
                </div>
                <div className="rounded-full p-2.5 bg-primary/10">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aforo semanal */}
      <Card data-tour="reportes-aforo" className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Aforo Semanal Promedio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {avgAforo.toFixed(1)}% &nbsp;/&nbsp; 85% meta
            </span>
            <span className={
              avgAforo >= 85
                ? "text-green-600 font-medium"
                : avgAforo >= 70
                  ? "text-yellow-600 font-medium"
                  : "text-red-500 font-medium"
            }>
              {avgAforo >= 85 ? "Meta alcanzada ✓" : "Bajo la meta"}
            </span>
          </div>
          <div className="relative h-4 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={[
                "h-full rounded-full transition-all",
                avgAforo >= 85 ? "bg-green-500" : avgAforo >= 70 ? "bg-yellow-400" : "bg-red-400",
              ].join(" ")}
              style={{ width: `${Math.min(100, avgAforo)}%` }}
            />
            {/* Línea de meta al 85% */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
              style={{ left: "85%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Capacidad semanal: {activeSlotCount} clases × {totalReformers} reformers = {weeklyCapacity} lugares
          </p>
        </CardContent>
      </Card>

      <div data-tour="reportes-tipo-clase" className="grid gap-4 md:grid-cols-1 max-w-sm">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide">CLASES EN EL PERIODO</p>
              <p className="text-2xl font-bold mt-1">{totalClases}</p>
            </div>
            <div className="rounded-full p-2.5 bg-blue-50">
              <BookOpen className="h-5 w-5 text-blue-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla mensual completa */}
      {monthRows.length > 0 && (
        <Card data-tour="reportes-resumen" className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Resumen mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="text-muted-foreground font-normal text-sm">Mes</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Activos</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Renovaciones</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Nuevos</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Bajas</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Clases</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Aforo %</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Ingresos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRows.map(([month, row]) => {
                  const [y, m] = month.split("-")
                  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-MX", {
                    month: "long", year: "numeric",
                  })
                  const aforoColor =
                    row.aforo >= 85
                      ? "text-green-600"
                      : row.aforo >= 70
                        ? "text-yellow-600"
                        : row.aforo > 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                  return (
                    <TableRow key={month} className="border-b last:border-0">
                      <TableCell className="font-medium capitalize">{label}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.activos}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.renovaciones}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.nuevas}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.bajas}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.reservas}</TableCell>
                      <TableCell className={`text-right font-medium ${aforoColor}`}>
                        {row.aforo > 0 ? `${row.aforo.toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt.format(row.ingresos)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card data-tour="reportes-grafica" className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium"># de Clases por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassesBarChart data={chartData} />
        </CardContent>
      </Card>

      {/* Clases por Coach */}
      <Card data-tour="reportes-coaches" className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Clases por Coach</CardTitle>
        </CardHeader>
        <CardContent>
          {coachStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos para el periodo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="text-muted-foreground font-normal text-sm">Coach</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right"># Clases en periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachStats.map((row) => (
                  <TableRow key={row.instructor} className="border-b last:border-0">
                    <TableCell className="font-medium">{row.instructor}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-tour="reportes-asistencia" className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Reporte de asistencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">Asistió</p>
              <p className="text-xl font-semibold text-green-700">{attendanceAsistio}</p>
            </div>
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">No asistió</p>
              <p className="text-xl font-semibold text-red-700">{attendanceNoAsistio}</p>
            </div>
            <div className="rounded-md border px-4 py-3">
              <p className="text-muted-foreground">Pendiente</p>
              <p className="text-xl font-semibold">{attendancePendiente}</p>
            </div>
          </div>

          {attendanceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin reservas confirmadas en el periodo
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="text-muted-foreground font-normal text-sm">Fecha</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm">Alumna</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm">Clase</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm">Coach</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm">Horario</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.map((row, i) => {
                  const fecha = toTs(row.bookingDate).toLocaleDateString("es-MX", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                  let estadoLabel = "Pendiente"
                  let badgeClass = "border-muted-foreground/30 text-muted-foreground"
                  if (row.attended === true) {
                    estadoLabel = "Asistió"
                    badgeClass = "border-green-300 bg-green-50 text-green-800"
                  } else if (row.attended === false) {
                    estadoLabel = "No asistió"
                    badgeClass = "border-red-300 bg-red-50 text-red-800"
                  }
                  return (
                    <TableRow key={`${row.bookingDate}-${row.studentEmail}-${i}`} className="border-b last:border-0">
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fecha}</TableCell>
                      <TableCell className="font-medium">
                        {row.studentName}
                        <span className="block text-xs font-normal text-muted-foreground">{row.studentEmail}</span>
                      </TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell className="text-muted-foreground">{row.instructor ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatSlotTime(row.startTime)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={badgeClass}>
                          {estadoLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {alertSubsRaw.length > 0 && (
        <Card data-tour="reportes-alertas" className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Alerta: Últimas Clases
              <Badge variant="destructive">{alertSubsRaw.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="text-muted-foreground font-normal text-sm">Alumna</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-center">Clases restantes</TableHead>
                  <TableHead className="text-muted-foreground font-normal text-sm text-right">Fecha de corte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertSubsRaw.map((row, i) => {
                  const remaining = row.classesRemaining ?? 0
                  const isRed = remaining <= 1
                  return (
                    <TableRow
                      key={`${row.userId}-${i}`}
                      className={[
                        "border-b last:border-0",
                        isRed
                          ? "bg-red-50 dark:bg-red-950/20"
                          : "bg-yellow-50 dark:bg-yellow-950/20",
                      ].join(" ")}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={isRed ? "destructive" : "outline"}
                          className={isRed ? "" : "border-yellow-400 bg-yellow-100 text-yellow-800"}
                        >
                          {remaining}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {toTs(row.endDate).toLocaleDateString("es-MX", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
