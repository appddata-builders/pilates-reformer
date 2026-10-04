"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function toggleAttendanceAction(formData: FormData): Promise<void> {
  const session = await getSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || (role !== "admin" && role !== "coach")) return

  const bookingId = formData.get("bookingId")
  const attendedRaw = formData.get("attended")
  if (typeof bookingId !== "string" || typeof attendedRaw !== "string") return

  const attended = attendedRaw === "true"
  const db = getDb()

  const [booking] = await db
    .select({
      id: schema.booking.id,
      status: schema.booking.status,
      userId: schema.booking.userId,
      countedAsAttended: schema.booking.countedAsAttended,
    })
    .from(schema.booking)
    .where(eq(schema.booking.id, bookingId))
    .limit(1)

  if (!booking) return

  if (!attended && booking.status === "confirmed") {
    await db
      .update(schema.booking)
      .set({ attended: false, countedAsAttended: true })
      .where(eq(schema.booking.id, bookingId))
  } else if (attended) {
    await db
      .update(schema.booking)
      .set({ attended: true, countedAsAttended: true })
      .where(eq(schema.booking.id, bookingId))
  } else {
    await db
      .update(schema.booking)
      .set({ attended })
      .where(eq(schema.booking.id, bookingId))
  }

  const dateRaw = formData.get("date")
  const dateQuery =
    typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? `?date=${dateRaw}`
      : ""

  revalidatePath(`/dashboard/coaches/attendance${dateQuery}`)
  revalidatePath("/dashboard/reportes")
}
