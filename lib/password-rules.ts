import { z } from "zod"

/**
 * Reglas de contraseña: las de la política por omisión de Cognito, las mismas
 * que revisa el registro de refautomex. Se validan en el formulario (para ver
 * qué falta mientras se escribe) y en el servidor, antes de llegar a Cognito.
 */

export const PASSWORD_MIN_LENGTH = 8

// Los símbolos que Cognito cuenta como especiales.
const SYMBOL = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`=+-]/

export type PasswordCheck = { key: string; label: string; ok: boolean }

export function checkPassword(password: string): PasswordCheck[] {
  return [
    { key: "length", label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { key: "upper", label: "Una mayúscula", ok: /[A-Z]/.test(password) },
    { key: "lower", label: "Una minúscula", ok: /[a-z]/.test(password) },
    { key: "number", label: "Un número", ok: /[0-9]/.test(password) },
    { key: "symbol", label: "Un símbolo (! @ # $ % & * …)", ok: SYMBOL.test(password) },
  ]
}

export function isPasswordValid(password: string): boolean {
  return checkPassword(password).every((check) => check.ok)
}

export const passwordSchema = z
  .string()
  .max(128, "Contraseña demasiado larga")
  .superRefine((value, ctx) => {
    const missing = checkPassword(value).filter((check) => !check.ok)
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le falta: ${missing.map((check) => check.label.toLowerCase()).join(", ")}`,
      })
    }
  })
