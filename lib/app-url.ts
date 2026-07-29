const DEFAULT_APP_URL = "http://localhost:3000"

function normalizeOrigin(value: string | undefined): string | null {
  if (value == null) return null
  const raw = value.trim()
  if (raw === "") return null
  try {
    const url =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(`https://${raw}`)
    return url.origin
  } catch {
    return null
  }
}

// Origen público de la app, para armar enlaces absolutos que se envían por correo.
export function getAppBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.SITE_URL,
    process.env.URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate)
    if (origin != null) return origin
  }

  return DEFAULT_APP_URL
}

export function buildAppUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(path, `${getAppBaseUrl()}/`)
  if (query != null) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}
