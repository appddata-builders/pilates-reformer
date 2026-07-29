export const dynamic = "force-dynamic"

import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { PageHeader } from "@/components/features/admin/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/shared/ui/table"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { routes } from "@/lib/routes"
import { ALUMNO_ROLE_LABEL } from "@/lib/user-role"
import { and, desc, eq } from "drizzle-orm"
import { formatBirthdateDisplay } from "@/lib/birthdate"
import { ConfirmPaymentButton } from "@/app/dashboard/pagos/confirm-payment-button"

function paymentStatusBadge(status: string) {
  if (status === "succeeded") {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Exitoso</Badge>
  }
  if (status === "pending") {
    return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendiente</Badge>
  }
  if (status === "failed") {
    return <Badge className="bg-red-100 text-red-700 border-red-200">Fallido</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}

export default async function AlumnoDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const db = getDb()

  // Confirmar cobros es de admin y root, no de un coach que llegue a la ficha.
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const sessionRole = session?.user.role ?? ""
  const canManage = sessionRole === "admin" || sessionRole === "root"

  const [alumno] = await db
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.id, id), eq(schema.user.role, "alumno")))
    .limit(1)

  if (alumno == null) notFound()

  const subs = await db
    .select({
      id: schema.subscription.id,
      status: schema.subscription.status,
      startDate: schema.subscription.startDate,
      endDate: schema.subscription.endDate,
      classesRemaining: schema.subscription.classesRemaining,
      planName: schema.plan.name,
      planType: schema.plan.planType,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(eq(schema.subscription.userId, id))
    .orderBy(desc(schema.subscription.createdAt))

  const bookings = await db
    .select({
      id: schema.booking.id,
      bookingDate: schema.booking.bookingDate,
      status: schema.booking.status,
      attended: schema.booking.attended,
      className: schema.scheduleSlot.className,
      instructor: schema.scheduleSlot.instructor,
    })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(eq(schema.booking.userId, id))
    .orderBy(desc(schema.booking.bookingDate))
    .limit(20)

  const payments = await db
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.userId, id))
    .orderBy(desc(schema.payment.createdAt))
    .limit(10)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type SubRow = (typeof subs)[number]

  let activeSub: SubRow | null = subs.find((s) => s.status === "active") ?? subs[0] ?? null
  if (activeSub != null) {
    const end =
      activeSub.endDate instanceof Date
        ? activeSub.endDate
        : new Date(activeSub.endDate as unknown as number)
    if (end < today) activeSub = null
  }

  const upcomingBooking =
    bookings
      .filter((b) => {
        const d =
          b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate as unknown as number)
        d.setHours(0, 0, 0, 0)
        return d >= today && b.status === "confirmed"
      })
      .sort((a, b) => {
        const da = a.bookingDate instanceof Date ? a.bookingDate : new Date(a.bookingDate as unknown as number)
        const db_ = b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate as unknown as number)
        return da.getTime() - db_.getTime()
      })[0] ?? null

  const remaining =
    activeSub != null &&
    (activeSub.planType === "class_pack")
      ? activeSub.classesRemaining ?? 0
      : null

  const birthLabel = formatBirthdateDisplay(alumno.birthdate)

  const pendingPayment =
    payments.find((p) => p.status === "pending") ?? null
  const pendingAmountLabel =
    pendingPayment == null
      ? ""
      : new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: pendingPayment.currency,
          maximumFractionDigits: 0,
        }).format(pendingPayment.amount)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={alumno.name}
        description={
          birthLabel !== "—" ? `${alumno.email} · Cumpleaños: ${birthLabel}` : alumno.email
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {canManage && pendingPayment != null ? (
            <ConfirmPaymentButton
              paymentId={pendingPayment.id}
              userName={alumno.name}
              amountLabel={pendingAmountLabel}
            />
          ) : null}
          <Button variant="outline" asChild>
            <Link href={routes.usuarios}>Volver</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono">{alumno.displayId ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rol</span>
              <Badge variant="outline">{ALUMNO_ROLE_LABEL}</Badge>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Teléfono</span>
              <span>{alumno.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cumpleaños</span>
              <span>{birthLabel}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Clases restantes</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {remaining === null ? "—" : String(remaining)}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Plan activo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-semibold">{activeSub?.planName ?? "—"}</div>
            {activeSub?.status ? <Badge variant="secondary">{activeSub.status}</Badge> : null}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Próxima clase</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {upcomingBooking == null ? (
              <span className="text-muted-foreground">Sin próximas reservas</span>
            ) : (
              <>
                <div className="font-medium">{upcomingBooking.className}</div>
                <div className="text-muted-foreground">
                  {(upcomingBooking.bookingDate instanceof Date
                    ? upcomingBooking.bookingDate
                    : new Date(upcomingBooking.bookingDate as unknown as number)
                  ).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
                </div>
                <div className="text-muted-foreground">{upcomingBooking.instructor ?? "—"}</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Historial de reservas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Asistió</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Sin reservas
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((b) => {
                  const d = b.bookingDate instanceof Date ? b.bookingDate : new Date(b.bookingDate as unknown as number)
                  return (
                    <TableRow key={b.id}>
                      <TableCell>{d.toLocaleDateString("es-MX")}</TableCell>
                      <TableCell>{b.className}</TableCell>
                      <TableCell>{b.instructor ?? "—"}</TableCell>
                      <TableCell>
                        {b.attended === null ? "—" : b.attended ? "Sí" : "No"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Sin pagos
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => {
                  const d = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt as unknown as number)
                  const amountLabel = new Intl.NumberFormat("es-MX", {
                    style: "currency",
                    currency: p.currency,
                    maximumFractionDigits: 0,
                  }).format(p.amount)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{d.toLocaleDateString("es-MX")}</TableCell>
                      <TableCell>{amountLabel}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell>{paymentStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        {canManage && p.status === "pending" ? (
                          <ConfirmPaymentButton
                            paymentId={p.id}
                            userName={alumno.name}
                            amountLabel={amountLabel}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
