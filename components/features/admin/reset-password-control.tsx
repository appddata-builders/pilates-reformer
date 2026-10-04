"use client"

import { useActionState, useEffect, useState } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog"

type ResetPasswordState = {
  success: boolean
  error?: string
  sentTo?: string
}

const initial: ResetPasswordState = { success: false }

export function ResetPasswordControl(props: {
  userId: string
  userLabel: string
  resetAction: (
    prev: ResetPasswordState,
    formData: FormData,
  ) => Promise<ResetPasswordState>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [state, formAction, pending] = useActionState(props.resetAction, initial)

  useEffect(() => {
    if (state.success && state.sentTo != null && state.sentTo !== "") {
      setConfirmOpen(false)
      setResultOpen(true)
    }
  }, [state.success, state.sentTo])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setConfirmOpen(true)}
      >
        <KeyRound className="h-4 w-4" />
        <span className="sr-only">Restablecer contraseña</span>
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restablecer contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Cognito le mandará a {props.userLabel} un código a su correo para que cree
              una contraseña nueva. Sus sesiones se cierran cuando la cambie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && !state.success ? (
            <p className="text-destructive text-sm px-6">{state.error}</p>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="id" value={props.userId} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancelar
              </AlertDialogCancel>
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando..." : "Sí, enviar código"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resultOpen} onOpenChange={setResultOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Código enviado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-foreground">
                <p>
                  Le enviamos a <span className="font-semibold">{state.sentTo}</span> un
                  código desde no-reply@verificationemail.com.
                </p>
                <p className="text-muted-foreground">
                  Con ese código crea su contraseña en «¿Olvidaste tu contraseña?».
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" onClick={() => setResultOpen(false)}>
              Cerrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
