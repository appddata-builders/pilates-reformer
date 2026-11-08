export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageModule } from "@/lib/staff-access.server"
import { CalendarShell } from "./calendar-shell"

/** Los eventos los pide el cliente según el rango que tiene a la vista. */
export default async function CalendarioPage() {
  const session = await getSession()
  if (session == null) redirect("/login")

  const role = session.user.role
  if (role !== "admin" && role !== "root" && role !== "coach") redirect("/dashboard")

  const canManage = await canManageModule(role, "calendario")

  return <CalendarShell canManage={canManage} />
}
