"use client"

import { useActionState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/shared/ui/card"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"
import { routes } from "@/lib/routes"
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions"

const initial: ForgotPasswordState = { success: false }

export function ForgotPasswordForm(props: {
  studioName: string
  logoUrl: string | null
}) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <DashboardBrand
        studioName={props.studioName}
        logoUrl={props.logoUrl}
        subtitle="Recuperar contraseña"
        className="mb-8 justify-center"
      />
      <Card className="w-full max-w-md border shadow-sm">
        {state.success ? (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Revisa tu correo</CardTitle>
              <CardDescription>Te enviamos el enlace para cambiar tu contraseña</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground text-center">{state.message}</p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.login}>Volver a iniciar sesión</Link>
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">¿Olvidaste tu contraseña?</CardTitle>
              <CardDescription>
                Escribe tu correo o tu ID de usuario (ST) y te mandamos un enlace para
                crear una nueva.
              </CardDescription>
            </CardHeader>
            <form action={formAction} className="flex flex-col gap-6">
              <CardContent className="space-y-4">
                {state.error ? (
                  <p className="text-sm text-destructive">{state.error}</p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="identifier">Correo o ID</Label>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="correo@ejemplo.com o ST0001"
                    required
                    disabled={pending}
                    className="font-mono"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button className="w-full" type="submit" disabled={pending}>
                  {pending ? "Enviando..." : "Enviar enlace"}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  <Link href={routes.login} className="text-primary hover:underline">
                    Volver a iniciar sesión
                  </Link>
                </p>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}
