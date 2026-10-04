import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { setCognitoPassword } from "@/lib/cognito"
import { generatePassword } from "@/lib/generate-password"
import { createNotification } from "@/lib/notifications"
import { revokeUserSessions } from "@/lib/revoke-user-sessions"

export async function resetUserPassword(userId: string): Promise<string> {
  const newPassword = generatePassword()
  const db = getDb()

  const [userRow] = await db
    .select({ name: schema.user.name, cognitoId: schema.user.cognitoId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (userRow == null) {
    throw new Error("Usuario no encontrado")
  }

  await setCognitoPassword(userRow.cognitoId, newPassword)

  await revokeUserSessions(db, userId)

  const userName = userRow.name?.trim() || "Usuario"

  await createNotification(db, {
    userId,
    type: "password_reset",
    title: "Contraseña actualizada",
    body: `Hola ${userName}, tu contraseña del panel fue restablecida por el estudio. Usa la nueva contraseña que te compartieron para iniciar sesión.`,
  })

  return newPassword
}
