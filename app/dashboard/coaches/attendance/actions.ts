"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import {
  recordCoachAttendance,
  recordWalkInAttendance,
  searchAttendanceCandidates,
  type AttendanceCandidate,
  type AttendanceResult,
} from "@/lib/coach-attendance"

const ATTENDANCE_PATHS = ["/dashboard/coaches/attendance", "/dashboard/coaches/schedule",
  "/dashboard/reportes", "/dashboard/reservas", "/dashboard/pagos", "/dashboard/planes",
  "/dashboard/usuarios", "/dashboard/historico", "/agendar"]

function isStaffRole(role: string | null | undefined): boolean {
  return role === "coach" || role === "admin" || role === "root"
}

export async function toggleAttendanceAction(formData: FormData): Promise<AttendanceResult> {
  const session = await getSession()
  if (!session) return { success: false, error: "No autorizado" }
  const bookingId = formData.get("bookingId")
  const attended = formData.get("attended")
  const catalogId = formData.get("catalogId")
  if (typeof bookingId !== "string" || !["true", "false"].includes(String(attended)) ||
      (catalogId != null && typeof catalogId !== "string")) {
    return { success: false, error: "Datos de asistencia inválidos" }
  }
  const result = await recordCoachAttendance(getDb(), {
    bookingId, attended: attended === "true", catalogId: catalogId || undefined,
    actor: { id: session.user.id, name: session.user.name ?? "", role: session.user.role ?? "" },
  })
  if (result.success) {
    for (const path of ATTENDANCE_PATHS) revalidatePath(path)
  }
  return result
}

/** Cualquier alumn@ por correo o nombre, tenga o no reserva ese día. */
export async function searchAttendanceCandidatesAction(query: string): Promise<AttendanceCandidate[]> {
  const session = await getSession()
  if (!session || !isStaffRole(session.user.role)) return []
  if (typeof query !== "string") return []
  return searchAttendanceCandidates(getDb(), query.slice(0, 120))
}

/** Hace presente en una clase del día a alguien que llegó sin reserva. */
export async function markWalkInAttendanceAction(input: {
  userId: string
  scheduleSlotId: string
  dateStr: string
  catalogId?: string
}): Promise<AttendanceResult> {
  const session = await getSession()
  if (!session || !isStaffRole(session.user.role)) return { success: false, error: "No autorizado" }
  if (typeof input?.userId !== "string" || typeof input.scheduleSlotId !== "string" ||
      typeof input.dateStr !== "string" || (input.catalogId != null && typeof input.catalogId !== "string")) {
    return { success: false, error: "Datos de asistencia inválidos" }
  }
  const result = await recordWalkInAttendance(getDb(), {
    userId: input.userId,
    scheduleSlotId: input.scheduleSlotId,
    dateStr: input.dateStr,
    catalogId: input.catalogId || undefined,
    actor: { id: session.user.id, name: session.user.name ?? "", role: session.user.role ?? "" },
  })
  if (result.success) {
    for (const path of ATTENDANCE_PATHS) revalidatePath(path)
  }
  return result
}
