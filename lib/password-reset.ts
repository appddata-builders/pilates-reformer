import "server-only"

import { z } from "zod"
import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { buildAppUrl } from "@/lib/app-url"
import { isEmailConfigured, sendEmail } from "@/lib/email"
import { routes } from "@/lib/routes"
import { findUserByDisplayId } from "@/lib/booking-service"
import { getStudioBranding } from "@/lib/studio-branding"

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = PASSWORD_RESET_TOKEN_TTL_SECONDS / 60

// Respuesta única para cualquier identificador: no revelamos si la cuenta existe.
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "Si la cuenta existe, te enviamos un correo con el enlace para cambiar tu contraseña. Revisa también la carpeta de spam."

export const PASSWORD_RESET_INVALID_TOKEN_MESSAGE =
  "El enlace ya no es válido o expiró. Solicita uno nuevo."

export const newPasswordSchema = z
  .string()
  .min(8, "Contraseña mínimo 8 caracteres")
  .max(128, "Contraseña demasiado larga")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Usa letras y números",
  })

export function buildPasswordResetUrl(token: string): string {
  return buildAppUrl(routes.restablecerPassword, { token })
}

/**
 * Resuelve el correo a partir de un correo o de un ID de usuario (ST0001),
 * igual que el login. Devuelve null si no aplica enviar el correo.
 */
export async function resolveResetEmail(identifierRaw: string): Promise<string | null> {
  const raw = identifierRaw.trim()
  if (raw === "") return null

  const db = getDb()

  if (raw.includes("@")) {
    const [row] = await db
      .select({ email: schema.user.email, enabled: schema.user.enabled })
      .from(schema.user)
      .where(eq(schema.user.email, raw.toLowerCase()))
      .limit(1)
    if (row == null || row.enabled === false) return null
    return row.email.trim()
  }

  const byDisplayId = await findUserByDisplayId(db, raw)
  if (byDisplayId == null) return null

  const [row] = await db
    .select({ email: schema.user.email, enabled: schema.user.enabled })
    .from(schema.user)
    .where(eq(schema.user.id, byDisplayId.id))
    .limit(1)

  if (row == null || row.enabled === false) return null
  return row.email.trim()
}

/** Revisa el token sin consumirlo, para no mostrar el formulario de un enlace muerto. */
export async function isPasswordResetTokenUsable(token: string): Promise<boolean> {
  const trimmed = token.trim()
  if (trimmed === "") return false

  const db = getDb()
  const [row] = await db
    .select({ id: schema.verification.id })
    .from(schema.verification)
    .where(
      and(
        eq(schema.verification.identifier, `reset-password:${trimmed}`),
        gt(schema.verification.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return row != null
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildPasswordResetEmail(params: {
  name: string
  resetUrl: string
  studioName: string
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(params.name)
  const studioName = escapeHtml(params.studioName)
  const url = escapeHtml(params.resetUrl)
  const minutes = PASSWORD_RESET_TOKEN_TTL_MINUTES

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;">Cambia tu contraseña</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4a4a4a;">
          Hola ${name}, recibimos una solicitud para cambiar la contraseña de tu cuenta en ${studioName}.
        </p>
        <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:500;">
          Crear nueva contraseña
        </a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6a6a6a;">
          El enlace vence en ${minutes} minutos y sólo se puede usar una vez.
          Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.
        </p>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;word-break:break-all;">
          Si el botón no funciona, copia esta dirección en tu navegador:<br>${url}
        </p>
      </td></tr>
    </table>
  </body>
</html>`

  const text = [
    `Hola ${params.name},`,
    "",
    `Recibimos una solicitud para cambiar la contraseña de tu cuenta en ${params.studioName}.`,
    "",
    `Abre esta dirección para crear una nueva: ${params.resetUrl}`,
    "",
    `El enlace vence en ${minutes} minutos y sólo se puede usar una vez.`,
    "Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.",
  ].join("\n")

  return { subject: `Cambia tu contraseña de ${params.studioName}`, html, text }
}

export async function sendPasswordResetEmail(params: {
  email: string
  name: string
  token: string
}): Promise<void> {
  const resetUrl = buildPasswordResetUrl(params.token)

  if (!isEmailConfigured()) {
    console.warn("[password-reset] Falta RESEND_API_KEY; enlace no enviado:", resetUrl)
    return
  }

  const branding = await getStudioBranding()
  const message = buildPasswordResetEmail({
    name: params.name,
    resetUrl,
    studioName: branding.studioName,
  })

  const result = await sendEmail({ to: params.email, ...message })

  if (!result.ok) {
    console.error("[password-reset] No se pudo enviar el correo:", result.error)
    console.warn("[password-reset] Enlace generado:", resetUrl)
  }
}
