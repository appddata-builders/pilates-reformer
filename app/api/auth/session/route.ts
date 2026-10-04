import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

// Lo que necesita el cliente (lib/auth-client.ts). Notas, teléfono y
// cumpleaños se quedan en el servidor.
export async function GET() {
  const session = await getSession()
  if (session == null) return NextResponse.json(null)

  const { id, name, email, role, enabled, image } = session.user
  return NextResponse.json({ user: { id, name, email, role, enabled, image } })
}
