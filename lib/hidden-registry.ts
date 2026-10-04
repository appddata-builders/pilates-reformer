import { z } from "zod"
import { passwordSchema } from "@/lib/password-rules"

export const WELCOME_POLICY_PDF_PATH = "/assets/docs/pilates-reformer-welcome-policy-001.pdf"
export const WELCOME_POLICY_PDF_FILENAME = "pilates-reformer-welcome-policy-001.pdf"

export function isRegistryPolicyComplete(formData: FormData): boolean {
  const downloaded = formData.get("policyDownloaded")
  const accepted = formData.get("policyAccepted")
  return downloaded === "true" && accepted === "true"
}

export function isHiddenRegistryEnabled(): boolean {
  return process.env.HIDDEN_REGISTRY_ENABLED === "true"
}

export function isRegistryTokenValid(tokenFromQuery: string | undefined): boolean {
  const expected = process.env.HIDDEN_REGISTRY_TOKEN?.trim() ?? ""
  if (expected === "") return true
  if (tokenFromQuery == null || tokenFromQuery.trim() === "") return false
  return tokenFromQuery.trim() === expected
}

export function canAccessHiddenRegistry(tokenFromQuery: string | undefined): boolean {
  if (!isHiddenRegistryEnabled()) return false
  return isRegistryTokenValid(tokenFromQuery)
}

const controlChars = /[\u0000-\u001f\u007f]/g

export function sanitizePersonName(raw: string): string {
  return raw
    .replace(controlChars, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120)
}

export function sanitizeEmail(raw: string): string {
  return raw.replace(controlChars, "").trim().toLowerCase().slice(0, 254)
}

export function sanitizePhone(raw: string | undefined): string | null {
  if (raw == null) return null
  const cleaned = raw.replace(controlChars, "").trim()
  if (cleaned === "") return null
  const digits = cleaned.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

export const hiddenRegistrySchema = z.object({
  name: z
    .string()
    .min(2, "Nombre demasiado corto")
    .max(120, "Nombre demasiado largo")
    .refine((v) => sanitizePersonName(v).length >= 2, "Nombre inválido"),
  email: z.string().email("Correo inválido").max(254),
  password: passwordSchema,
  phone: z.string().max(32).optional(),
  birthdate: z.string().max(32).optional(),
  company: z.string().max(200).optional(),
})

export type HiddenRegistryInput = z.infer<typeof hiddenRegistrySchema>
