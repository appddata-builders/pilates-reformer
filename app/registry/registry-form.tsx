"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import { Checkbox } from "@/components/shared/ui/checkbox"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import {
  WELCOME_POLICY_PDF_FILENAME,
  WELCOME_POLICY_PDF_PATH,
} from "@/lib/hidden-registry"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shared/ui/card"
import { PasswordChecklist } from "@/components/features/auth/password-checklist"
import { authClient } from "@/lib/auth-client"
import { isPasswordValid } from "@/lib/password-rules"
import { routes } from "@/lib/routes"
import { confirmAccountAndSignIn, resendAccountCode } from "@/lib/sign-in"
import { hiddenRegistryAction, type RegistryActionState } from "./actions"

const initial: RegistryActionState = { success: false }

/**
 * Después del alta, como en refautomex: Cognito mandó un código al correo y
 * aquí se confirma. Con la contraseña recién escrita se abre la sesión y entra
 * directo al panel. Si se cierra esta pantalla, el login pide el código.
 */
function RegistryConfirmCard(props: { email: string; password: string }) {
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)
    setPending(true)

    const signIn = await confirmAccountAndSignIn(props.email, props.password, code)
    if (!signIn.ok) {
      setPending(false)
      setErrorMsg(signIn.error)
      return
    }

    const user = await authClient.waitForSessionUser()
    if (user == null) {
      setPending(false)
      setErrorMsg("Tu cuenta quedó confirmada. Entra con tu correo y contraseña.")
      return
    }
    window.location.assign(routes.dashboard)
  }

  async function handleResend() {
    setResending(true)
    const res = await resendAccountCode(props.email)
    setResending(false)
    setInfoMsg(res.message)
  }

  return (
    <Card className="w-full max-w-md border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Confirma tu correo</CardTitle>
        <CardDescription>
          Te mandamos un código a {props.email} desde no-reply@verificationemail.com
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleConfirm} className="flex flex-col gap-6">
        <CardContent className="space-y-4">
          {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
          {infoMsg ? <p className="text-sm text-muted-foreground">{infoMsg}</p> : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="code">Código de confirmación</Label>
              <button
                type="button"
                onClick={handleResend}
                disabled={pending || resending}
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
              disabled={pending}
              className="font-mono tracking-widest"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Revisa también la carpeta de spam. Tu plan lo confirma el estudio.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Confirmando..." : "Confirmar y entrar"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            <Link href={routes.login} className="text-primary hover:underline">
              Confirmar después desde iniciar sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

export function RegistryForm(props: { registryToken: string }) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [policyDownloaded, setPolicyDownloaded] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [state, action, pending] = useActionState(hiddenRegistryAction, initial)
  // La contraseña sólo vive en memoria: con ella se abre la sesión al confirmar.
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const canSubmit = policyDownloaded && policyAccepted
  const passwordReady = isPasswordValid(password) && password === confirmPassword

  useEffect(() => {
    if (state.success) {
      setPasswordVisible(false)
    }
  }, [state.success])

  if (state.success) {
    return <RegistryConfirmCard email={state.email ?? ""} password={password} />
  }

  return (
    <Card className="w-full max-w-md border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Registro</CardTitle>
        <CardDescription>Completa tus datos para crear tu cuenta</CardDescription>
      </CardHeader>
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="registryToken" value={props.registryToken} />
        <input type="hidden" name="policyDownloaded" value={policyDownloaded ? "true" : "false"} />
        <input type="hidden" name="policyAccepted" value={policyAccepted ? "true" : "false"} />
        <div className="hidden" aria-hidden="true">
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>
        <CardContent className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
            {state.fieldErrors?.name ? (
              <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
            {state.fieldErrors?.email ? (
              <p className="text-destructive text-sm">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (WhatsApp)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={32}
              autoComplete="tel"
            />
            {state.fieldErrors?.phone ? (
              <p className="text-destructive text-sm">{state.fieldErrors.phone[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthdate">Fecha de cumpleaños</Label>
            <Input id="birthdate" name="birthdate" type="date" />
            {state.fieldErrors?.birthdate ? (
              <p className="text-destructive text-sm">{state.fieldErrors.birthdate[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              maxLength={128}
              autoComplete="new-password"
            />
            {state.fieldErrors?.confirmPassword ? (
              <p className="text-destructive text-sm">{state.fieldErrors.confirmPassword[0]}</p>
            ) : null}
            <PasswordChecklist password={password} confirm={confirmPassword} />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Acuerdo y políticas</p>
            <p className="text-xs text-muted-foreground">
              Descarga el documento, revísalo y acepta para habilitar el registro.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setPolicyDownloaded(true)
                const link = document.createElement("a")
                link.href = WELCOME_POLICY_PDF_PATH
                link.download = WELCOME_POLICY_PDF_FILENAME
                link.target = "_blank"
                link.rel = "noopener noreferrer"
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
            >
              {policyDownloaded ? "Documento descargado" : "Descargar acuerdo (PDF)"}
            </Button>
            <a
              href={WELCOME_POLICY_PDF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline block text-center"
              onClick={() => setPolicyDownloaded(true)}
            >
              Ver PDF en nueva pestaña
            </a>
            <div className="flex items-start gap-3">
              <Checkbox
                id="policyAccepted"
                checked={policyAccepted}
                disabled={!policyDownloaded}
                onCheckedChange={(value) => {
                  if (value === true) {
                    setPolicyAccepted(true)
                  } else {
                    setPolicyAccepted(false)
                  }
                }}
              />
              <Label
                htmlFor="policyAccepted"
                className={`text-sm leading-snug font-normal ${policyDownloaded ? "" : "text-muted-foreground"}`}
              >
                He leído y acepto el acuerdo de bienvenida y las políticas del estudio
              </Label>
            </div>
            {!canSubmit ? (
              <p className="text-xs text-muted-foreground">
                {!policyDownloaded
                  ? "Primero descarga o abre el PDF."
                  : "Marca la casilla de aceptación para continuar."}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" type="submit" disabled={pending || !canSubmit || !passwordReady}>
            {pending ? "Registrando..." : "Crear cuenta"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              Regresar al sitio
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
