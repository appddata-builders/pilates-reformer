/**
 * La sesión del panel son los tokens de Cognito en cookies httpOnly: el
 * navegador no los lee (refautomex los guarda en localStorage porque revisa
 * la sesión en el cliente; aquí la revisa el servidor en cada página).
 *
 * Este módulo no toca next/headers: lo usa también proxy.ts.
 */

export const ID_TOKEN_COOKIE = "pilates.id_token"
export const REFRESH_TOKEN_COOKIE = "pilates.refresh_token"

// Lo que dura el refresh token del app client (30 días por omisión en
// Cognito). El ID token vence antes (1 h) y proxy.ts lo renueva.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

/**
 * Lee el payload sin verificar la firma. Sólo para decidir cuándo renovar y
 * con qué username: la verificación de verdad está en lib/session.ts.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1]
  if (part == null || part === "") return null
  try {
    const json = Buffer.from(part, "base64url").toString("utf8")
    const payload: unknown = JSON.parse(json)
    return payload != null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
