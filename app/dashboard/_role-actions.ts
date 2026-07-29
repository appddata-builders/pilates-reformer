"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { routes } from "@/lib/routes"
import { parseManageableRole } from "@/lib/user-role"
import { changeUserRole } from "@/lib/user-role.server"

export type ChangeRoleState = {
  success: boolean
  error?: string
}

export async function changeUserRoleAction(
  _prev: ChangeRoleState,
  formData: FormData,
): Promise<ChangeRoleState> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })
  const isAdminLike =
    session != null && (session.user.role === "admin" || session.user.role === "root")
  if (!isAdminLike || session == null) {
    return { success: false, error: "No autorizado" }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, error: "ID inválido" }
  }

  const nextRole = parseManageableRole(formData.get("role"))
  if (nextRole == null) {
    return { success: false, error: "Rol inválido" }
  }

  if (session.user.id === id) {
    return { success: false, error: "No puedes cambiar tu propio rol" }
  }

  try {
    const result = await changeUserRole(getDb(), { userId: id, nextRole })
    if (!result.ok) {
      return { success: false, error: result.error }
    }

    revalidatePath(routes.usuarios)
    revalidatePath(routes.usuarioDetail(id))
    revalidatePath(routes.coaches)
    revalidatePath(routes.clases)
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos"
    return { success: false, error: msg }
  }
}
