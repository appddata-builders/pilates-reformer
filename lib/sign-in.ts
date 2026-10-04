"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  signInWithPassword,
  verifyCognitoIdToken,
  type CognitoSignInFailure,
} from "@/lib/cognito"
import { ACCOUNT_DISABLED_MESSAGE, checkLoginUser, startSession } from "@/lib/session"
import { normalizeEmail } from "@/lib/user-accounts"

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string }

const INVALID_CREDENTIALS_MSG = "Correo o contraseña incorrectos"

const COGNITO_FAILURE_MSG: Record<CognitoSignInFailure, string> = {
  credentials: INVALID_CREDENTIALS_MSG,
  disabled: ACCOUNT_DISABLED_MESSAGE,
  unconfirmed: "Tu cuenta aún no está confirmada. Contacta al estudio.",
  reset_required: "Necesitas crear una nueva contraseña. Usa “¿Olvidaste tu contraseña?”.",
  temporary_password: "Tu contraseña es temporal. Pide al estudio que te la restablezca.",
  too_many_attempts: "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
  unavailable: "Problemas de conexión. Vuelva a intentar más tarde.",
}

/**
 * Login con correo y contraseña. El orden importa:
 * 1. la base corta a las cuentas inhabilitadas antes de gastar un intento en
 *    Cognito;
 * 2. Cognito valida la contraseña y entrega los tokens;
 * 3. se verifica el ID token, su `sub` tiene que ser el `cognito_id` del
 *    usuario, y los tokens quedan en cookies.
 */
export async function signInWithEmail(emailRaw: string, password: string): Promise<SignInResult> {
  const email = normalizeEmail(emailRaw)
  if (email === "" || password === "") {
    return { ok: false, error: INVALID_CREDENTIALS_MSG }
  }

  const [user] = await getDb()
    .select({ id: schema.user.id, enabled: schema.user.enabled })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  if (user == null) {
    return { ok: false, error: INVALID_CREDENTIALS_MSG }
  }
  if (user.enabled === false) {
    return { ok: false, error: ACCOUNT_DISABLED_MESSAGE }
  }

  const cognito = await signInWithPassword(email, password)
  if (!cognito.ok) {
    return { ok: false, error: COGNITO_FAILURE_MSG[cognito.reason] }
  }

  let payload: Awaited<ReturnType<typeof verifyCognitoIdToken>>
  try {
    payload = await verifyCognitoIdToken(cognito.idToken)
  } catch (e) {
    console.error("[login] Cognito entregó un ID token que no pasó la verificación:", e)
    return { ok: false, error: COGNITO_FAILURE_MSG.unavailable }
  }

  const check = await checkLoginUser(user.id, payload)
  if (!check.ok) {
    if (check.message === ACCOUNT_DISABLED_MESSAGE) {
      return { ok: false, error: ACCOUNT_DISABLED_MESSAGE }
    }
    console.error("[login] Cognito validó la contraseña pero no corresponde al usuario:", check.message)
    return { ok: false, error: INVALID_CREDENTIALS_MSG }
  }

  await startSession(cognito)
  return { ok: true }
}
