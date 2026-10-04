export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, gte, lte, and, sql } from "drizzle-orm"
import { getSession } from "@/lib/session"
import { loadNavPermissions } from "@/lib/nav-permissions.server"
import {
  canAccessDashboardPath,
  getFirstAllowedDashboardUrl,
  hasNoNavAccess,
} from "@/lib/nav-permissions"
import { routes } from "@/lib/routes"
import { NoAccessPanel } from "@/components/features/admin/no-access-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import { Badge } from "@/components/shared/ui/badge"
import { Users, Calendar, BookOpen, DollarSign } from "lucide-react"
import { WeeklyBookingsChart } from "./_chart"
import { paymentCreatedInStudioMonth, studioMonthLabel } from "@/lib/studio-month"
import { formatTime12h } from "@/lib/time-utils"

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export default async function DashboardPage() {
  // El reparto por rol vive aquí y no en el layout: redirigir desde el layout
  // compartido deja al router de Next pidiendo el mismo RSC en bucle y la
  // pantalla en blanco. Desde una page la redirección sí se resuelve bien.
  const session = await getSession()
  const role = typeof session?.user?.role === "string" ? session.user.role : "alumno"
  const navPermissions = await loadNavPermissions()

  if (!canAccessDashboardPath(role, routes.dashboard, navPermissions)) {
    const landing = getFirstAllowedDashboardUrl(role, navPermissions)
    if (
      !hasNoNavAccess(role, navPermissions) &&
      landing !== routes.dashboard &&
      canAccessDashboardPath(role, landing, navPermissions)
    ) {
      redirect(landing)
    }
    // Sin ningún destino que le toque: el aviso, no una redirección al vacío.
    return <NoAccessPanel />
  }

  const db = getDb()
  const now = new Date()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeSubs = await db
    .select({ userId: schema.subscription.userId })
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.status, "active"),
        gte(schema.subscription.endDate, today)
      )
    )
  const activeCount = new Set(activeSubs.map((s) => s.userId)).size

  const [{ totalAlumnos }] = await db
    .select({ totalAlumnos: sql<number>`count(*)` })
    .from(schema.user)
    .where(eq(schema.user.role, "alumno"))

  const [{ clases }] = await db
    .select({ clases: sql<number>`count(*)` })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.isActive, true))

  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  const [{ reservasSemana }] = await db
    .select({ reservasSemana: sql<number>`count(*)` })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, startOfWeek),
        lte(schema.booking.bookingDate, endOfWeek)
      )
    )

  const ingresosMesLabel = studioMonthLabel(now)
  const [{ ingresos }] = await db
    .select({ ingresos: sql<number>`coalesce(sum(${schema.payment.amount}), 0)` })
    .from(schema.payment)
    .where(
      and(
        eq(schema.payment.status, "succeeded"),
        eq(schema.payment.isNegative, false),
        paymentCreatedInStudioMonth(schema.payment.createdAt, now),
      ),
    )

  const proximas = await db
    .select({
      userName: schema.user.name,
      className: schema.scheduleSlot.className,
      dayOfWeek: schema.scheduleSlot.dayOfWeek,
      startTime: schema.scheduleSlot.startTime,
      bookingDate: schema.booking.bookingDate,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, today)
      )
    )
    .orderBy(schema.booking.bookingDate)
    .limit(5)

  const weeklyRaw = await db
    .select({ bookingDate: schema.booking.bookingDate })
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, startOfWeek),
        lte(schema.booking.bookingDate, endOfWeek)
      )
    )

  const chartData = [
    { day: "Dom", bookings: 0 },
    { day: "Lun", bookings: 0 },
    { day: "Mar", bookings: 0 },
    { day: "Mié", bookings: 0 },
    { day: "Jue", bookings: 0 },
    { day: "Vie", bookings: 0 },
    { day: "Sáb", bookings: 0 },
  ]
  for (const row of weeklyRaw) {
    const d = row.bookingDate instanceof Date ? row.bookingDate : new Date(row.bookingDate as unknown as number)
    const dow = d.getDay()
    chartData[dow].bookings += 1
  }
  const orderedChart = [
    chartData[1], chartData[2], chartData[3],
    chartData[4], chartData[5], chartData[6], chartData[0],
  ]

  const metrics = [
    {
      title: "USUARIOS ACTIVOS",
      value: String(activeCount),
      subtitle: `${totalAlumnos} registrados`,
      icon: Users,
    },
    {
      title: "CLASES ACTIVAS",
      value: String(clases),
      icon: Calendar,
    },
    {
      title: "RESERVAS SEMANA",
      value: String(reservasSemana),
      icon: BookOpen,
    },
    {
      title: "INGRESOS (MES)",
      subtitle: ingresosMesLabel,
      value: new Intl.NumberFormat("es-MX", {
        style: "currency", currency: "MXN", maximumFractionDigits: 0,
      }).format(Number(ingresos ?? 0)),
      icon: DollarSign,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div data-tour="page-header">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Semana {Math.ceil(now.getDate() / 7)},{" "}
          {now.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div data-tour="dashboard-metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground tracking-wide">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold mt-1">{metric.value}</p>
                  {"subtitle" in metric && metric.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{metric.subtitle}</p>
                  )}
                </div>
                <div className="rounded-full p-2.5 bg-primary/10">
                  <metric.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card data-tour="dashboard-chart" className="lg:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Reservas por día</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyBookingsChart data={orderedChart} />
          </CardContent>
        </Card>

        <Card data-tour="dashboard-upcoming" className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Próximas reservas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin reservas próximas
              </p>
            ) : (
              proximas.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-sm">{r.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.className} · {DAY_NAMES[r.dayOfWeek]} {formatTime12h(r.startTime)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    {(r.bookingDate instanceof Date
                      ? r.bookingDate
                      : new Date(r.bookingDate as unknown as number)
                    ).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
