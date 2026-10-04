"use client"

import { useActionState, useEffect, useState } from "react"
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
import { requestPlanAction, type PlanRequestActionState } from "./actions"

const initial: PlanRequestActionState = { success: false }

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Solicitar o renovar un plan a cuenta, con confirmación del adeudo. */
export function RequestPlanButton(props: {
  planId: string
  planName: string
  priceMxn: number
  renewal?: boolean
  disabled?: boolean
  variant?: "default" | "outline"
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(requestPlanAction, initial)
  const verb = props.renewal ? "Renovar" : "Solicitar"

  useEffect(() => {
    if (state.success) setOpen(false)
  }, [state.success])

  return (
    <>
      <Button
        type="button"
        className="w-full"
        variant={props.variant ?? "default"}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        {verb}
      </Button>
      {state.success && state.message ? (
        <p className="mt-2 text-xs text-green-700">{state.message}</p>
      ) : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿{verb} {props.planName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Queda activo hoy y puedes reservar de inmediato. Se genera un pago pendiente de{" "}
              {formatMxn(props.priceMxn)} que pagas en el estudio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error ? <p className="px-6 text-sm text-destructive">{state.error}</p> : null}
          <form action={formAction}>
            <input type="hidden" name="planId" value={props.planId} />
            <input type="hidden" name="renewal" value={props.renewal ? "true" : "false"} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancelar
              </AlertDialogCancel>
              <Button type="submit" disabled={pending}>
                {pending ? "Activando..." : `Sí, ${verb.toLowerCase()}`}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
