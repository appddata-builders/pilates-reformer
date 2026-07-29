import { mainNavItems } from "@/modules/admin/nav-items"
import { routes } from "@/lib/routes"
import { ALUMNO_ROLE_LABEL, COACH_ROLE_LABEL } from "@/lib/user-role"

export const CONFIGURABLE_ROLES = ["root", "admin", "coach", "alumno"] as const
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number]

export const ROLE_LABELS: Record<ConfigurableRole, string> = {
  root: "Root",
  admin: "Admin",
  coach: COACH_ROLE_LABEL,
  alumno: ALUMNO_ROLE_LABEL,
}

export type NavPermissionRow = Record<ConfigurableRole, boolean>
export type NavPermissionsMap = Record<string, NavPermissionRow>

const ROOT_ALWAYS_KEYS = new Set(["dashboard", "configuracion"])

export function getDefaultNavPermissions(): NavPermissionsMap {
  const map: NavPermissionsMap = {}
  for (const item of mainNavItems) {
    map[item.key] = { root: false, admin: false, coach: false, alumno: false }
  }
  return map
}

export function getFullRootNavPermissions(): NavPermissionsMap {
  const map = getDefaultNavPermissions()
  for (const item of mainNavItems) {
    map[item.key] = { root: true, admin: true, coach: false, alumno: false }
  }
  return map
}

export function parseNavPermissionsJson(raw: string | null | undefined): NavPermissionsMap {
  const defaults = getDefaultNavPermissions()
  if (raw == null || raw.trim() === "") return defaults
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== "object") return defaults
    const out: NavPermissionsMap = { ...defaults }
    const rawMap = parsed as NavPermissionsMap
    for (const item of mainNavItems) {
      const saved = rawMap[item.key]
      if (saved == null || typeof saved !== "object") {
        out[item.key] = { root: true, admin: true, coach: false, alumno: false }
        continue
      }
      const row = { ...defaults[item.key] }
      for (const role of CONFIGURABLE_ROLES) {
        if (typeof saved[role] === "boolean") {
          row[role] = saved[role]
        }
      }
      out[item.key] = row
    }
    return out
  } catch {
    return defaults
  }
}

export function isNavAllowed(
  permissions: NavPermissionsMap,
  navKey: string,
  role: string,
): boolean {
  if (role === "root" && ROOT_ALWAYS_KEYS.has(navKey)) return true
  const row = permissions[navKey]
  if (row == null) return false
  if (role === "root" || role === "admin" || role === "coach" || role === "alumno") {
    return row[role as ConfigurableRole] === true
  }
  return false
}

export function getNavItemsForRole(role: string, permissions?: NavPermissionsMap) {
  const perms = permissions ?? getDefaultNavPermissions()
  const items = mainNavItems.filter((item) => isNavAllowed(perms, item.key, role))
  const config = items.filter((item) => item.key === "configuracion")
  const rest = items.filter((item) => item.key !== "configuracion")
  return [...rest, ...config]
}

export function hasNoNavAccess(role: string, permissions?: NavPermissionsMap): boolean {
  return getNavItemsForRole(role, permissions).length === 0
}

export function getDashboardNavKeyForPath(pathname: string): string | null {
  if (pathname === routes.dashboard || pathname === "/dashboard") return "dashboard"
  if (pathname === routes.politica || pathname.startsWith(`${routes.politica}/`)) return "configuracion"
  // Coaches se fusionó con Usuarios: la ruta vieja sólo redirige a su pestaña.
  if (pathname === routes.coaches) return "usuarios"
  for (const item of mainNavItems) {
    if (item.url === routes.dashboard) continue
    if (pathname === item.url || pathname.startsWith(`${item.url}/`)) return item.key
  }
  if (pathname.startsWith("/dashboard")) return null
  return null
}

export function canAccessDashboardPath(
  role: string,
  pathname: string,
  permissions?: NavPermissionsMap,
): boolean {
  const perms = permissions ?? getDefaultNavPermissions()
  const navKey = getDashboardNavKeyForPath(pathname)
  if (navKey == null) return false
  return isNavAllowed(perms, navKey, role)
}

export function getFirstAllowedDashboardUrl(
  role: string,
  permissions?: NavPermissionsMap,
): string {
  const items = getNavItemsForRole(role, permissions)
  if (items.length === 0) return routes.dashboard
  return items[0].url
}

export function serializeNavPermissions(map: NavPermissionsMap): string {
  const out: NavPermissionsMap = {}
  for (const item of mainNavItems) {
    const row = map[item.key]
    if (row != null) out[item.key] = row
  }
  return JSON.stringify(out)
}
