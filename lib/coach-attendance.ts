import { and, asc, eq, gt, inArray, ne, or, sql } from "drizzle-orm"
import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { withAsyncTransaction } from "@/lib/db/async-transaction"
import { getIndividualClassPlan } from "@/lib/class-charge"
import { activateSubscriptionForUser, closeExpiredSubscriptionsCarryingClasses } from "@/lib/activate-subscription"
import { pickPrimarySubscription, isSubscriptionCurrent } from "@/lib/subscription-display"
import { createNotification } from "@/lib/notifications"
import { toLocalDateStr } from "@/lib/booking-slot-options"
import { checkBookableSubscriptionForUser, findBookingForSlotOnDate } from "@/lib/booking-service"
import { isSlotDisabledOnDate } from "@/lib/slot-exceptions"

export type AttendanceCatalogItem = { id: string; name: string; priceMxn: number; kind: "plan" | "class" }
export async function getAttendanceCatalog(db: AnyDb): Promise<AttendanceCatalogItem[]> {
  const [plans, individual] = await Promise.all([
    db.select({ id: schema.plan.id, name: schema.plan.name, priceMxn: schema.plan.priceMxn })
      .from(schema.plan).where(and(eq(schema.plan.isActive, true), gt(schema.plan.priceMxn, 0)))
      .orderBy(asc(schema.plan.priceMxn)),
    getIndividualClassPlan(db),
  ])
  return plans.map((p) => ({ ...p, kind: p.id === individual?.id ? "class" : "plan" }))
}

export type AttendanceResult = { success: boolean; error?: string }
class AttendanceError extends Error {}

type Actor = { role: string; name: string; id: string }
type AttendanceParams = {
  bookingId: string
  attended: boolean
  catalogId?: string
  actor: Actor
}

const STAFF_ROLES = ["coach", "admin", "root"]

export async function recordCoachAttendance(db: AnyDb, params: AttendanceParams): Promise<AttendanceResult> {
  if (!STAFF_ROLES.includes(params.actor.role)) return { success: false, error: "No autorizado" }
  try {
    return await withAsyncTransaction(db, (tx) => applyAttendance(tx, params))
  } catch (error) {
    if (error instanceof AttendanceError) return { success: false, error: error.message }
    throw error
  }
}

/**
 * Registra la asistencia dentro de una transacción que abre quien llama, para
 * que la asistencia sin reserva comparta la misma con la reserva que crea.
 * Lanza AttendanceError cuando no procede.
 */
async function applyAttendance(tx: AnyDb, params: AttendanceParams): Promise<AttendanceResult> {
  const [row] = await tx.select({
    booking: schema.booking,
    slot: schema.scheduleSlot,
  }).from(schema.booking)
    .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
    .where(eq(schema.booking.id, params.bookingId)).limit(1)
  // Cualquier coach puede cubrir cualquier clase, así que también puede
  // registrar su asistencia aunque no figure como instructor.
  if (!row || row.booking.status !== "confirmed") throw new AttendanceError("La reserva ya no está confirmada")
  // Serializa cargos del mismo alumno, incluso en reservas distintas.
  await tx.update(schema.user).set({ updatedAt: sql`${schema.user.updatedAt}` })
    .where(eq(schema.user.id, row.booking.userId))
  // También bloquea la reserva y verifica que no se canceló mientras esperábamos.
  const locked = await tx.update(schema.booking).set({ status: "confirmed" })
    .where(and(eq(schema.booking.id, params.bookingId), eq(schema.booking.status, "confirmed")))
    .returning({ id: schema.booking.id })
  if (locked.length === 0) throw new AttendanceError("La reserva ya no está confirmada")

  if (params.catalogId && !params.attended) throw new AttendanceError("El adeudo sólo se registra al marcar Asistió")
  if (params.catalogId) {
    if (row.booking.trialClass) throw new AttendanceError("Esta reserva es una clase muestra; administración debe revisar cualquier cambio de cobro")
    const item = (await getAttendanceCatalog(tx)).find((p) => p.id === params.catalogId)
    if (!item) throw new AttendanceError("El plan o clase ya no está disponible")
    const chargeId = `attendance:${params.bookingId}`
    const charges = await tx.select().from(schema.payment).where(and(
      or(eq(schema.payment.bookingId, params.bookingId), eq(schema.payment.id, chargeId)),
      eq(schema.payment.isNegative, false),
    ))
    if (charges.some((p) => p.status === "cancelled")) throw new AttendanceError("Administración ya anuló el cobro de esta reserva. Marca sin nuevo adeudo o solicita su revisión.")
    const existingOwn = charges.find((p) => p.id === chargeId)
    if (charges.length > 0) {
      // Repetir Asistió nunca cambia ni duplica un cobro ya registrado.
      if (item.kind !== "class" || charges.some((p) => p.subscriptionId != null)) {
        if (!existingOwn || existingOwn.subscriptionId == null) {
          throw new AttendanceError("La reserva ya tiene un cobro. Marca sin nuevo adeudo; administración debe regularizar el cambio de plan.")
        }
        const [linked] = await tx.select().from(schema.subscription)
          .where(eq(schema.subscription.id, existingOwn.subscriptionId)).limit(1)
        if (linked?.planId !== item.id) throw new AttendanceError("Administración debe regularizar el cambio de plan")
      }
    } else if (item.kind === "class") {
      await tx.insert(schema.payment).values({
        id: chargeId, userId: row.booking.userId, bookingId: params.bookingId,
        amount: item.priceMxn, method: "efectivo", status: "pending",
        concept: `${item.name} · ${row.slot.className} · ${toLocalDateStr(row.booking.bookingDate)} · Registró ${params.actor.name || params.actor.id}`,
      })
      await createNotification(tx, { userId: row.booking.userId, type: "class_charge_pending",
        title: "Asistencia registrada, pago pendiente",
        body: `${item.name}: $${item.priceMxn.toFixed(2)} MXN pendientes. Administración confirmará tu pago.`,
      })
    } else {
      const subs = await tx.select().from(schema.subscription).where(and(
        eq(schema.subscription.userId, row.booking.userId), eq(schema.subscription.status, "active"),
      ))
      const current = pickPrimarySubscription(subs)
      if (current && isSubscriptionCurrent(current.status, current.endDate)) {
        if (current.planId !== item.id) throw new AttendanceError("El alumno tiene otro plan vigente. Administración debe regularizar el cambio.")
        // La reserva ya consumió su clase al agendar; no se descuenta otra.
      } else {
        if (toLocalDateStr(row.booking.bookingDate) !== toLocalDateStr(new Date())) {
          throw new AttendanceError("Sólo puedes iniciar un plan con la asistencia de hoy. Administración puede revisar fechas anteriores.")
        }
        const [debt] = await tx.select({ id: schema.payment.id }).from(schema.payment)
          .where(and(eq(schema.payment.userId, row.booking.userId), eq(schema.payment.status, "pending"),
            sql`${schema.payment.subscriptionId} IS NOT NULL`)).limit(1)
        if (debt) throw new AttendanceError("El alumno debe un plan anterior. Administración debe confirmar ese pago antes de renovarlo.")
        const carriedClasses = await closeExpiredSubscriptionsCarryingClasses(tx, row.booking.userId)
        const result = await activateSubscriptionForUser(tx, { userId: row.booking.userId, planId: item.id, carriedClasses })
        if (!result.ok) throw new AttendanceError(result.error)
        const [sub] = await tx.select().from(schema.subscription).where(and(
          eq(schema.subscription.userId, row.booking.userId), eq(schema.subscription.status, "active"),
        )).limit(1)
        await tx.update(schema.subscription).set({
          classesRemaining: sub.isUnlimited ? null : Math.max(0, (sub.classesRemaining ?? 0) - 1),
        }).where(eq(schema.subscription.id, sub.id))
        // Vincula la selección para hacer reintentos idempotentes. No se liga
        // bookingId: cancelar una clase no debe perdonar la mensualidad.
        await tx.update(schema.payment).set({
          id: chargeId,
          concept: `Suscripción: ${item.name} · Asistencia ${params.bookingId} · Registró ${params.actor.name || params.actor.id}`,
        }).where(eq(schema.payment.subscriptionId, sub.id))
        await createNotification(tx, { userId: row.booking.userId, type: "plan_requested",
          title: "Plan registrado a cuenta",
          body: `${item.name} quedó activo con $${item.priceMxn.toFixed(2)} MXN pendientes. Administración confirmará el pago. Renueva desde Mis planes al terminar el periodo.`,
        })
      }
    }
  }
  await tx.update(schema.booking).set({ attended: params.attended, countedAsAttended: true })
    .where(eq(schema.booking.id, params.bookingId))
  return { success: true }
}

export type AttendanceCandidate = {
  id: string
  name: string
  email: string
  /** Estado del plan para elegir qué cobrar: "Plan vigente · 5 clases", "Sin plan"… */
  planLabel: string
}

type CandidateSubscription = {
  userId: string
  status: string
  endDate: Date | number
  classesRemaining: number | null
  isUnlimited: boolean | null
}

function describePlan(sub: CandidateSubscription | null): string {
  if (sub == null) return "Sin plan"
  const left = sub.classesRemaining ?? 0
  const classes = left === 1 ? "1 clase" : `${left} clases`
  if (isSubscriptionCurrent(sub.status, sub.endDate)) {
    return sub.isUnlimited ? "Plan vigente · ilimitado" : `Plan vigente · ${classes}`
  }
  return !sub.isUnlimited && left > 0 ? `Plan vencido · ${classes} por usar` : "Plan vencido"
}

/** Alumn@s por correo o nombre, tengan o no reserva, para hacerles presentes. */
export async function searchAttendanceCandidates(db: AnyDb, query: string): Promise<AttendanceCandidate[]> {
  // % y _ son comodines de LIKE; se quitan para que el texto se busque literal.
  const q = query.trim().toLowerCase().replace(/[%_]/g, "")
  if (q.length < 2) return []
  const pattern = `%${q}%`

  const users = await db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(and(
      eq(schema.user.role, "alumno"),
      ne(schema.user.enabled, false),
      or(sql`lower(${schema.user.email}) like ${pattern}`, sql`lower(${schema.user.name}) like ${pattern}`),
    ))
    .orderBy(asc(schema.user.name))
    .limit(8)
  if (users.length === 0) return []

  const subs = await db.select({
    userId: schema.subscription.userId,
    status: schema.subscription.status,
    endDate: schema.subscription.endDate,
    classesRemaining: schema.subscription.classesRemaining,
    isUnlimited: schema.subscription.isUnlimited,
  }).from(schema.subscription)
    .where(and(
      inArray(schema.subscription.userId, users.map((u) => u.id)),
      eq(schema.subscription.status, "active"),
    ))

  return users.map((u) => ({
    ...u,
    planLabel: describePlan(pickPrimarySubscription(subs.filter((sub) => sub.userId === u.id))),
  }))
}

async function hasCurrentSubscription(tx: AnyDb, userId: string): Promise<boolean> {
  const subs = await tx.select({
    userId: schema.subscription.userId,
    status: schema.subscription.status,
    endDate: schema.subscription.endDate,
  }).from(schema.subscription)
    .where(and(eq(schema.subscription.userId, userId), eq(schema.subscription.status, "active")))
  const primary = pickPrimarySubscription(subs)
  return primary != null && isSubscriptionCurrent(primary.status, primary.endDate)
}

/**
 * Asistencia de alguien sin reserva: el coach la encuentra por correo y la hace
 * presente en una clase del día. El lugar se aparta aunque la clase esté llena
 * o ya haya empezado -la persona ya está en el estudio- y la asistencia sigue
 * las mismas reglas de cobro. Reserva y asistencia van en una sola transacción:
 * si la asistencia no procede, tampoco queda la reserva.
 */
export async function recordWalkInAttendance(db: AnyDb, params: {
  userId: string
  scheduleSlotId: string
  dateStr: string
  catalogId?: string
  actor: Actor
}): Promise<AttendanceResult> {
  if (!STAFF_ROLES.includes(params.actor.role)) return { success: false, error: "No autorizado" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dateStr)) return { success: false, error: "Fecha inválida" }
  try {
    return await withAsyncTransaction(db, async (tx) => {
      const [user] = await tx.select({ role: schema.user.role, enabled: schema.user.enabled })
        .from(schema.user).where(eq(schema.user.id, params.userId)).limit(1)
      if (user == null || user.role !== "alumno") throw new AttendanceError("Sólo se registra asistencia de alumn@s")
      if (user.enabled === false) throw new AttendanceError("Esta cuenta está inhabilitada")

      const [slot] = await tx.select({ id: schema.scheduleSlot.id, dayOfWeek: schema.scheduleSlot.dayOfWeek,
        isActive: schema.scheduleSlot.isActive })
        .from(schema.scheduleSlot).where(eq(schema.scheduleSlot.id, params.scheduleSlotId)).limit(1)
      if (slot == null || !slot.isActive) throw new AttendanceError("Esa clase ya no está en el horario")
      const bookingDate = new Date(`${params.dateStr}T12:00:00`)
      if (bookingDate.getDay() !== slot.dayOfWeek || await isSlotDisabledOnDate(tx, slot.id, params.dateStr)) {
        throw new AttendanceError("Esa clase no se imparte ese día")
      }

      // Si ya tenía reserva en esa clase, sólo se registra la asistencia.
      const existing = await findBookingForSlotOnDate(tx, params.userId, slot.id, bookingDate)
      let bookingId = existing?.id
      if (bookingId == null) {
        // Se revisa antes de insertar, igual que al reservar: la reserva nueva no
        // debe contar contra su propio tope semanal.
        const coverage = await checkBookableSubscriptionForUser(tx, params.userId, bookingDate)
        const item = params.catalogId
          ? (await getAttendanceCatalog(tx)).find((p) => p.id === params.catalogId)
          : undefined
        // Si esta asistencia inicia un plan, ese plan descuenta la clase;
        // descontarla también del periodo vencido la cobraría dos veces.
        const startsPlan = item?.kind === "plan" && !(await hasCurrentSubscription(tx, params.userId))

        bookingId = crypto.randomUUID()
        await tx.insert(schema.booking).values({
          id: bookingId, userId: params.userId, scheduleSlotId: slot.id, bookingDate, status: "confirmed",
        })
        if (coverage.ok && !startsPlan) {
          await tx.update(schema.subscription)
            .set({ classesRemaining: sql`${schema.subscription.classesRemaining} - 1` })
            .where(and(eq(schema.subscription.id, coverage.subscriptionId), gt(schema.subscription.classesRemaining, 0)))
        }
      }
      return applyAttendance(tx, { bookingId, attended: true, catalogId: params.catalogId, actor: params.actor })
    })
  } catch (error) {
    if (error instanceof AttendanceError) return { success: false, error: error.message }
    throw error
  }
}
