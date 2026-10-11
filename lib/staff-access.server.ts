import "server-only"

import { cache } from "react"
import { isNavAllowed } from "@/lib/nav-permissions"
import { loadNavPermissions } from "@/lib/nav-permissions.server"

/** Módulos del panel cuyas acciones de escritura se pueden delegar a un coach. */
export type StaffModule =
  | "usuarios"
  | "clases"
  | "pagos"
  | "planes"
  | "cupones"
  | "calendario"
  | "configuracion"

const loadPermissionsOnce = cache(loadNavPermissions)

/**
 * Quién puede hacer cambios en un módulo: admin y root siempre; un coach cuando
 * el admin le dio ese módulo en Configuración → Permisos. Antes las acciones
 * exigían admin o root aunque el coach viera el módulo en su menú, así que todo
 * le respondía "No autorizado".
 */
export async function canManageModule(
  role: string | null | undefined,
  module: StaffModule,
): Promise<boolean> {
  if (role === "admin" || role === "root") return true
  if (role !== "coach") return false
  return isNavAllowed(await loadPermissionsOnce(), module, "coach")
}
