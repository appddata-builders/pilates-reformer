export const dynamic = "force-dynamic"

import { getAttendanceCatalog } from "@/lib/coach-attendance"
import { AttendanceControls } from "../coaches/attendance/attendance-controls"
import { coachTeachesSlot } from "@/lib/schedule-instructor"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, count, eq, gte, inArray, isNull, lte } from "drizzle-orm"
import { isAlumnoRole, getSessionUserId } from "@/lib/alumno-scope"
import { evaluateStudentSelfRelease } from "@/lib/booking-rules"
import { classStartFromBooking } from "@/lib/cancellation-policy"
import {
  isSubscriptionCurrent,
  pickPrimarySubscription,
} from "@/lib/subscription-display"
import { ListPagination } from "@/components/features/admin/list-pagination"
import { LIST_PAGE_SIZE, listPaginationOffset, parseListPage } from "@/lib/list-pagination"
import { routes } from "@/lib/routes"
import { PageHeader } from "@/components/features/admin/page-header"
import { Button } from "@/components/shared/ui/button"
import { dateRangeForDay, localTodayStr } from "@/lib/booking-slot-options"
import Link from "next/link"
import { ReservaCard } from "./reserva-card"
import { PendingPaymentsPanel, type PendingPaymentRow } from "./pending-payments-panel"
import { PlanVigenteCard, type PlanVigenteRow } from "./plan-vigente-card"

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

  const session = await getSession()
  const role = session?.user?.role ?? ""
  const userId = getSessionUserId(session?.user)
  const isAlumno = isAlumnoRole(role)
  const isAdminRoot = isAdminOrRoot(role)
  const isCoach = role === "coach"
  const canManage = isAdminRoot
  const staffCanCancel = isAdminRoot || isCoach

  const db = getDb()
  const attendanceCatalog = isCoach || isAdminRoot ? await getAttendanceCatalog(db) : []

  let alumnoSubscription: {
    status: string
    startDate: Date
    endDate: Date
  } | null = null
  let planVigente: PlanVigenteRow | null = null

  if (isAlumno && userId != null) {
    const subs = await db
      .select({
        id: schema.subscription.id,
        userId: schema.subscription.userId,
        status: schema.subscription.status,
        startDate: schema.subscription.startDate,
        endDate: schema.subscription.endDate,
        classesRemaining: schema.subscription.classesRemaining,
        isUnlimited: schema.subscription.isUnlimited,
        planName: schema.plan.name,
        planType: schema.plan.planType,
        daysPerWeek: schema.plan.daysPerWeek,
      })
      .from(schema.subscription)
      .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
      .where(
        and(
          eq(schema.subscription.userId, userId),
          eq(schema.subscription.status, "active"),
        ),
      )
    const primary = pickPrimarySubscription(subs)
    if (primary != null) {
      const startDate =
        primary.startDate instanceof Date
          ? primary.startDate
          : new Date(primary.startDate as unknown as number)
      const endDate =
        primary.endDate instanceof Date
          ? primary.endDate
          : new Date(primary.endDate as unknown as number)
      alumnoSubscription = {
        status: primary.status,
        startDate,
        endDate,
      }
      // Un periodo vencido con clases pagadas sin tomar sigue siendo útil: se
      // muestra en ámbar para que sepa que las puede usar cuadrando con el
      // estudio. Vencido y sin clases sí desaparece.
      const vigente = isSubscriptionCurrent(primary.status, endDate)
      const restantes = primary.isUnlimited === true ? null : (primary.classesRemaining ?? 0)
      if (vigente || (restantes != null && restantes > 0)) {
        planVigente = {
          planName: primary.planName,
          planType: primary.planType,
          endDate,
          classesRemaining: primary.classesRemaining,
          isUnlimited: primary.isUnlimited === true,
          daysPerWeek: primary.daysPerWeek > 0 ? primary.daysPerWeek : null,
          expired: !vigente,
        }
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

  let alumnas: { id: string; name: string; email: string }[] = []
  if (isAdminRoot) {
    alumnas = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
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
      userEmail: schema.user.email,
      attended: schema.booking.attended,
      className: schema.scheduleSlot.className,
      startTime: schema.scheduleSlot.startTime,
      endTime: schema.scheduleSlot.endTime,
      instructor: schema.scheduleSlot.instructor,
      alternateInstructor: schema.scheduleSlot.alternateInstructor,
      scheduleMode: schema.scheduleSlot.scheduleMode,
      trialClass: schema.booking.trialClass,
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

  // Clases individuales (con cobro propio, fuera del plan): tarjeta blanca; las
  // del plan y la clase muestra van en beige.
  const individualBookingIds = new Set<string>()
  if (reservas.length > 0) {
    const charges = await db
      .select({ bookingId: schema.payment.bookingId })
      .from(schema.payment)
      .where(and(
        inArray(schema.payment.bookingId, reservas.map((r) => r.id)),
        isNull(schema.payment.subscriptionId),
      ))
    for (const c of charges) {
      if (c.bookingId != null) individualBookingIds.add(c.bookingId)
    }
  }

  // Misma regla que cancelBookingById: sin plan de por medio (clase muestra,
  // individual o sin paquete) se libera mientras la clase no empiece; las del
  // plan siguen las reglas del plan.
  function alumnoCanCancelBooking(r: (typeof reservas)[number]): boolean {
    if (!isAlumno) return false
    const bookingDate =
      r.bookingDate instanceof Date
        ? r.bookingDate
        : new Date(r.bookingDate as unknown as number)
    if (r.trialClass === true || individualBookingIds.has(r.id) || alumnoSubscription == null) {
      return now < classStartFromBooking(bookingDate, r.startTime)
    }
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
    ? `${totalItems} ${totalItems === 1 ? "reserva" : "reservas"} en este día`
    : isCoach
      ? `${totalItems} reservas en este día`
      : alumnaFilter.length > 0
        ? (() => {
            const a = alumnas.find((x) => x.id === alumnaFilter)
            if (a == null) return `${totalItems} reservas en este día`
            return `${totalItems} reservas · ${a.name}`
          })()
        : `${totalItems} reservas en este día`

  const emptyMessage = isAlumno
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

      {isAlumno ? <PlanVigenteCard row={planVigente} /> : null}

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
                  {a.name} ({a.email})
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
            <div key={r.id} className="flex h-full flex-col">
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
                }}
                showAlumna={showAlumnaOnCard}
                individual={individualBookingIds.has(r.id)}
                canCancel={
                  staffCanCancel || (isAlumno && alumnoCanCancelBooking(r))
                }
                cancelMode={isAlumno ? "self" : "admin"}
              />
              {r.status === "confirmed" && (isAdminRoot || (isCoach && coachTeachesSlot(r, session?.user.name ?? ""))) ? (
                <div className="space-y-2 border rounded-md p-3 mt-2">
                  <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                  <AttendanceControls bookingId={r.id} attended={r.attended} catalog={attendanceCatalog} />
                </div>
              ) : null}
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
