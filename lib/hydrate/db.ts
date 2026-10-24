import "server-only"

import * as hydrateSchema from "./schema"

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Conexion de solo lectura a la base `appddata`, que es donde vive `hydrate`.
 *
 * Es una conexion aparte de la de la app a proposito. `hydrate` NO esta en la
 * base `pilates-reformer`: la tabla la posee y la migra appddata, y los sitios
 * hijos solo la leen (mismo trato que refautomex, ver su lib/hydrate/db.js).
 * Usar `getDb()` para esto apunta a la base equivocada y la consulta falla con
 * "relation hydrate does not exist".
 *
 * La URL sale de `APPSTRACT_DATABASE_URL` -nombre historico, la infraestructura
 * la inyecta desde `cross_reads` en postgres.tf- y nunca de `DATABASE_URL`, que
 * es la de la base propia. Sin esa variable no hay conexion y el sitio se queda
 * con `fallback.pilates-reformer.json`, que es el comportamiento correcto en
 * desarrollo local.
 */

export type HydrateDb = PostgresJsDatabase<typeof hydrateSchema>

// Sin esto, cada request reintenta la conexion cuando la base no responde.
const RETRY_INTERVAL_MS = 30_000

let cached: HydrateDb | null = null
let lastAttemptAt = 0

export function getHydrateDatabaseUrl(): string | undefined {
  return process.env.APPSTRACT_DATABASE_URL || undefined
}

export function isHydratePg(): boolean {
  if (process.env.HYDRATE_DB_DRIVER === "sqlite") return false
  const url = getHydrateDatabaseUrl() ?? ""
  return url.startsWith("postgres://") || url.startsWith("postgresql://")
}

/**
 * Devuelve `null` -y no lanza- cuando no hay base: quien llama ya sabe caer al
 * JSON de respaldo, y un sitio de textos no debe tumbarse porque Postgres no
 * conteste.
 */
export function getHydrateDb(): HydrateDb | null {
  if (cached) return cached
  if (!isHydratePg()) return null

  const now = Date.now()
  if (lastAttemptAt && now - lastAttemptAt < RETRY_INTERVAL_MS) return null
  lastAttemptAt = now

  try {
    const { drizzle } = require("drizzle-orm/postgres-js")
    const postgres = require("postgres")

    // max bajo: aqui solo se leen textos, no hace falta un pool grande.
    const client = postgres(getHydrateDatabaseUrl()!, { max: 3, connect_timeout: 10 })
    cached = drizzle(client, { schema: hydrateSchema })
    return cached
  } catch (error) {
    console.info("Base de hidratacion no disponible; se usara el fallback local.", error)
    return null
  }
}
