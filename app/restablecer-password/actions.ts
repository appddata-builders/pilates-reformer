"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
  newPasswordSchema,
} from "@/lib/password-reset"

export type ResetPasswordState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = formData.get("token")
  if (typeof token !== "string" || token.trim() === "") {
    return { success: false, error: PASSWORD_RESET_INVALID_TOKEN_MESSAGE }
  }

  const password = formData.get("password")
  const confirmPassword = formData.get("confirmPassword")
  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { success: false, error: "Datos incompletos" }
  }

  const parsed = newPasswordSchema.safeParse(password)
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: { password: parsed.error.issues.map((issue) => issue.message) },
    }
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      fieldErrors: { confirmPassword: ["Las contraseñas no coinciden"] },
    }
  }

  try {
    await auth.api.resetPassword({
      body: { token: token.trim(), newPassword: password },
      headers: await headers(),
    })
    return { success: true }
  } catch (e) {
    console.error("[password-reset] Falló el cambio de contraseña:", e)
    return { success: false, error: PASSWORD_RESET_INVALID_TOKEN_MESSAGE }
  }
}
