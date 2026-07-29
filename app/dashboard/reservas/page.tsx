export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, count, eq, gte, lte } from "drizzle-orm"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { evaluateStudentSelfRelease } from "@/lib/booking-rules"
import { pickPrimarySubscription } from "@/lib/subscription-display"
import { ListPagination } from "@/components/features/admin/list-pagination"
import { LIST_PAGE_SIZE, listPaginationOffset, parseListPage } from "@/lib/list-pagination"
import { routes } from "@/lib/routes"
import { PageHeader } from "@/components/features/admin/page-header"
import { Button } from "@/components/shared/ui/button"
import { dateRangeForDay, localTodayStr } from "@/lib/booking-slot-options"
import Link from "next/link"
import { ReservaCard } from "./reserva-card"
import { PendingPaymentsPanel, type PendingPaymentRow } from "./pending-payments-panel"

function isAdminOrRoot(role: string) {
  return role === "admin" || role === "root"
}

type SearchParams = Promise<{ date?: string; page?: string; alumna?: string }>

export default async function ReservasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const todayStr = localTodayStr()
  const dateStr = params.date ?? todayStr
  const page = parseListPage(params.page)
  const offset = listPaginationOffset(page)
  const alumnaFilter = params.alumna ?? ""

  const listQuery: Record<string, string | undefined> = {
    date: dateStr !== todayStr ? dateStr : undefined,
    alumna: alumnaFilter.length > 0 ? alumnaFilter : undefined,
  }

  const { start: selectedDate, end: endOfDay } = dateRangeForDay(dateStr)

  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = session?.user?.role ?? ""
  const userId = getSessionUserId(session?.user)
  const isAlumno = isAlumnoRole(role)
  const isAdminRoot = isAdminOrRoot(role)
  const isCoach = role === "coach"
  const canManage = isAdminRoot
  const staffCanCancel = isAdminRoot || isCoach

  const db = getDb()

  let alumnoSubscription: {
    status: string
    startDate: Date
    endDate: Date
  } | null = null

  if (isAlumno && userId != null) {
    const subs = await db
      .select({
        id: schema.subscription.id,
        userId: schema.subscription.userId,
        status: schema.subscription.status,
        startDate: schema.subscription.startDate,
        endDate: schema.subscription.endDate,
      })
      .from(schema.subscription)
      .where(
        and(
          eq(schema.subscription.userId, userId),
          eq(schema.subscription.status, "active"),
        ),
      )
    const primary = pickPrimarySubscription(subs)
    if (primary != null) {
      alumnoSubscription = {
        status: primary.status,
        startDate:
          primary.startDate instanceof Date
            ? primary.startDate
            : new Date(primary.startDate as unknown as number),
        endDate:
          primary.endDate instanceof Date
            ? primary.endDate
            : new Date(primary.endDate as unknown as number),
      }
    }
  }

  let pendingPayments: PendingPaymentRow[] = []
  if (isAlumno && userId != null) {
    const rows = await db
      .select({
        id: schema.payment.id,
        amount: schema.payment.amount,
        concept: schema.payment.concept,
        createdAt: schema.payment.createdAt,
      })
      .from(schema.payment)
      .where(
        and(
          eq(schema.payment.userId, userId),
          eq(schema.payment.status, "pending"),
          eq(schema.payment.isNegative, false),
        ),
      )
      .orderBy(asc(schema.payment.createdAt))

    pendingPayments = rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      concept: row.concept,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt
          : new Date(row.createdAt as unknown as number),
    }))
  }

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
    gte(schema.booking.bookingDate, selectedDate),
    lte(schema.booking.bookingDate, endOfDay),
  ]

  if (isAlumno && userId != null) {
    bookingConditions.push(eq(schema.booking.userId, userId))
  } else if (isAdminRoot && alumnaFilter.length > 0) {
    bookingConditions.push(eq(schema.booking.userId, alumnaFilter))
  }

  const dateFilter = and(...bookingConditions)

  const [{ total: totalReservas }] = await db
    .select({ total: count() })
    .from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(dateFilter)

  const totalItems = Number(totalReservas)

  const reservas = await db
    .select({
      id: schema.booking.id,
      status: schema.booking.status,
      bookingDate: schema.booking.bookingDate,
      userName: schema.user.name,
      displayId: schema.user.displayId,
      className: schema.scheduleSlot.className,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      instructor: schema.scheduleSlot.instructor,
      alternateInstructor: schema.scheduleSlot.alternateInstructor,
      scheduleMode: schema.scheduleSlot.scheduleMode,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(dateFilter)
    .orderBy(asc(schema.scheduleSlot.startTime), asc(schema.user.name))
    .limit(LIST_PAGE_SIZE)
    .offset(offset)

  const showAlumnaOnCard = !isAlumno
  const now = new Date()

  function alumnoCanCancelBooking(bookingDateRaw: Date | unknown): boolean {
    if (!isAlumno || alumnoSubscription == null) return false
    const bookingDate =
      bookingDateRaw instanceof Date
        ? bookingDateRaw
        : new Date(bookingDateRaw as number)
    const check = evaluateStudentSelfRelease({
      bookingDate,
      subscriptionStatus: alumnoSubscription.status,
      subscriptionStartDate: alumnoSubscription.startDate,
      subscriptionEndDate: alumnoSubscription.endDate,
      now,
    })
    return check.ok
  }

  const description = isAlumno
    ? `${totalItems} ${totalItems === 1 ? "reserva tuya" : "reservas tuyas"} en este día`
    : isCoach
      ? `${totalItems} reservas en este día`
      : alumnaFilter.length > 0
        ? (() => {
            const a = alumnas.find((x) => x.id === alumnaFilter)
            if (a == null) return `${totalItems} reservas en este día`
            return `${totalItems} reservas · ${a.name}`
          })()
        : `${totalItems} reservas en este día`

  let emptyMessage = isAlumno
    ? "No tienes reservas para esta fecha"
    : "Sin reservas para esta fecha"

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Reservas" description={description}>
        {canManage || isAlumno ? (
          <Button asChild className="gap-2">
            <Link href={routes.agendar}>Agendar clase</Link>
          </Button>
        ) : null}
      </PageHeader>

      <PendingPaymentsPanel rows={pendingPayments} />

      <form
        data-tour="reservas-filter"
        method="get"
        action={routes.reservas}
        className="flex flex-wrap gap-2 items-end"
      >
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
          <label htmlFor="date" className="text-sm text-muted-foreground">
            Fecha
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={dateStr}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      {reservas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>
      ) : (
        <div data-tour="page-table" className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {reservas.map((r) => (
            <div key={r.id} className="h-full">
              <ReservaCard
                reserva={{
                  id: r.id,
                  status: r.status,
                  className: r.className,
                  startTime: r.startTime,
                  endTime: r.endTime,
                  instructor: r.instructor,
                  alternateInstructor: r.alternateInstructor,
                  scheduleMode: r.scheduleMode,
                  studentName: r.userName,
                  studentDisplayId: r.displayId,
                }}
                showAlumna={showAlumnaOnCard}
                canCancel={
                  staffCanCancel || (isAlumno && alumnoCanCancelBooking(r.bookingDate))
                }
                cancelMode={isAlumno ? "self" : "admin"}
              />
            </div>
          ))}
        </div>
      )}

      <ListPagination
        basePath={routes.reservas}
        page={page}
        totalItems={totalItems}
        query={listQuery}
      />
    </div>
  )
}
