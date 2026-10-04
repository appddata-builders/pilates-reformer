import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import type { AnyDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import {
  EmailTakenError,
  createCognitoUser,
  deleteCognitoUser,
  findCognitoSub,
  setCognitoPassword,
  updateCognitoUser,
} from "@/lib/cognito"

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
 * Alta completa: cuenta en Cognito con su contraseña y fila en `user` ligada
 * por `cognito_id`. Antes lo hacía better-auth (signUpEmail), que guardaba la
 * contraseña en la tabla `account`.
 *
 * Lanza EmailTakenError si el correo ya es de alguien y CognitoPasswordError
 * si la contraseña no pasa la política del user pool.
 */
export async function createUserAccount(
  db: AnyDb,
  input: NewUserAccount,
): Promise<{ id: string }> {
  const email = normalizeEmail(input.email)
  const name = input.name.trim()

  // Antes de tocar Cognito: con el correo de otro usuario, el paso de abajo
  // le cambiaría la contraseña.
  const [taken] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)
  if (taken != null) throw new EmailTakenError()

  let sub = await findCognitoSub(email)
  const created = sub == null
  if (sub == null) {
    sub = await createCognitoUser({ email, name })
  } else {
    // Cuenta huérfana: el usuario se borró de la base pero no de Cognito. Se
    // reutiliza sólo si nadie la tiene ligada.
    const [linked] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.cognitoId, sub))
      .limit(1)
    if (linked != null) throw new EmailTakenError()
    await updateCognitoUser(sub, { email, name })
  }

  try {
    await setCognitoPassword(sub, input.password)

    const id = generateUserId()
    await db.insert(schema.user).values({
      id,
      name,
      email,
      emailVerified: true,
      role: input.role,
      phone: input.phone ?? null,
      birthdate: input.birthdate ?? null,
      enabled: true,
      cognitoId: sub,
    })
    return { id }
  } catch (e) {
    // Sin la fila en la base la cuenta no sirve para entrar.
    if (created) await deleteCognitoUser(sub)
    throw e
  }
}
