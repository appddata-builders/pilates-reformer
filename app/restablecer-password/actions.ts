"use server"

import { newPasswordSchema, resetPasswordWithCode } from "@/lib/password-reset"

export type ResetPasswordState = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = formData.get("email")
  const code = formData.get("code")
  const password = formData.get("password")
  const confirmPassword = formData.get("confirmPassword")
  if (
    typeof email !== "string" ||
    typeof code !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { success: false, error: "Datos incompletos" }
  }

  if (email.trim() === "") {
    return { success: false, fieldErrors: { email: ["Escribe tu correo"] } }
  }

  const cleanCode = code.replace(/\s+/g, "")
  if (cleanCode === "") {
    return { success: false, fieldErrors: { code: ["Escribe el código que te llegó por correo"] } }
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
    const result = await resetPasswordWithCode(email, cleanCode, password)
    if (result.ok) return { success: true }
    if (result.field != null) {
      return { success: false, fieldErrors: { [result.field]: [result.error] } }
    }
    return { success: false, error: result.error }
  } catch (e) {
    console.error("[password-reset] Falló el cambio de contraseña:", e)
    return { success: false, error: "Problemas de conexión. Vuelva a intentar más tarde." }
  }
}
