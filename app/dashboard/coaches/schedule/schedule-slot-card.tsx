"use client"

import { useState } from "react"
import { Badge } from "@/components/shared/ui/badge"
import { OccupancyBar } from "@/components/features/admin/occupancy-bar"
import { SlotRosterDialog } from "./slot-roster-dialog"

export type ScheduleSlotCardData = {
  id: string
  className: string
  startTime: string
  timeLabel: string
  rangeLabel: string
  capacity: number
  booked: number
  disabled: boolean
  isPast: boolean
  dateStr: string
}

/** Al hacer clic se abre la lista de alumn@s con reserva en esa fecha. */
export function ScheduleSlotCard(props: { slot: ScheduleSlotCardData; canSeeRoster: boolean }) {
  const [rosterOpen, setRosterOpen] = useState(false)
  const s = props.slot
  const muted = s.disabled || s.isPast

  const contenido = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold leading-none tabular-nums">{s.timeLabel}</span>
        {s.disabled ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            No se imparte
          </Badge>
        ) : s.isPast ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Ya pasó
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{s.className}</p>
      <p className="text-xs text-muted-foreground">{s.rangeLabel}</p>
      <div className="mt-3 border-t pt-3">
        <OccupancyBar booked={s.booked} capacity={s.capacity} muted={muted} />
      </div>
    </>
  )

  const clase = `rounded-lg border bg-background p-4 text-left transition-colors ${
    muted ? "opacity-55" : ""
  }`

  if (!props.canSeeRoster) {
    return <div className={clase}>{contenido}</div>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setRosterOpen(true)}
        className={`${clase} w-full hover:border-primary/40`}
        title="Ver alumn@s inscritas"
      >
        {contenido}
      </button>

      <SlotRosterDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        scheduleSlotId={s.id}
        bookingDateStr={s.dateStr}
        timeLabel={s.timeLabel}
      />
    </>
  )
}
