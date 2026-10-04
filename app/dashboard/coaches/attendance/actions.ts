"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import { recordCoachAttendance, type AttendanceResult } from "@/lib/coach-attendance"

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
    for (const path of ["/dashboard/coaches/attendance", "/dashboard/coaches/schedule",
      "/dashboard/reportes", "/dashboard/reservas", "/dashboard/pagos", "/dashboard/planes",
      "/dashboard/usuarios", "/dashboard/historico", "/agendar"]) revalidatePath(path)
  }
  return result
}
