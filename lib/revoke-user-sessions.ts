import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Cierra todas las sesiones del usuario al instante: lib/session.ts rechaza
 * los ID tokens con `auth_time` anterior a `sessions_revoked_at`. Renovar el
 * token no lo salva, porque Cognito conserva el `auth_time` original; para
 * volver a entrar hay que escribir la contraseña.
 */
export async function revokeUserSessions(db: AnyDb, userId: string) {
  await db
    .update(schema.user)
    .set({ sessionsRevokedAt: new Date() })
    .where(eq(schema.user.id, userId))
}
