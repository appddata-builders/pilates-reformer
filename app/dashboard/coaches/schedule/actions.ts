"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { and, asc, eq, gte, lte } from "drizzle-orm"
import { dateRangeForDay } from "@/lib/booking-slot-options"

export type SlotRosterStudent = {
  bookingId: string
  name: string
  displayId: string | null
  phone: string | null
  attended: boolean | null
}

export type SlotRoster =
  | {
      ok: true
      className: string
      dateLabel: string
      capacity: number
      students: SlotRosterStudent[]
    }
  | { ok: false; error: string }

/** Alumn@s con reserva confirmada en la próxima fecha de este horario. */
export async function getSlotRosterAction(
  scheduleSlotId: string,
  bookingDateStr: string,
): Promise<SlotRoster> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || (role !== "admin" && role !== "root" && role !== "coach")) {
    return { ok: false, error: "No autorizado" }
  }

  const db = getDb()
  const [slot] = await db
    .select({
      className: schema.scheduleSlot.className,
      capacity: schema.scheduleSlot.capacity,
    })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.id, scheduleSlotId))
    .limit(1)

  if (slot == null) {
    return { ok: false, error: "Horario no encontrado" }
  }

  const { start, end } = dateRangeForDay(bookingDateStr)
  const rows = await db
    .select({
      bookingId: schema.booking.id,
      name: schema.user.name,
      displayId: schema.user.displayId,
      phone: schema.user.phone,
      attended: schema.booking.attended,
    })
    .from(schema.booking)
    .innerJoin(schema.user, eq(schema.booking.userId, schema.user.id))
    .where(
      and(
        eq(schema.booking.scheduleSlotId, scheduleSlotId),
        eq(schema.booking.status, "confirmed"),
        gte(schema.booking.bookingDate, start),
        lte(schema.booking.bookingDate, end),
      ),
    )
    .orderBy(asc(schema.user.name))

  const dateLabel = new Date(`${bookingDateStr}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return {
    ok: true,
    className: slot.className,
    dateLabel,
    capacity: slot.capacity,
    students: rows,
  }
}
