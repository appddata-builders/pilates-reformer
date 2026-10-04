import type { AnyDb, PgDb } from "@/lib/db"
import type Database from "better-sqlite3"

const sqliteTransactions = new Map<string | Database.Database, Promise<void>>()

/** SQLite needs its own connection because its transaction callback is synchronous. */
export async function withAsyncTransaction<T>(db: AnyDb, work: (tx: AnyDb) => Promise<T>): Promise<T> {
  const client = (db as unknown as { $client: Database.Database }).$client
  if (typeof client?.prepare !== "function") {
    return (db as unknown as PgDb).transaction((tx) => work(tx as unknown as AnyDb))
  }

  // In-memory databases are used by isolated tests. File databases get a
  // dedicated connection so unrelated requests cannot join this transaction.
  const queueKey = client.name && client.name !== ":memory:" ? client.name : client
  const previous = sqliteTransactions.get(queueKey) ?? Promise.resolve()
  let release!: () => void
  const completed = new Promise<void>((resolve) => { release = resolve })
  sqliteTransactions.set(queueKey, completed)
  await previous
  try {
    return await sqliteTransaction(db, client, work)
  } finally {
    release()
    if (sqliteTransactions.get(queueKey) === completed) sqliteTransactions.delete(queueKey)
  }
}

async function sqliteTransaction<T>(db: AnyDb, client: Database.Database, work: (tx: AnyDb) => Promise<T>): Promise<T> {
  const { default: SqliteDatabase } = await import("better-sqlite3")
  const { drizzle } = await import("drizzle-orm/better-sqlite3")
  const isolated = client.name !== ":memory:" && client.name !== ""
  const raw: Database.Database = isolated
    ? new SqliteDatabase(client.name)
    : client
  const tx: AnyDb = isolated ? drizzle(raw) : db
  try {
    raw.pragma("foreign_keys = ON")
    raw.exec("BEGIN IMMEDIATE")
    try {
      const result = await work(tx)
      raw.exec("COMMIT")
      return result
    } catch (error) {
      raw.exec("ROLLBACK")
      throw error
    }
  } finally {
    if (isolated) raw.close()
  }
}
