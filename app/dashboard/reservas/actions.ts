"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import { cancelBookingById } from "@/lib/booking-service"

export type ActionState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  message?: string
  bookedDate?: string
}

export async function cancelBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: "No autorizado" }
  }

  const role = session.user.role ?? ""
  const isStaff = role === "admin" || role === "root" || role === "coach"
  const isAlumno = role === "alumno"
  if (!isStaff && !isAlumno) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const bypassPolicy = role === "root"
  const result = await cancelBookingById(db, id, {
    bypassPolicy,
    asAlumnoUserId: isAlumno ? session.user.id : undefined,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/historico")
  return { success: true }
}

export async function cancelBookingDirect(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: "No autorizado" }
  }

  const role = session.user.role ?? ""
  const isStaff = role === "admin" || role === "root" || role === "coach"
  const isAlumno = role === "alumno"
  if (!isStaff && !isAlumno) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string") return { success: false, error: "ID inválido" }

  const db = getDb()
  const bypassPolicy = role === "root"
  const result = await cancelBookingById(db, id, {
    bypassPolicy,
    asAlumnoUserId: isAlumno ? session.user.id : undefined,
  })

  if (!result.ok) {
    return { success: false, error: result.message }
  }

  revalidatePath("/dashboard/reservas")
  revalidatePath("/dashboard/historico")
  return { success: true }
}
