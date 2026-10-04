export const dynamic = "force-dynamic"

import { getStudioBranding } from "@/lib/studio-branding"
import { ResetPasswordForm } from "./reset-password-form"

type PageProps = {
  searchParams: Promise<{ email?: string }>
}

// Segundo paso de "olvidé mi contraseña": el código lo manda Cognito por
// correo. `email` viene del primer paso para no volver a escribirlo.
export default async function RestablecerPasswordPage(props: PageProps) {
  const [branding, searchParams] = await Promise.all([
    getStudioBranding(),
    props.searchParams,
  ])

  return (
    <ResetPasswordForm
      studioName={branding.studioName}
      logoUrl={branding.logoUrl}
      email={searchParams.email?.trim() ?? ""}
    />
  )
}
