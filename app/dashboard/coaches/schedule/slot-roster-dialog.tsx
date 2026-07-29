"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog"
import { getSlotRosterAction, type SlotRoster } from "./actions"

export function SlotRosterDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleSlotId: string
  bookingDateStr: string
  timeLabel: string
}) {
  const [roster, setRoster] = useState<SlotRoster | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setLoading(true)
    setRoster(null)
    getSlotRosterAction(props.scheduleSlotId, props.bookingDateStr)
      .then((r) => setRoster(r))
      .catch(() => setRoster({ ok: false, error: "No se pudo cargar la lista" }))
      .finally(() => setLoading(false))
  }, [props.open, props.scheduleSlotId, props.bookingDateStr])

  const students = roster?.ok ? roster.students : []

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            {roster?.ok ? roster.className : "Alumn@s inscritas"} · {props.timeLabel}
          </DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {roster?.ok ? roster.dateLabel : "Próxima clase"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : roster == null || !roster.ok ? (
            <p className="py-8 text-center text-sm text-destructive">
              {roster?.ok === false ? roster.error : "No se pudo cargar la lista"}
            </p>
          ) : students.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nadie ha reservado esta clase todavía
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {students.map((s, i) => (
                <li key={s.bookingId} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {s.displayId ?? "—"}
                      {s.phone ? ` · ${s.phone}` : ""}
                    </p>
                  </div>
                  {s.attended === true ? (
                    <Badge className="border-green-200 bg-green-100 text-[10px] text-green-700">
                      Asistió
                    </Badge>
                  ) : s.attended === false ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      No asistió
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {roster?.ok ? (
          <div className="shrink-0 border-t px-6 py-3 text-sm text-muted-foreground">
            {students.length} de {roster.capacity} lugares ocupados
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
