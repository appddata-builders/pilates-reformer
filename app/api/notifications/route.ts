import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ unreadCount: 0, items: [] })

    const db = getDb()
    const items = await db
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.userId, session.user.id))
      .orderBy(desc(schema.notification.createdAt))
      .limit(20)

    const unreadCount = items.filter((n) => !n.isRead).length
    return NextResponse.json({
      unreadCount,
      items: items.map((n) => ({
        ...n,
        createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt as unknown as number)).toISOString(),
      })),
    })
  } catch {
    return NextResponse.json({ unreadCount: 0, items: [] })
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ ok: false })

    const db = getDb()
    await db
      .update(schema.notification)
      .set({ isRead: true })
      .where(eq(schema.notification.userId, session.user.id))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
