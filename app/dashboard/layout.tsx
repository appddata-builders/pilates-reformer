export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/shared/ui/sidebar"
import { AppSidebar } from "@/components/features/admin/app-sidebar"
import { Navbar } from "@/components/features/admin/navbar"
import { DashboardProviders } from "@/components/features/admin/dashboard-providers"
import { auth } from "@/lib/auth"
import { loadNavPermissions } from "@/lib/nav-permissions.server"
import {
  canAccessDashboardPath,
  getFirstAllowedDashboardUrl,
  hasNoNavAccess,
} from "@/lib/nav-permissions"
import { routes } from "@/lib/routes"
import { NoAccessPanel } from "@/components/features/admin/no-access-panel"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { WelcomeModal } from "./_welcome-modal"
import { sendTodayBirthdayNotifications } from "@/lib/birthday-notifications"
import { getStudioBranding } from "@/lib/studio-branding"
import { DashboardReadyGate } from "@/components/features/admin/dashboard-ready-gate"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
    query: { disableRefresh: true },
  })
  if (session == null) {
    redirect("/login")
  }

  const u = session.user as {
    name?: string
    firstName?: string | null
    lastName?: string | null
    email?: string
    role?: string
    enabled?: boolean
  }

  if (u.enabled === false) {
    redirect("/login?inhabilitado=1")
  }
  const fn = typeof u.firstName === "string" ? u.firstName.trim() : ""
  const ln = typeof u.lastName === "string" ? u.lastName.trim() : ""
  const fromParts = `${fn} ${ln}`.trim()
  const navName =
    fromParts !== ""
      ? fromParts
      : u != null && typeof u.name === "string" && u.name !== ""
        ? u.name
        : "User"
  const navEmail =
    u != null && typeof u.email === "string" && u.email !== "" ? u.email : ""
  const role = typeof u.role === "string" ? u.role : "alumno"
  const isAlumno = role !== "admin" && role !== "coach" && role !== "root"

  const db = getDb()
  await sendTodayBirthdayNotifications(db)

  const [navPermissions, studioBranding] = await Promise.all([
    loadNavPermissions(),
    getStudioBranding(),
  ])
  const noNavAccess = hasNoNavAccess(role, navPermissions)

  const pathname = headersList.get("x-dashboard-pathname") ?? routes.dashboard
  if (
    !noNavAccess &&
    !canAccessDashboardPath(role, pathname, navPermissions)
  ) {
    redirect(getFirstAllowedDashboardUrl(role, navPermissions))
  }

  // Fetch welcomeShown + policy message only for alumnos — avoids unnecessary DB calls for staff
  let showWelcome = false
  let welcomeTemplate = ""
  let welcomeDisplayId = ""
  if (isAlumno) {
    const sessionDisplayId =
      typeof (session.user as { displayId?: string }).displayId === "string"
        ? (session.user as { displayId: string }).displayId.trim()
        : ""
    const [dbUser, policyRow] = await Promise.all([
      db
        .select({
          welcomeShown: schema.user.welcomeShown,
          displayId: schema.user.displayId,
        })
        .from(schema.user)
        .where(eq(schema.user.id, session.user.id))
        .limit(1),
      db
        .select({ welcomeMessage: schema.studioPolicy.welcomeMessage })
        .from(schema.studioPolicy)
        .limit(1),
    ])
    showWelcome = dbUser[0]?.welcomeShown === false
    welcomeTemplate = policyRow[0]?.welcomeMessage ?? ""
    const fromDb = dbUser[0]?.displayId?.trim() ?? ""
    welcomeDisplayId = fromDb !== "" ? fromDb : sessionDisplayId
  }

  return (
    <DashboardReadyGate>
      <SidebarProvider>
        <AppSidebar
          role={role}
          navPermissions={navPermissions}
          studioName={studioBranding.studioName}
          logoUrl={studioBranding.logoUrl}
        />
        <DashboardProviders>
          <SidebarInset className="min-w-0">
            <Navbar userName={navName} userEmail={navEmail} />
            <main className="flex-1 overflow-auto min-w-0">
              {noNavAccess ? <NoAccessPanel /> : children}
            </main>
          </SidebarInset>
        </DashboardProviders>
        {showWelcome && (
          <WelcomeModal
            template={welcomeTemplate}
            userName={navName}
            displayId={welcomeDisplayId}
          />
        )}
      </SidebarProvider>
    </DashboardReadyGate>
  )
}
