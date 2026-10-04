import { interpolateMessage } from "@/lib/messages"
import { DEFAULT_STUDIO_NAME } from "@/lib/studio-branding"

export const DEFAULT_WELCOME_TEMPLATE = `Te damos la bienvenida, {{nombre}}.

Para entrar al panel y reservar usa tu correo y tu contraseña.

Qué traer a clase:
• Botella con agua
• Calcetas antiderrapantes
• Toalla

Políticas de cancelación:
• Clase matutina (antes de mediodía): aviso antes de las 9:00 PM del día anterior.
• Clase vespertina: aviso con al menos 3 horas de anticipación.

Importante: los planes son mensuales y las clases no son acumulables.

¡Nos vemos en el estudio!`

export function buildWelcomeMessage(params: {
  nombre: string
  estudio?: string
  plan?: string
  template?: string | null
}): string {
  const estudio = params.estudio?.trim() || DEFAULT_STUDIO_NAME
  const base = params.template?.trim() ? params.template : DEFAULT_WELCOME_TEMPLATE
  return interpolateMessage(base, {
    nombre: params.nombre,
    plan: params.plan ?? "Sin plan asignado",
    estudio,
    fecha: new Date().toLocaleDateString("es-MX"),
  })
}

export function buildWelcomeWhatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const normalized = digits.startsWith("52") ? digits : `52${digits}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export async function sendWelcomeNotification(params: {
  userId: string
  nombre: string
  phone?: string | null
  template?: string | null
  estudio?: string
}): Promise<{ body: string; whatsappUrl: string | null }> {
  const { getDb } = await import("@/lib/db")
  const { createNotification } = await import("@/lib/notifications")
  const db = getDb()

  const estudio = params.estudio?.trim() || DEFAULT_STUDIO_NAME
  const body = buildWelcomeMessage({
    nombre: params.nombre,
    estudio,
    template: params.template,
  })

  await createNotification(db, {
    userId: params.userId,
    type: "welcome",
    title: `Te damos la bienvenida a ${estudio}`,
    body,
  })

  const whatsappUrl =
    params.phone != null && params.phone !== ""
      ? buildWelcomeWhatsAppUrl(params.phone, body)
      : null

  if (whatsappUrl != null) {
    console.log("[welcome] WhatsApp listo:", whatsappUrl)
  }

  return { body, whatsappUrl }
}
