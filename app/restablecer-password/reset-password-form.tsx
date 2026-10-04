"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/shared/ui/card"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"
import { routes } from "@/lib/routes"
import { resetPasswordAction, type ResetPasswordState } from "./actions"

const initial: ResetPasswordState = { success: false }

export function ResetPasswordForm(props: {
  studioName: string
  logoUrl: string | null
  email: string
}) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <DashboardBrand
        studioName={props.studioName}
        logoUrl={props.logoUrl}
        subtitle="Nueva contraseña"
        className="mb-8 justify-center"
      />
      <Card className="w-full max-w-md border shadow-sm">
        {state.success ? (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Contraseña actualizada</CardTitle>
              <CardDescription>Ya puedes entrar con tu nueva contraseña</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Por seguridad cerramos todas tus sesiones abiertas.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href={routes.login}>Iniciar sesión</Link>
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Crea tu nueva contraseña</CardTitle>
              <CardDescription>
                Escribe el código que te llegó de no-reply@verificationemail.com. La
                contraseña lleva mínimo 8 caracteres, con letras y números.
              </CardDescription>
            </CardHeader>
            <form action={formAction} className="flex flex-col gap-6">
              <CardContent className="space-y-4">
                {state.error ? (
                  <p className="text-sm text-destructive">{state.error}</p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    defaultValue={props.email}
                    placeholder="correo@ejemplo.com"
                    required
                    disabled={pending}
                  />
                  {state.fieldErrors?.email ? (
                    <p className="text-destructive text-sm">{state.fieldErrors.email[0]}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    required
                    maxLength={10}
                    disabled={pending}
                    className="font-mono tracking-widest"
                  />
                  {state.fieldErrors?.code ? (
                    <p className="text-destructive text-sm">{state.fieldErrors.code[0]}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={pending}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                      disabled={pending}
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {state.fieldErrors?.password ? (
                    <p className="text-destructive text-sm">{state.fieldErrors.password[0]}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={pending}
                  />
                  {state.fieldErrors?.confirmPassword ? (
                    <p className="text-destructive text-sm">
                      {state.fieldErrors.confirmPassword[0]}
                    </p>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button className="w-full" type="submit" disabled={pending}>
                  {pending ? "Guardando..." : "Cambiar contraseña"}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  <Link href={routes.recuperarPassword} className="text-primary hover:underline">
                    Pedir otro código
                  </Link>
                  {" · "}
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
