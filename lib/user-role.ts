export const ALUMNO_ROLE_LABEL = "Alumn@"
export const COACH_ROLE_LABEL = "Coach"

export const MANAGEABLE_ROLES = ["alumno", "coach"] as const
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number]

export function manageableRoleLabel(role: ManageableRole): string {
  return role === "coach" ? COACH_ROLE_LABEL : ALUMNO_ROLE_LABEL
}

export function parseManageableRole(raw: unknown): ManageableRole | null {
  if (raw === "alumno" || raw === "coach") return raw
  return null
}
