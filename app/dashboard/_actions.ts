"use server"

import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function markWelcomeShownAction(): Promise<void> {
  const session = await getSession()
  if (!session) return

  const db = getDb()
  await db
    .update(schema.user)
    .set({ welcomeShown: true })
    .where(eq(schema.user.id, session.user.id))
}
