import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { refreshCognitoSession, type CognitoTokens } from "@/lib/cognito"
import {
  ID_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  decodeJwtPayload,
  sessionCookieOptions,
} from "@/lib/session-cookies"

// Se renueva un poco antes de que venza para que no caduque a media página.
const REFRESH_MARGIN_MS = 60 * 1000

type Refresh = { kind: "keep" } | { kind: "clear" } | { kind: "renew"; tokens: CognitoTokens }

async function refreshSession(request: NextRequest): Promise<Refresh> {
  const idToken = request.cookies.get(ID_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (!idToken || !refreshToken) return { kind: "keep" }

  const payload = decodeJwtPayload(idToken)
  const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : 0
  if (exp - Date.now() > REFRESH_MARGIN_MS) return { kind: "keep" }

  const username = payload?.["cognito:username"]
  if (typeof username !== "string" || username === "") return { kind: "clear" }

  try {
    const tokens = await refreshCognitoSession(refreshToken, username)
    return tokens == null ? { kind: "clear" } : { kind: "renew", tokens }
  } catch (e) {
    // Cognito no contestó: la página verá la sesión vencida, pero las cookies
    // se quedan para reintentar en la siguiente petición.
    console.error("[proxy] No se pudo renovar la sesión:", e)
    return { kind: "keep" }
  }
}

/**
 * Next 16 reemplazó la convención `middleware` por `proxy`; el handler debe
 * llamarse `proxy` o el archivo no se ejecuta.
 *
 * Hace dos cosas antes de cada página, acción o API:
 * - renueva el ID token de Cognito con el refresh token cuando está por
 *   vencer. Las páginas no pueden escribir cookies, así que el token nuevo se
 *   pone en la petición (para lib/session.ts) y en la respuesta (para el
 *   navegador);
 * - pasa `x-dashboard-pathname`, que lee app/dashboard/layout.tsx para decidir
 *   si el rol tiene permiso sobre la ruta: si deja de llegar, el guard usa la
 *   ruta por defecto y redirige mal.
 */
export async function proxy(request: NextRequest) {
  const refresh = await refreshSession(request)

  // request.cookies escribe sobre el header `cookie` de la petición.
  if (refresh.kind === "clear") {
    request.cookies.delete(ID_TOKEN_COOKIE)
    request.cookies.delete(REFRESH_TOKEN_COOKIE)
  } else if (refresh.kind === "renew") {
    request.cookies.set(ID_TOKEN_COOKIE, refresh.tokens.idToken)
    if (refresh.tokens.refreshToken != null) {
      request.cookies.set(REFRESH_TOKEN_COOKIE, refresh.tokens.refreshToken)
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-dashboard-pathname", request.nextUrl.pathname)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (refresh.kind === "clear") {
    response.cookies.delete(ID_TOKEN_COOKIE)
    response.cookies.delete(REFRESH_TOKEN_COOKIE)
  } else if (refresh.kind === "renew") {
    response.cookies.set(ID_TOKEN_COOKIE, refresh.tokens.idToken, sessionCookieOptions())
    if (refresh.tokens.refreshToken != null) {
      response.cookies.set(REFRESH_TOKEN_COOKIE, refresh.tokens.refreshToken, sessionCookieOptions())
    }
  }

  return response
}

export const config = {
  // Todo menos archivos estáticos: la sesión se lee en el sitio público
  // (/, /agendar), en /login, en el panel, en las server actions y en /api.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|mp4|js|css|map|txt|xml|json)$).*)",
  ],
}
