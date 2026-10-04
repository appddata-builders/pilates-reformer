import { cache } from "react"
import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { revokeRefreshToken, verifyCognitoIdToken, type CognitoTokens } from "@/lib/cognito"
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from "@/lib/session-cookies"

export const ACCOUNT_DISABLED_MESSAGE = "Tu cuenta está inhabilitada. Contacta al estudio."

type IdTokenPayload = Awaited<ReturnType<typeof verifyCognitoIdToken>>

const sessionUserColumns = {
  id: schema.user.id,
  name: schema.user.name,
  email: schema.user.email,
  emailVerified: schema.user.emailVerified,
  image: schema.user.image,
  role: schema.user.role,
  phone: schema.user.phone,
  birthdate: schema.user.birthdate,
  notes: schema.user.notes,
  enabled: schema.user.enabled,
  createdAt: schema.user.createdAt,
  updatedAt: schema.user.updatedAt,
}

async function findSessionUser(payload: IdTokenPayload) {
  const [row] = await getDb()
    .select({ ...sessionUserColumns, sessionsRevokedAt: schema.user.sessionsRevokedAt })
    .from(schema.user)
    .where(eq(schema.user.cognitoId, payload.sub))
    .limit(1)

  if (row == null || row.enabled === false) return null

  // `auth_time` es cuando la persona escribió su contraseña y no cambia al
  // renovar el token, así que también corta las sesiones ya renovadas.
  const { sessionsRevokedAt, ...user } = row
  if (
    sessionsRevokedAt != null &&
    payload.auth_time < Math.floor(sessionsRevokedAt.getTime() / 1000)
  ) {
    return null
  }
  return user
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof findSessionUser>>>
export type Session = {
  user: SessionUser
  session: { userId: string; expiresAt: Date }
}

// Una verificación por token y por request, aunque layout, página y acciones
// pidan la sesión cada uno.
const loadSession = cache(async (idToken: string): Promise<Session | null> => {
  let payload: IdTokenPayload
  try {
    payload = await verifyCognitoIdToken(idToken)
  } catch {
    return null
  }

  const user = await findSessionUser(payload)
  if (user == null) return null
  return { user, session: { userId: user.id, expiresAt: new Date(payload.exp * 1000) } }
})

/**
 * Sesión del panel. Null si no hay token, si no es válido o ya venció
 * (proxy.ts lo renueva antes de llegar aquí), si la cuenta está inhabilitada
 * o si sus sesiones se revocaron después de que entró.
 */
export async function getSession(): Promise<Session | null> {
  const idToken = (await cookies()).get(ID_TOKEN_COOKIE)?.value
  if (idToken == null || idToken === "") return null
  return loadSession(idToken)
}

type LoginCheck = { ok: true } | { ok: false; message: string }

/**
 * Reglas para abrir sesión con una cuenta de Cognito ya autenticada: el
 * usuario del estudio existe, no está inhabilitado y su `cognito_id` es el
 * `sub` del token.
 */
export async function checkLoginUser(userId: string, payload: IdTokenPayload): Promise<LoginCheck> {
  const [row] = await getDb()
    .select({ enabled: schema.user.enabled, cognitoId: schema.user.cognitoId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (row == null) return { ok: false, message: "Cuenta no encontrada" }
  if (row.enabled === false) return { ok: false, message: ACCOUNT_DISABLED_MESSAGE }
  if (row.cognitoId !== payload.sub) {
    return { ok: false, message: "La cuenta de Cognito no es de este usuario" }
  }
  return { ok: true }
}

/** Sólo desde una server action o route handler: escribe cookies. */
export async function startSession(tokens: CognitoTokens): Promise<void> {
  const jar = await cookies()
  jar.set(ID_TOKEN_COOKIE, tokens.idToken, sessionCookieOptions())
  if (tokens.refreshToken != null) {
    jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, sessionCookieOptions())
  }
}

/** Sólo desde una server action o route handler: escribe cookies. */
export async function endSession(): Promise<void> {
  const jar = await cookies()
  const refreshToken = jar.get(REFRESH_TOKEN_COOKIE)?.value
  if (refreshToken != null && refreshToken !== "") {
    await revokeRefreshToken(refreshToken)
  }
  jar.delete(ID_TOKEN_COOKIE)
  jar.delete(REFRESH_TOKEN_COOKIE)
}
