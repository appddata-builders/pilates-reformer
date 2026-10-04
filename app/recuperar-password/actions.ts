"use server"

import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  requestPasswordReset,
} from "@/lib/password-reset"

export type ForgotPasswordState = {
  success: boolean
  message?: string
  error?: string
  email?: string
}

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = formData.get("email")
  if (typeof email !== "string" || email.trim() === "") {
    return { success: false, error: "Escribe tu correo" }
  }

  try {
    await requestPasswordReset(email)
  } catch (e) {
    // No filtramos el detalle: el mensaje al usuario siempre es el mismo.
    console.error("[password-reset] Falló la solicitud:", e)
  }

  return {
    success: true,
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    email: email.trim(),
  }
}
