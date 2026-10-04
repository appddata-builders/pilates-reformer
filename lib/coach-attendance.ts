import { and, asc, eq, gt, or, sql } from "drizzle-orm"
import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { withAsyncTransaction } from "@/lib/db/async-transaction"
import { coachTeachesSlot } from "@/lib/schedule-instructor"
import { getIndividualClassPlan } from "@/lib/class-charge"
import { activateSubscriptionForUser, cancelActiveSubscriptionsForUser } from "@/lib/activate-subscription"
import { pickPrimarySubscription, isSubscriptionCurrent } from "@/lib/subscription-display"
import { createNotification } from "@/lib/notifications"
import { toLocalDateStr } from "@/lib/booking-slot-options"

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

export async function recordCoachAttendance(db: AnyDb, params: {
  bookingId: string
  attended: boolean
  catalogId?: string
  actor: { role: string; name: string; id: string }
}): Promise<AttendanceResult> {
  if (!["coach", "admin", "root"].includes(params.actor.role)) return { success: false, error: "No autorizado" }
  try {
    return await withAsyncTransaction(db, async (tx) => {
      const [row] = await tx.select({
        booking: schema.booking,
        slot: schema.scheduleSlot,
      }).from(schema.booking)
        .innerJoin(schema.scheduleSlot, eq(schema.booking.scheduleSlotId, schema.scheduleSlot.id))
        .where(eq(schema.booking.id, params.bookingId)).limit(1)
      if (!row || row.booking.status !== "confirmed") throw new AttendanceError("La reserva ya no está confirmada")
      if (params.actor.role === "coach" && !coachTeachesSlot(row.slot, params.actor.name)) {
        throw new AttendanceError("Sólo puedes registrar asistencia en tus clases")
      }
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
            await cancelActiveSubscriptionsForUser(tx, row.booking.userId, { status: "expired" })
            const result = await activateSubscriptionForUser(tx, { userId: row.booking.userId, planId: item.id })
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
    })
  } catch (error) {
    if (error instanceof AttendanceError) return { success: false, error: error.message }
    throw error
  }
}
