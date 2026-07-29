export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { routes } from "@/lib/routes"
import { getStudioBranding } from "@/lib/studio-branding"
import { LoginForm } from "./login-form"

const DISABLED_MSG = "Tu cuenta está inhabilitada. Contacta al estudio."

type PageProps = {
  searchParams: Promise<{ inhabilitado?: string }>
}

export default async function LoginPage(props: PageProps) {
  const [headersList, searchParams] = await Promise.all([
    headers(),
    props.searchParams,
  ])

  const session = await auth.api.getSession({
    headers: headersList,
    query: { disableRefresh: true },
  })

  const user = session?.user as { enabled?: boolean } | undefined
  const accountDisabled = user != null && user.enabled === false

  // Sesión válida: al panel directo, sin renderizar el formulario.
  if (user != null && !accountDisabled) {
    redirect(routes.dashboard)
  }

  const branding = await getStudioBranding()
  const showDisabledMsg = accountDisabled || searchParams.inhabilitado === "1"

  return (
    <LoginForm
      studioName={branding.studioName}
      logoUrl={branding.logoUrl}
      accountDisabled={accountDisabled}
      initialError={showDisabledMsg ? DISABLED_MSG : null}
    />
  )
}
