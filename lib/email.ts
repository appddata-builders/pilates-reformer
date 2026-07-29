import "server-only"

import { Resend } from "resend"

const DEFAULT_FROM = "Studio <onboarding@resend.dev>"

function readEnv(name: string): string | null {
  const raw = process.env[name]
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed === "" ? null : trimmed
}

export function isEmailConfigured(): boolean {
  return readEnv("RESEND_API_KEY") != null
}

/**
 * Remitente del correo. Debe pertenecer a un dominio verificado en Resend;
 * sin configurarlo se usa el remitente de pruebas, que sólo entrega al correo
 * dueño de la cuenta de Resend.
 */
export function getEmailFrom(): string {
  return readEnv("RESEND_FROM") ?? readEnv("RESEND_FROM_EMAIL") ?? DEFAULT_FROM
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string }

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendEmailResult> {
  const apiKey = readEnv("RESEND_API_KEY")
  if (apiKey == null) {
    return { ok: false, error: "Resend no está configurado (falta RESEND_API_KEY)" }
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })

    if (error != null) {
      return { ok: false, error: `${error.name}: ${error.message}` }
    }
    if (data == null) {
      return { ok: false, error: "Resend no devolvió un identificador de envío" }
    }

    return { ok: true, id: data.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red"
    return { ok: false, error: `No se pudo contactar a Resend: ${msg}` }
  }
}
