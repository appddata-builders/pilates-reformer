export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, eq, desc, asc, count, gte, inArray, isNotNull, sql } from "drizzle-orm"
import {
  parseListSort,
  parseListSortDir,
  sortSearchParams,
  type ListSortDir,
} from "@/lib/list-sort"
import { PageHeader } from "@/components/features/admin/page-header"
import { sortPlansByDisplayOrder } from "@/lib/site/plans"
import { isBirthdayToday, isBirthdayWithinNextDays } from "@/lib/birthday-notifications"
import { pickPrimarySubscription, subscriptionEndDate } from "@/lib/subscription-display"
import { ALUMNO_ROLE_LABEL } from "@/lib/user-role"
import { NewCoachDialog } from "@/app/dashboard/coaches/new-coach-dialog"
import { NewAlumnoDialog } from "./new-alumno-dialog"
import { UsuariosClient } from "./usuarios-client"
import type { UsuarioTableRow } from "./usuarios-table"
import type { CoachTableRow } from "./coaches-table"

function calendarDaysUntilEnd(from: Date, end: Date): number {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(end)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

const ALUMNOS_SORT_KEYS = ["displayId", "name", "email", "createdAt"] as const
const ALUMNOS_DEFAULT_SORT = "displayId"

type SearchParams = Promise<{ page?: string; sort?: string; dir?: string; tab?: string }>

function alumnosOrderBy(sort: string, dir: ListSortDir) {
  const cols = {
    displayId: schema.user.displayId,
    name: schema.user.name,
    email: schema.user.email,
    createdAt: schema.user.createdAt,
  } as const
  const col = cols[sort as keyof typeof cols] ?? schema.user.displayId
  if (dir === "desc") return desc(col)
  return asc(col)
}

export default async function AlumnosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Ver la lista lo decide el permiso de navegación; editar roles y datos es
  // exclusivo de admin y root, aunque un coach llegue a esta página.
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const sessionRole = session?.user.role ?? ""
  const canManage = sessionRole === "admin" || sessionRole === "root"

  const sort = parseListSort(params.sort, ALUMNOS_SORT_KEYS, ALUMNOS_DEFAULT_SORT)
  const dir = parseListSortDir(params.dir)
  const sortQuery = sortSearchParams(sort, dir, { sort: ALUMNOS_DEFAULT_SORT, dir: "asc" })

  const db = getDb()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [policy] = await db
    .select({
      alertDaysBeforeExpiry: schema.studioPolicy.alertDaysBeforeExpiry,
    })
    .from(schema.studioPolicy)
    .where(eq(schema.studioPolicy.id, "main"))
    .limit(1)

  const expiryDaysThreshold = policy?.alertDaysBeforeExpiry ?? 3

  const [{ total: totalAlumnos }] = await db
    .select({ total: count() })
    .from(schema.user)
    .where(eq(schema.user.role, "alumno"))

  const totalItems = Number(totalAlumnos)

  const alumnos = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      phone: schema.user.phone,
      notes: schema.user.notes,
      displayId: schema.user.displayId,
      birthdate: schema.user.birthdate,
      enabled: schema.user.enabled,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .where(eq(schema.user.role, "alumno"))
    .orderBy(alumnosOrderBy(sort, dir), asc(schema.user.name))

  const subMap = new Map<string, {
    planId: string
    planName: string
    planType: string
    status: string
    endDate: Date
    classesRemaining: number | null
    billingCycle: string | null
  }>()

  if (alumnos.length > 0) {
    const alumnoIds = alumnos.map((a) => a.id)
    const subs = await db
      .select({
        id: schema.subscription.id,
        userId: schema.subscription.userId,
        status: schema.subscription.status,
        endDate: schema.subscription.endDate,
        classesRemaining: schema.subscription.classesRemaining,
        planId: schema.plan.id,
        planName: schema.plan.name,
        planType: schema.plan.planType,
        billingCycle: schema.subscription.billingCycle,
      })
      .from(schema.subscription)
      .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
      .where(inArray(schema.subscription.userId, alumnoIds))

    const subsByUser = new Map<string, typeof subs>()
    for (const s of subs) {
      const list = subsByUser.get(s.userId) ?? []
      list.push(s)
      subsByUser.set(s.userId, list)
    }
    for (const [userId, userSubs] of subsByUser) {
      const primary = pickPrimarySubscription(
        userSubs.map((s) => ({
          id: s.id,
          userId: s.userId,
          status: s.status,
          endDate: subscriptionEndDate(s.endDate),
        })),
        today,
      )
      if (primary == null) continue
      const s = userSubs.find((row) => row.id === primary.id)
      if (s == null) continue
      subMap.set(userId, {
        planId: s.planId,
        planName: s.planName,
        planType: s.planType,
        status: s.status,
        endDate: subscriptionEndDate(s.endDate),
        classesRemaining: s.classesRemaining ?? null,
        billingCycle: s.billingCycle,
      })
    }
  }

  const planRows = await db
    .select({
      id: schema.plan.id,
      name: schema.plan.name,
      priceMxn: schema.plan.priceMxn,
      planType: schema.plan.planType,
    })
    .from(schema.plan)
    .where(eq(schema.plan.isActive, true))
    .orderBy(asc(schema.plan.name))

  // --- Coaches: misma lista de usuarios, otro rol ---
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const coachUsers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      phone: schema.user.phone,
      enabled: schema.user.enabled,
    })
    .from(schema.user)
    .where(eq(schema.user.role, "coach"))
    .orderBy(asc(schema.user.name))

  const monthMap = new Map<string, number>()
  const activeSlotMap = new Map<string, number>()
  if (coachUsers.length > 0) {
    const bookingsThisMonth = await db
      .select({
        instructor: schema.scheduleSlot.instructor,
        count: sql<number>`count(*)`,
      })
      .from(schema.booking)
      .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
      .where(
        and(
          isNotNull(schema.scheduleSlot.instructor),
          gte(schema.booking.bookingDate, startOfMonth),
          eq(schema.booking.status, "confirmed"),
        ),
      )
      .groupBy(schema.scheduleSlot.instructor)
    for (const row of bookingsThisMonth) {
      if (row.instructor) monthMap.set(row.instructor, Number(row.count))
    }

    const slotStats = await db
      .select({
        instructor: schema.scheduleSlot.instructor,
        activeSlots: sql<number>`sum(case when ${schema.scheduleSlot.isActive} then 1 else 0 end)`,
      })
      .from(schema.scheduleSlot)
      .where(isNotNull(schema.scheduleSlot.instructor))
      .groupBy(schema.scheduleSlot.instructor)
    for (const row of slotStats) {
      if (row.instructor) activeSlotMap.set(row.instructor, Number(row.activeSlots ?? 0))
    }
  }

  const coachRows: CoachTableRow[] = coachUsers.map((coach) => ({
    id: coach.id,
    name: coach.name,
    email: coach.email,
    phone: coach.phone,
    enabled: coach.enabled !== false,
    classesThisMonth: monthMap.get(coach.name) ?? 0,
    activeSlots: activeSlotMap.get(coach.name) ?? 0,
  }))

  const planes = sortPlansByDisplayOrder(
    planRows
      .filter((p) => p.planType !== "add_on")
      .map((p) => ({
      id: p.id,
      name: p.name,
      priceMxn: p.priceMxn,
      planType: p.planType,
    })),
  )

  const tableRows: UsuarioTableRow[] = alumnos.map((alumno) => {
    const sub = subMap.get(alumno.id)
    const isPackPlan = sub?.planType === "class_pack"
    const isMonthly = sub?.planType === "monthly"
    const remaining = isPackPlan ? (sub?.classesRemaining ?? 0) : null
    const daysToEnd = sub ? calendarDaysUntilEnd(today, sub.endDate) : null
    const showExpiryAlert = daysToEnd !== null && daysToEnd === expiryDaysThreshold
    const birthdayToday = isBirthdayToday(alumno.birthdate)
    const birthdaySoon = !birthdayToday && isBirthdayWithinNextDays(alumno.birthdate, 7)
    const userEnabled = alumno.enabled !== false

    return {
      id: alumno.id,
      name: alumno.name,
      email: alumno.email,
      phone: alumno.phone,
      notes: alumno.notes,
      birthdate: alumno.birthdate,
      displayId: alumno.displayId,
      displayLabel: alumno.displayId ?? "—",
      enabled: userEnabled,
      planId: sub?.planId ?? "",
      billingCycle: sub?.billingCycle ?? "mensual",
      planName: sub?.planName ?? null,
      planType: sub?.planType ?? null,
      classesRemaining: sub?.classesRemaining ?? null,
      isMonthly,
      remaining,
      hasSubscription: sub != null,
      renewalLabel:
        sub?.endDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) ?? "—",
      showExpiryAlert,
      birthdayToday,
      birthdaySoon,
    }
  })

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Usuarios"
        description={`${totalItems} ${ALUMNO_ROLE_LABEL.toLowerCase()}s · ${coachRows.length} coaches`}
      >
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <NewAlumnoDialog planes={planes} />
            <NewCoachDialog />
          </div>
        ) : null}
      </PageHeader>

      <UsuariosClient
        alumnos={tableRows}
        coaches={coachRows}
        planes={planes}
        sort={sort}
        dir={dir}
        sortQuery={sortQuery}
        canManage={canManage}
        initialTab={params.tab === "coaches" ? "coaches" : "alumnos"}
      />
    </div>
  )
}
