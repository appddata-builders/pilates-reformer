import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendPasswordResetCode } from "@/lib/cognito"
import { createNotification } from "@/lib/notifications"

const SEND_FAILURE_MSG = {
  unconfirmed:
    "La cuenta aún no confirma su correo: que entre con su contraseña temporal y el código que le llegó al darla de alta.",
  not_found: "Esta cuenta no existe en Cognito.",
  too_many_attempts: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.",
  unavailable: "No se pudo enviar el código. Intenta de nuevo en unos minutos.",
} as const

/**
 * "Restablecer contraseña" del estudio. Sin APIs de admin el estudio no puede
 * poner la contraseña de otra persona: Cognito le manda el código de "olvidé
 * mi contraseña" y ella crea la suya en /restablecer-password. Las sesiones se
 * cierran cuando la cambia (lib/password-reset.ts).
 *
 * Devuelve el correo al que se mandó.
 */
export async function sendStudioPasswordReset(userId: string): Promise<string> {
  const db = getDb()
  const [userRow] = await db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (userRow == null) {
    throw new Error("Usuario no encontrado")
  }

  const result = await sendPasswordResetCode(userRow.email)
  if (!result.ok) {
    throw new Error(SEND_FAILURE_MSG[result.reason])
  }

  const userName = userRow.name?.trim() || "Usuario"
  await createNotification(db, {
    userId,
    type: "password_reset",
    title: "Cambia tu contraseña",
    body: `Hola ${userName}, el estudio te envió por correo un código para crear una contraseña nueva. Úsalo en «¿Olvidaste tu contraseña?».`,
  })

  return userRow.email
}
