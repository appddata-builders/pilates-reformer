"use client"

import { useEffect, useState } from "react"
import { AttendanceControls } from "../attendance/attendance-controls"
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
  const [loaded, setLoaded] = useState<{ key: string; roster: SlotRoster } | null>(null)
  const [revision, setRevision] = useState(0)
  const requestKey = `${props.scheduleSlotId}:${props.bookingDateStr}:${revision}`
  const loading = loaded?.key !== requestKey
  const roster = loading ? null : loaded.roster

  useEffect(() => {
    if (!props.open) return
    let cancelled = false
    getSlotRosterAction(props.scheduleSlotId, props.bookingDateStr)
      .then((roster) => { if (!cancelled) setLoaded({ key: requestKey, roster }) })
      .catch(() => { if (!cancelled) setLoaded({ key: requestKey, roster: { ok: false, error: "No se pudo cargar la lista" } }) })
    return () => { cancelled = true }
  }, [props.open, props.scheduleSlotId, props.bookingDateStr, requestKey])

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
                      {s.phone ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    {roster.canMarkAttendance ? <div className="mt-2">
                      <AttendanceControls bookingId={s.bookingId} attended={s.attended}
                        catalog={roster.catalog} onSaved={() => setRevision((value) => value + 1)} />
                    </div> : null}
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
