"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/shared/ui/card"
import { LoginLoadingOverlay } from "@/components/features/login/login-loading-overlay"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"
import { authClient } from "@/lib/auth-client"
import { confirmAccountAndSignIn, resendAccountCode, signInWithEmail } from "@/lib/sign-in"
import { routes } from "@/lib/routes"

const CONNECTION_ERROR_MSG = "Problemas de conexión. Vuelva a intentar más tarde."
const DISABLED_MSG = "Tu cuenta está inhabilitada. Contacta al estudio."

async function waitForSessionUser() {
  for (let i = 0; i < 40; i++) {
    const s = await authClient.getSession()
    if (s.data?.user != null) return s.data.user
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 150) })
  }
  return null
}

export function LoginForm(props: {
  studioName: string
  logoUrl: string | null
  initialError: string | null
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [overlayActive, setOverlayActive] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(props.initialError)
  // Cuenta nueva sin confirmar: Cognito pide el código que mandó al correo.
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState("")
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  async function handleResendCode() {
    setResending(true)
    const res = await resendAccountCode(email)
    setResending(false)
    setInfoMsg(res.message)
  }

  const handleConnectionTimeout = useCallback(async function handleConnectionTimeout() {
    const s = await authClient.getSession()
    const user = s.data?.user
    if (user != null) {
      const enabled = (user as { enabled?: boolean }).enabled
      if (enabled !== false) {
        window.location.assign(routes.dashboard)
        return
      }
    }
    setOverlayActive(false)
    setErrorMsg(CONNECTION_ERROR_MSG)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)
    setOverlayActive(true)

    const signIn = needsCode
      ? await confirmAccountAndSignIn(email, password, code)
      : await signInWithEmail(email, password)
    if (!signIn.ok) {
      setOverlayActive(false)
      setErrorMsg(signIn.error)
      setNeedsCode(signIn.needsConfirmation === true)
      return
    }

    const user = await waitForSessionUser()
    if (user == null) {
      setOverlayActive(false)
      setErrorMsg(CONNECTION_ERROR_MSG)
      return
    }

    const enabled = (user as { enabled?: boolean }).enabled
    if (enabled === false) {
      await authClient.signOut()
      setOverlayActive(false)
      setErrorMsg(DISABLED_MSG)
      return
    }

    window.location.assign(routes.dashboard)
  }

  return (
    <>
      <LoginLoadingOverlay active={overlayActive} onConnectionTimeout={handleConnectionTimeout} />
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <DashboardBrand
          studioName={props.studioName}
          logoUrl={props.logoUrl}
          subtitle="Panel de administración"
          className="mb-8 justify-center"
        />
        <Card className="w-full max-w-md border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Usa tu correo y tu contraseña
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <CardContent className="space-y-4">
              {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
              {infoMsg ? <p className="text-sm text-muted-foreground">{infoMsg}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setNeedsCode(false)
                  }}
                  placeholder="correo@ejemplo.com"
                  required
                  disabled={overlayActive}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href={routes.recuperarPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={overlayActive}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={overlayActive}
                  >
                    {passwordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {needsCode ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="code">Código de confirmación</Label>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={overlayActive || resending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {resending ? "Reenviando..." : "Reenviar código"}
                    </button>
                  </div>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    required
                    maxLength={10}
                    disabled={overlayActive}
                    className="font-mono tracking-widest"
                  />
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" type="submit" disabled={overlayActive}>
                {overlayActive ? "Ingresando..." : needsCode ? "Confirmar y entrar" : "Continuar"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href={routes.registry} className="text-primary hover:underline">Crear cuenta</Link>
              </p>
              <p className="text-xs text-center text-muted-foreground">
                <Link href="/" className="text-primary hover:underline">Regresar a Studio 57</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  )
}
