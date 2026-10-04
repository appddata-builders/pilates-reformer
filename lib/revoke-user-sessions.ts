import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { signOutCognitoUserEverywhere } from "@/lib/cognito"

/**
 * Cierra todas las sesiones del usuario al instante: lib/session.ts rechaza
 * los ID tokens emitidos antes de `sessions_revoked_at`, y Cognito revoca los
 * refresh tokens para que no se puedan renovar.
 */
export async function revokeUserSessions(db: AnyDb, userId: string) {
  const [row] = await db
    .select({ cognitoId: schema.user.cognitoId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  await db
    .update(schema.user)
    .set({ sessionsRevokedAt: new Date() })
    .where(eq(schema.user.id, userId))

  if (row != null) {
    await signOutCognitoUserEverywhere(row.cognitoId)
  }
}
