export const dynamic = "force-dynamic"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  SidebarProvider,
  SidebarInset,
  SIDEBAR_COOKIE_NAME,
} from "@/components/shared/ui/sidebar"
import { AppSidebar } from "@/components/features/admin/app-sidebar"
import { Navbar } from "@/components/features/admin/navbar"
import { DashboardProviders } from "@/components/features/admin/dashboard-providers"
import { getSession } from "@/lib/session"
import { loadNavPermissions } from "@/lib/nav-permissions.server"
import { canAccessDashboardPath, hasNoNavAccess } from "@/lib/nav-permissions"
import { routes } from "@/lib/routes"
import { NoAccessPanel } from "@/components/features/admin/no-access-panel"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { WelcomeModal } from "./_welcome-modal"
import { sendTodayBirthdayNotifications } from "@/lib/birthday-notifications"
import { sendPlanRenewalReminders } from "@/lib/plan-requests"
import { getStudioBranding } from "@/lib/studio-branding"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const session = await getSession()
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
  if (isAlumno) {
    await sendPlanRenewalReminders(db, session.user.id)
  }

  const [navPermissions, studioBranding] = await Promise.all([
    loadNavPermissions(),
    getStudioBranding(),
  ])
  const noNavAccess = hasNoNavAccess(role, navPermissions)

  const pathname = headersList.get("x-dashboard-pathname") ?? routes.dashboard

  // Aquí NO se redirige. Un `redirect()` desde un layout compartido rompe la
  // navegación suave: el router pide el árbol de /dashboard, recibe la
  // redirección, vuelve a pedir el destino y nunca se estabiliza -se midieron
  // 825 peticiones RSC en 4 s contra la misma URL-, así que el usuario se queda
  // con un Suspense vacío, o sea la pantalla en blanco. El reparto por rol de
  // /dashboard lo hace su propia page, que sí puede redirigir sin romperlo.
  const isDashboardRoot = pathname === routes.dashboard
  const blockedByPermissions =
    !noNavAccess &&
    !isDashboardRoot &&
    !canAccessDashboardPath(role, pathname, navPermissions)

  // Fetch welcomeShown + policy message only for alumnos — avoids unnecessary DB calls for staff
  let showWelcome = false
  let welcomeTemplate = ""
  if (isAlumno) {
    const [dbUser, policyRow] = await Promise.all([
      db
        .select({ welcomeShown: schema.user.welcomeShown })
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
  }

  // El sidebar se pinta ya con su estado real: si el valor llegara despues de
  // hidratar, el panel brincaria en cada carga del dashboard.
  const sidebarCookie = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value
  const sidebarDefaultOpen = sidebarCookie !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar
        role={role}
        navPermissions={navPermissions}
        studioName={studioBranding.studioName}
        logoUrl={studioBranding.logoUrl}
      />
      <DashboardProviders>
        <SidebarInset className="min-w-0">
          <Navbar userName={navName} userEmail={navEmail} role={role} />
          <main className="flex-1 overflow-auto min-w-0">
            {noNavAccess || blockedByPermissions ? <NoAccessPanel /> : children}
          </main>
        </SidebarInset>
      </DashboardProviders>
      {showWelcome && (
        <WelcomeModal
          template={welcomeTemplate}
          userName={navName}
        />
      )}
    </SidebarProvider>
  )
}
