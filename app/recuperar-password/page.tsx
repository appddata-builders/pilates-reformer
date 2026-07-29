export const dynamic = "force-dynamic"

import { getStudioBranding } from "@/lib/studio-branding"
import { ForgotPasswordForm } from "./forgot-password-form"

export default async function RecuperarPasswordPage() {
  const branding = await getStudioBranding()
  return <ForgotPasswordForm studioName={branding.studioName} logoUrl={branding.logoUrl} />
}
