/**
 * Vacía los datos de la base (mantiene el esquema) solo en entornos de prueba.
 *
 * Requisitos obligatorios:
 *   ALLOW_DB_RESET=1
 *   DB_RESET_CONFIRM=<nombre exacto de la base en la URL>
 *
 * Nunca se ejecuta contra producción:
 *   - Bloquea VERCEL_ENV=production y NODE_ENV=production
 *   - Bloquea hosts/nombres de BD de producción conocidos
 *   - Exige que el nombre de BD coincida con DB_RESET_CONFIRM
 *
 * Uso:
 *   ALLOW_DB_RESET=1 DB_RESET_CONFIRM=pilates_demo npm run db:pg:reset
 *   ALLOW_DB_RESET=1 DB_RESET_CONFIRM=pilates_demo npm run db:pg:reset -- --seed
 *   ALLOW_DB_RESET=1 DB_RESET_CONFIRM=local.db npm run db:reset:local
 */

import { existsSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

const BLOCKED_HOSTS = new Set([
  "159.203.90.92",
])

const BLOCKED_DB_NAMES = new Set([
  "pilates",
  "production",
  "prod",
  "main",
])

const PG_TABLES = [
  "notification",
  "studio_event",
  "studio_kpi_snapshot",
  "coach_payroll_period",
  "sale_item",
  "payment",
  "booking",
  "subscription",
  "schedule_slot_exception",
  "schedule_slot",
  "reformer",
  "coupon",
  "plan",
  "studio_policy",
  "session",
  "account",
  "verification",
  "user",
] as const

type ParsedDbUrl = {
  host: string
  database: string
  hrefSafe: string
}

function parseArgs(argv: string[]) {
  return {
    seed: argv.includes("--seed"),
  }
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function parseDatabaseUrl(urlRaw: string): ParsedDbUrl {
  let parsed: URL
  try {
    parsed = new URL(urlRaw)
  } catch {
    fail("DATABASE_URL no es una URL válida")
  }

  const protocol = parsed.protocol.replace(/:$/, "")
  if (protocol !== "postgres" && protocol !== "postgresql") {
    fail("Solo se admite PostgreSQL en db:pg:reset (usa db:reset:local para SQLite)")
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim()
  if (!database) {
    fail("No se pudo leer el nombre de la base desde DATABASE_URL")
  }

  const host = (parsed.hostname || "").toLowerCase()
  const hrefSafe = `${protocol}://${host}${parsed.port ? `:${parsed.port}` : ""}/${database}`

  return { host, database, hrefSafe }
}

function assertResetAllowed(target: { kind: "pg"; parsed: ParsedDbUrl } | { kind: "sqlite"; file: string }) {
  if (process.env.ALLOW_DB_RESET !== "1") {
    fail("Falta ALLOW_DB_RESET=1. El vaciado está desactivado por defecto.")
  }

  if (process.env.VERCEL_ENV === "production") {
    fail("Bloqueado: VERCEL_ENV=production")
  }

  if (process.env.NODE_ENV === "production") {
    fail("Bloqueado: NODE_ENV=production")
  }

  const confirm = (process.env.DB_RESET_CONFIRM ?? "").trim()
  if (!confirm) {
    fail("Falta DB_RESET_CONFIRM con el nombre exacto de la base (o local.db en SQLite).")
  }

  if (target.kind === "pg") {
    const { host, database } = target.parsed

    if (confirm !== database) {
      fail(
        `DB_RESET_CONFIRM ("${confirm}") no coincide con la base de la URL ("${database}").`,
      )
    }

    if (BLOCKED_DB_NAMES.has(database.toLowerCase())) {
      fail(
        `La base "${database}" está bloqueada como producción. Usa una BD de prueba (ej. pilates_demo, pilates_test).`,
      )
    }

    if (BLOCKED_HOSTS.has(host)) {
      const looksLikeTest =
        /(_test|_demo|_staging|_dev)$/i.test(database) ||
        /^(test|demo|staging|dev)_/i.test(database)
      if (!looksLikeTest) {
        fail(
          `Host ${host} está marcado como producción/staging. Solo se permite vaciar si el nombre de BD termina en _test, _demo, _staging o _dev.`,
        )
      }
    }

    return
  }

  if (confirm !== "local.db" && confirm !== target.file) {
    fail(
      `Para SQLite usa DB_RESET_CONFIRM=local.db (recibido: "${confirm}").`,
    )
  }
}

async function resetPostgres(url: string, seed: boolean) {
  const parsed = parseDatabaseUrl(url)
  assertResetAllowed({ kind: "pg", parsed })

  console.log(`Vaciando PostgreSQL: ${parsed.hrefSafe}`)
  const sql = postgres(url, { max: 1 })

  try {
    const tableList = PG_TABLES.map((t) => `"${t}"`).join(", ")
    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
    console.log(`Tablas vaciadas: ${PG_TABLES.length}`)

    if (seed) {
      console.log("Cargando seed de prueba...")
      const { readFileSync } = await import("node:fs")
      const seedPath = resolve(process.cwd(), "scripts/postgres-manual/03-seed-fake.sql")
      const seedSql = readFileSync(seedPath, "utf8")
      await sql.unsafe(seedSql)
      console.log("Seed aplicado.")
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function resetSqlite(seed: boolean) {
  const file = resolve(process.cwd(), "local.db")
  assertResetAllowed({ kind: "sqlite", file: "local.db" })

  if (existsSync(file)) {
    unlinkSync(file)
    console.log("Eliminado local.db")
  } else {
    console.log("local.db no existía; nada que borrar.")
  }

  if (seed) {
    console.log("Para SQLite vuelve a crear el esquema con: npm run db:push:local")
    console.log("(El seed SQL de demo es solo PostgreSQL.)")
  }
}

async function main() {
  const { seed } = parseArgs(process.argv.slice(2))
  const driver = (process.env.DB_DRIVER ?? "").toLowerCase()
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

  if (driver === "sqlite" || process.argv.includes("--sqlite")) {
    resetSqlite(seed)
    console.log("Listo.")
    return
  }

  if (!url) {
    fail("Falta DATABASE_URL o DATABASE_URL_UNPOOLED en el entorno.")
  }

  await resetPostgres(url, seed)
  console.log("Listo.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
