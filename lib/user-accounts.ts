import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { EmailTakenError, signUpCognitoUser } from "@/lib/cognito"

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// Mismo formato que los ids que generaba better-auth: 32 alfanuméricos.
function generateUserId(): string {
  return Array.from(randomBytes(32), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export type NewUserAccount = {
  name: string
  email: string
  password: string
  role: "alumno" | "coach" | "admin" | "root"
  phone?: string | null
  birthdate?: string | null
}

/**
 * Alta completa, como el sign-up de refautomex: SignUp en Cognito y fila en
 * `user` con el `sub` (UserSub) en `cognito_id`. La cuenta queda sin confirmar:
 * Cognito manda un código al correo y la persona lo escribe la primera vez que
 * entra (app/login).
 *
 * Lanza EmailTakenError si el correo ya es de alguien (en la base o en
 * Cognito) y CognitoPasswordError si la contraseña no pasa la política del
 * user pool.
 */
export async function createUserAccount(
  db: AnyDb,
  input: NewUserAccount,
): Promise<{ id: string }> {
  const email = normalizeEmail(input.email)

  const [taken] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)
  if (taken != null) throw new EmailTakenError()

  const { sub } = await signUpCognitoUser({ email, password: input.password })

  const id = generateUserId()
  try {
    await db.insert(schema.user).values({
      id,
      name: input.name.trim(),
      email,
      role: input.role,
      phone: input.phone ?? null,
      birthdate: input.birthdate ?? null,
      enabled: true,
      cognitoId: sub,
    })
  } catch (e) {
    // Sin APIs de admin no se puede deshacer el SignUp: la cuenta queda en
    // Cognito y ese correo no se podrá volver a registrar hasta borrarla allá.
    console.error(`[alta] La cuenta de Cognito de ${email} quedó sin fila en la base:`, e)
    throw e
  }
  return { id }
}
