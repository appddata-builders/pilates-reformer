import { Users } from "lucide-react"

/** Verde con holgura, ámbar con 2 lugares o menos, rojo cuando está llena. */
export function OccupancyBar(props: {
  booked: number
  capacity: number
  muted?: boolean
}) {
  const pct = props.capacity > 0 ? Math.min(100, (props.booked / props.capacity) * 100) : 0
  const free = Math.max(0, props.capacity - props.booked)
  const full = props.booked >= props.capacity
  const tight = !full && free <= 2

  const barClass = props.muted
    ? "bg-muted-foreground/40"
    : full
      ? "bg-red-500"
      : tight
        ? "bg-amber-500"
        : "bg-primary"

  const freeClass = props.muted
    ? "text-muted-foreground"
    : full
      ? "font-medium text-red-600"
      : tight
        ? "font-medium text-amber-600"
        : "text-muted-foreground"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {props.booked} / {props.capacity}
        </span>
        <span className={freeClass}>{full ? "Llena" : `${free} libres`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
