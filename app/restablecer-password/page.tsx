export const dynamic = "force-dynamic"

import Link from "next/link"
import { Button } from "@/components/shared/ui/button"
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from "@/components/shared/ui/card"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"
import {
  PASSWORD_RESET_INVALID_TOKEN_MESSAGE,
  isPasswordResetTokenUsable,
} from "@/lib/password-reset"
import { routes } from "@/lib/routes"
import { getStudioBranding } from "@/lib/studio-branding"
import { ResetPasswordForm } from "./reset-password-form"

type PageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function RestablecerPasswordPage(props: PageProps) {
  const [branding, searchParams] = await Promise.all([
    getStudioBranding(),
    props.searchParams,
  ])

  const token = searchParams.token?.trim() ?? ""
  const tokenUsable = token !== "" && (await isPasswordResetTokenUsable(token))

  if (!tokenUsable) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <DashboardBrand
          studioName={branding.studioName}
          logoUrl={branding.logoUrl}
          subtitle="Nueva contraseña"
          className="mb-8 justify-center"
        />
        <Card className="w-full max-w-md border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Enlace no válido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {PASSWORD_RESET_INVALID_TOKEN_MESSAGE}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={routes.recuperarPassword}>Solicitar un enlace nuevo</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={routes.login}>Volver a iniciar sesión</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <ResetPasswordForm
      studioName={branding.studioName}
      logoUrl={branding.logoUrl}
      token={token}
    />
  )
}
