"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  resolveResetEmail,
} from "@/lib/password-reset"

export type ForgotPasswordState = {
  success: boolean
  message?: string
  error?: string
}

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const identifier = formData.get("identifier")
  if (typeof identifier !== "string" || identifier.trim() === "") {
    return { success: false, error: "Escribe tu correo o tu ID de usuario" }
  }

  try {
    const email = await resolveResetEmail(identifier)
    if (email != null) {
      await auth.api.requestPasswordReset({
        body: { email },
        headers: await headers(),
      })
    }
  } catch (e) {
    // No filtramos el detalle: el mensaje al usuario siempre es el mismo.
    console.error("[password-reset] Falló la solicitud:", e)
  }

  return { success: true, message: PASSWORD_RESET_GENERIC_MESSAGE }
}
