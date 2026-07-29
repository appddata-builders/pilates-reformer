import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateDisplayId } from "@/lib/display-id"
import { USER_ID_PREFIX_REGULAR } from "@/lib/id-prefix"
import { createNotification } from "@/lib/notifications"
import { ALUMNO_ROLE_LABEL, parseManageableRole, type ManageableRole } from "@/lib/user-role"

export type ChangeUserRoleResult =
  | { ok: true; role: ManageableRole }
  | { ok: false; error: string }

// Sólo movemos alumn@s y coaches entre sí: admin y root se administran aparte.
export async function changeUserRole(
  db: AnyDb,
  params: { userId: string; nextRole: ManageableRole },
): Promise<ChangeUserRoleResult> {
  const [existing] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      role: schema.user.role,
      displayId: schema.user.displayId,
    })
    .from(schema.user)
    .where(eq(schema.user.id, params.userId))
    .limit(1)

  if (existing == null) {
    return { ok: false, error: "Usuario no encontrado" }
  }

  const currentRole = parseManageableRole(existing.role)
  if (currentRole == null) {
    return { ok: false, error: "Sólo puedes cambiar el rol de alumn@s y coaches" }
  }
  if (currentRole === params.nextRole) {
    return { ok: true, role: params.nextRole }
  }

  if (params.nextRole === "coach") {
    await db
      .update(schema.user)
      .set({ role: "coach" })
      .where(eq(schema.user.id, existing.id))
  } else {
    // Al dejar de ser coach liberamos los horarios donde figuraba como instructor.
    await db
      .update(schema.scheduleSlot)
      .set({ instructor: null })
      .where(eq(schema.scheduleSlot.instructor, existing.name))
    await db
      .update(schema.scheduleSlot)
      .set({ alternateInstructor: null })
      .where(eq(schema.scheduleSlot.alternateInstructor, existing.name))

    const hasDisplayId = existing.displayId != null && existing.displayId.trim() !== ""
    const displayId = hasDisplayId
      ? existing.displayId
      : await generateDisplayId(db, USER_ID_PREFIX_REGULAR)

    await db
      .update(schema.user)
      .set({ role: "alumno", displayId, idPrefix: USER_ID_PREFIX_REGULAR })
      .where(eq(schema.user.id, existing.id))
  }

  await createNotification(db, {
    userId: existing.id,
    type: "role_change",
    title: "Tu rol cambió",
    body:
      params.nextRole === "coach"
        ? "El estudio te asignó el rol de Coach. Al entrar al panel verás las secciones de coach."
        : `El estudio te asignó el rol de ${ALUMNO_ROLE_LABEL}. Ya puedes reservar clases con tu ID de usuario.`,
  })

  return { ok: true, role: params.nextRole }
}
