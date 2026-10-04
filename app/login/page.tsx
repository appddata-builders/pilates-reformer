export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { routes } from "@/lib/routes"
import { getStudioBranding } from "@/lib/studio-branding"
import { LoginForm } from "./login-form"

const DISABLED_MSG = "Tu cuenta está inhabilitada. Contacta al estudio."

type PageProps = {
  searchParams: Promise<{ inhabilitado?: string }>
}

export default async function LoginPage(props: PageProps) {
  const [session, searchParams] = await Promise.all([
    getSession(),
    props.searchParams,
  ])

  // Sesión válida: al panel directo, sin renderizar el formulario.
  // getSession ya descarta las cuentas inhabilitadas.
  if (session != null) {
    redirect(routes.dashboard)
  }

  const branding = await getStudioBranding()

  return (
    <LoginForm
      studioName={branding.studioName}
      logoUrl={branding.logoUrl}
      initialError={searchParams.inhabilitado === "1" ? DISABLED_MSG : null}
    />
  )
}
