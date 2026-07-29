"use client"

import { Badge } from "@/components/shared/ui/badge"
import { Card, CardContent } from "@/components/shared/ui/card"
import { Clock } from "lucide-react"
import { formatSlotTime } from "@/lib/attendance-report-utils"
import { formatTimeRange12h } from "@/lib/time-utils"
import { CancelBookingButton } from "./cancel-booking-button"

export type ReservaCardData = {
  id: string
  status: string
  className: string
  startTime: string
  endTime: string | null
  instructor: string | null
  alternateInstructor: string | null
  scheduleMode: string | null
  studentName?: string
  studentDisplayId?: string | null
}

function statusBadge(status: string) {
  if (status === "confirmed") {
    return (
      <Badge className="shrink-0 text-xs bg-green-100 text-green-700 border-green-200">
        Confirmada
      </Badge>
    )
  }
  if (status === "cancelled") {
    return (
      <Badge className="shrink-0 text-xs bg-red-100 text-red-700 border-red-200">
        Cancelada
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0 text-xs">
      {status}
    </Badge>
  )
}

export function ReservaCard(props: {
  reserva: ReservaCardData
  showAlumna?: boolean
  canCancel?: boolean
  cancelMode?: "admin" | "self"
}) {
  const r = props.reserva
  const timeLabel = formatSlotTime(r.startTime)
  const cancelMode = props.cancelMode ?? "admin"
  const showCancel =
    props.canCancel === true &&
    r.status === "confirmed" &&
    (cancelMode === "self" || r.studentName != null)

  return (
    <Card className="flex h-full flex-col gap-0 border py-0 shadow-sm">
      <CardContent className="flex h-full flex-col p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug">
              {r.className} · {timeLabel}
            </h3>
            {props.showAlumna && r.studentName ? (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {r.studentName}
                {r.studentDisplayId ? ` · ${r.studentDisplayId}` : ""}
              </p>
            ) : null}
          </div>
          {statusBadge(r.status)}
        </div>

        <div className="mt-auto shrink-0 border-t pt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {formatTimeRange12h(r.startTime, r.endTime)}
          </span>
          {showCancel ? (
            <CancelBookingButton
              bookingId={r.id}
              userName={r.studentName ?? "tu reserva"}
              mode={cancelMode}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
