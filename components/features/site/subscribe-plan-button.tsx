"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { requestPlanAction } from "@/app/dashboard/planes/actions"
import { routes } from "@/lib/routes"

/**
 * "Suscribirme" de la landing para quien ya tiene sesión. Activa el plan a
 * cuenta, con las mismas reglas que «Mis planes»; sin sesión la landing manda
 * al registro en su lugar.
 */
export function SubscribePlanButton(props: {
  planId: string
  planName: string
  priceLabel: string
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const done = result?.ok === true

  async function subscribe() {
    setPending(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set("planId", props.planId)
      const res = await requestPlanAction({ success: false }, fd)
      setResult(
        res.success
          ? { ok: true, text: res.message ?? "Tu plan quedó activo." }
          : { ok: false, text: res.error ?? "No se pudo activar el plan. Intenta de nuevo." },
      )
    } catch {
      setResult({ ok: false, text: "No se pudo activar el plan. Intenta de nuevo." })
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={props.className}
        onClick={() => {
          setResult(null)
          setOpen(true)
        }}
      >
        Suscribirme
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (pending) return
          setOpen(value)
          // Al cerrar tras activarlo, la página se vuelve a pintar con el plan.
          if (!value && done) router.refresh()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {done ? "Tu plan quedó activo" : `¿Suscribirte a ${props.planName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {done
                ? result.text
                : `Queda activo hoy y puedes reservar de inmediato. Se genera un pago pendiente de ${props.priceLabel} que pagas en el estudio.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {result != null && !result.ok ? (
            <p role="alert" className="text-sm text-destructive">{result.text}</p>
          ) : null}
          <AlertDialogFooter>
            {done ? (
              <>
                <AlertDialogCancel type="button">Cerrar</AlertDialogCancel>
                <Button asChild>
                  <Link href={routes.agendar}>Agendar clase</Link>
                </Button>
              </>
            ) : (
              <>
                <AlertDialogCancel type="button" disabled={pending}>
                  Cancelar
                </AlertDialogCancel>
                <Button type="button" disabled={pending} onClick={() => void subscribe()}>
                  {pending ? "Activando..." : "Sí, suscribirme"}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
