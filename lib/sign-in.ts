"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  confirmCognitoSignUp,
  resendCognitoConfirmation,
  signInWithPassword,
  verifyCognitoIdToken,
  type CognitoSignInFailure,
} from "@/lib/cognito"
import { ACCOUNT_DISABLED_MESSAGE, checkLoginUser, startSession } from "@/lib/session"
import { normalizeEmail } from "@/lib/user-accounts"

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string; needsConfirmation?: boolean }

const INVALID_CREDENTIALS_MSG = "Correo o contraseña incorrectos"

const COGNITO_FAILURE_MSG: Record<CognitoSignInFailure, string> = {
  credentials: INVALID_CREDENTIALS_MSG,
  disabled: ACCOUNT_DISABLED_MESSAGE,
  unconfirmed: "Confirma tu correo: escribe el código que te mandamos de no-reply@verificationemail.com.",
  reset_required: "Necesitas crear una nueva contraseña. Usa “¿Olvidaste tu contraseña?”.",
  temporary_password: "Tu contraseña es temporal. Contacta al estudio.",
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
    return {
      ok: false,
      error: COGNITO_FAILURE_MSG[cognito.reason],
      ...(cognito.reason === "unconfirmed" ? { needsConfirmation: true } : {}),
    }
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

const CONFIRM_FAILURE_MSG = {
  code: "El código no es válido o ya venció. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
  unavailable: "Problemas de conexión. Vuelva a intentar más tarde.",
} as const

/**
 * Primera entrada de una cuenta nueva: confirma el correo con el código que
 * mandó Cognito al darla de alta y luego entra normal.
 */
export async function confirmAccountAndSignIn(
  emailRaw: string,
  password: string,
  codeRaw: string,
): Promise<SignInResult> {
  const email = normalizeEmail(emailRaw)
  const code = codeRaw.replace(/\s+/g, "")
  if (code === "") {
    return { ok: false, error: "Escribe el código que te llegó por correo", needsConfirmation: true }
  }

  const confirmed = await confirmCognitoSignUp(email, code)
  if (!confirmed.ok) {
    return { ok: false, error: CONFIRM_FAILURE_MSG[confirmed.reason], needsConfirmation: true }
  }
  return signInWithEmail(email, password)
}

/** No revela si la cuenta existe: la respuesta es la misma. */
export async function resendAccountCode(emailRaw: string): Promise<{ message: string }> {
  const email = normalizeEmail(emailRaw)
  const [user] = await getDb()
    .select({ enabled: schema.user.enabled })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  if (user != null && user.enabled !== false) {
    await resendCognitoConfirmation(email)
  }
  return { message: "Si la cuenta existe y falta confirmarla, te reenviamos el código." }
}
