import "server-only"

import { passwordSchema } from "@/lib/password-rules"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { confirmPasswordReset, sendPasswordResetCode } from "@/lib/cognito"
import { createNotification } from "@/lib/notifications"
import { revokeUserSessions } from "@/lib/revoke-user-sessions"
import { normalizeEmail } from "@/lib/user-accounts"

/**
 * "Olvidé mi contraseña" con el servicio de Cognito, como el recovery de
 * refautomex: Cognito manda un código desde no-reply@verificationemail.com y
 * con ese código se guarda la nueva contraseña. El estudio no envía correos.
 */

// Respuesta única para cualquier identificador: no revelamos si la cuenta existe.
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "Si la cuenta existe, te enviamos un código desde no-reply@verificationemail.com. Revisa también la carpeta de spam."

export const PASSWORD_RESET_INVALID_CODE_MESSAGE =
  "El código no es válido o ya venció. Solicita uno nuevo."

// Mismas reglas que el registro: las de la política de Cognito.
export const newPasswordSchema = passwordSchema

/** Devuelve null si el correo no es de una cuenta activa. */
async function resolveResetUser(emailRaw: string) {
  const email = normalizeEmail(emailRaw)
  if (email === "") return null

  const [row] = await getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      enabled: schema.user.enabled,
    })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  // Una cuenta inhabilitada no debe poder recuperarse sola.
  if (row == null || row.enabled === false) return null
  return row
}

/** Pide a Cognito el código. No revela si la cuenta existe. */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const user = await resolveResetUser(emailRaw)
  if (user == null) return
  await sendPasswordResetCode(user.email.trim())
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; field?: "code" | "password" }

/** Una cuenta inhabilitada tampoco puede cambiar su contraseña con el código. */
export async function resetPasswordWithCode(
  emailRaw: string,
  code: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const user = await resolveResetUser(emailRaw)
  if (user == null) {
    return { ok: false, error: PASSWORD_RESET_INVALID_CODE_MESSAGE, field: "code" }
  }

  const result = await confirmPasswordReset(user.email.trim(), code, newPassword)
  if (!result.ok) {
    switch (result.reason) {
      case "code":
        return { ok: false, error: PASSWORD_RESET_INVALID_CODE_MESSAGE, field: "code" }
      case "password":
        return {
          ok: false,
          error: result.message ?? "La contraseña no cumple la política de seguridad",
          field: "password",
        }
      case "too_many_attempts":
        return { ok: false, error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." }
      case "unavailable":
        return { ok: false, error: "Problemas de conexión. Vuelva a intentar más tarde." }
    }
  }

  const db = getDb()
  await revokeUserSessions(db, user.id)

  const name = user.name?.trim() || "Usuario"
  await createNotification(db, {
    userId: user.id,
    type: "password_reset",
    title: "Contraseña actualizada",
    body: `Hola ${name}, tu contraseña se cambió con el código de recuperación. Si no fuiste tú, avisa al estudio de inmediato.`,
  })

  return { ok: true }
}
