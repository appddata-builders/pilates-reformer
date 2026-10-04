"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/shared/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/shared/ui/dialog"
import { toggleAttendanceAction } from "./actions"
import type { AttendanceCatalogItem } from "@/lib/coach-attendance"

export function AttendanceControls(props: {
  bookingId: string
  attended: boolean | null
  catalog: AttendanceCatalogItem[]
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [catalogId, setCatalogId] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  async function save(attended: boolean) {
    setPending(true)
    setError("")
    try {
      const data = new FormData()
      data.set("bookingId", props.bookingId)
      data.set("attended", String(attended))
      if (attended) data.set("catalogId", catalogId)
      const result = await toggleAttendanceAction(data)
      if (!result.success) { setError(result.error ?? "No se pudo guardar"); return }
      setOpen(false)
      setCatalogId("")
      router.refresh()
      props.onSaved?.()
    } catch { setError("No se pudo guardar. Intenta de nuevo.") }
    finally { setPending(false) }
  }
  const selected = props.catalog.find((p) => p.id === catalogId)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={props.attended === true ? "default" : "outline"}
          disabled={pending} onClick={() => { setError(""); setOpen(true) }}>✓ Asistió</Button>
        <Button size="sm" variant={props.attended === false ? "secondary" : "outline"}
          disabled={pending} onClick={() => save(false)}>No asistió</Button>
      </div>
      {error && !open ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar asistencia</DialogTitle>
            <DialogDescription>Elige qué se debe cobrar. Administración confirma el pago y regulariza la cuenta.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            <span>Plan o clase</span>
            <select className="w-full rounded-md border bg-background p-2" value={catalogId}
              disabled={pending} onChange={(event) => setCatalogId(event.target.value)}>
              <option value="">Sin nuevo adeudo · conservar plan o cobro existente</option>
              {props.catalog.map((item) => <option key={item.id} value={item.id}>
                {item.kind === "class" ? "Clase" : "Plan"}: {item.name} · ${item.priceMxn.toFixed(2)} MXN
              </option>)}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{selected
            ? `${selected.name}: $${selected.priceMxn.toFixed(2)} MXN pendientes si aún no tiene ese cobro${selected.kind === "plan" ? ". El plan inicia hoy y esta asistencia consume una clase" : ""}.`
            : "Sólo se registra la asistencia; se conserva el saldo actual."}</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={pending} onClick={() => save(true)}>{pending ? "Guardando…" : "Confirmar asistencia"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
