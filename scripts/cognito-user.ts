/**
 * Da de alta una cuenta en Cognito y en la base, en un solo paso, igual que
 * el panel. Sirve para la primera cuenta root: las demás se crean desde el
 * panel (Usuarios, Coaches) o en /registry.
 *
 * Uso:
 *   npx tsx --env-file=<archivo> scripts/cognito-user.ts \
 *     --email root@estudio.mx --password 'xxxxxx' --name "Root" --role root
 *
 * Necesita la base (DATABASE_URL, o DB_DRIVER=sqlite para local.db),
 * NEXT_PUBLIC_USER_POOL_ID, NEXT_PUBLIC_CLIENT_ID y credenciales IAM
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 */

import { parseArgs } from "node:util"
import { getDb } from "@/lib/db"
import { createUserAccount, normalizeEmail } from "@/lib/user-accounts"

const ROLES = ["root", "admin", "coach", "alumno"] as const

function fail(message: string): never {
  console.error(message)
  console.error(
    "Uso: scripts/cognito-user.ts --email <correo> --password <contraseña> [--name <nombre>] [--role root|admin|coach|alumno]",
  )
  process.exit(1)
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "alumno" },
    },
  })

  const email = normalizeEmail(values.email ?? "")
  const password = values.password ?? ""
  if (!email.includes("@")) fail("Falta --email")
  if (password === "") fail("Falta --password")
  const role = ROLES.find((r) => r === values.role) ?? fail(`Rol inválido: ${values.role}`)

  const { id } = await createUserAccount(getDb(), {
    name: values.name?.trim() || email,
    email,
    password,
    role,
  })
  console.log(`>> Cuenta creada: ${email} (${role}) id=${id}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
