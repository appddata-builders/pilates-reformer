import { CalendarDays, Package } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import { formatPlanTypeLabel } from "@/lib/site/plans"

export type PlanVigenteRow = {
  planName: string
  planType: string
  endDate: Date
  classesRemaining: number | null
  isUnlimited: boolean
  daysPerWeek: number | null
  /** El periodo ya venció; sólo quedan clases pagadas por tomar. */
  expired: boolean
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function classesLabel(left: number): string {
  return left === 1 ? "1 clase disponible" : `${left} clases disponibles`
}

/** Lo que incluye el plan: el cupo restante y, si aplica, el tope por semana. */
function includesLabel(row: PlanVigenteRow): string {
  if (row.isUnlimited) return "Clases sin límite"
  const parts = [classesLabel(row.classesRemaining ?? 0)]
  if (row.daysPerWeek != null && row.daysPerWeek > 0) {
    parts.push(`máximo ${row.daysPerWeek} por semana`)
  }
  return parts.join(" · ")
}

export function PlanVigenteCard(props: {
  row: PlanVigenteRow | null
  /** Qué hacer sin plan: depende de si se le ofrecen planes o debe uno anterior. */
  emptyHint?: string
}) {
  if (props.row == null) {
    return (
      <div className="rounded-lg border border-dashed bg-card px-5 py-4 text-sm">
        <p className="inline-flex items-center gap-2 font-medium">
          <Package className="h-4 w-4 text-muted-foreground" />
          No tienes un plan vigente
        </p>
        <p className="mt-1 text-muted-foreground">
          {props.emptyHint ??
            "Puedes reservar clases sueltas y el estudio te asigna un plan cuando lo contrates."}
        </p>
      </div>
    )
  }

  const row = props.row

  return (
    <div
      className={
        row.expired
          ? "rounded-lg border border-amber-200 bg-amber-50 px-5 py-4"
          : "rounded-lg border bg-card px-5 py-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Tu plan · {formatPlanTypeLabel(row.planType)}
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold">{row.planName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{includesLabel(row)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {row.expired ? (
            <Badge className="border-amber-300 bg-amber-100 text-amber-900">Vencido</Badge>
          ) : (
            <Badge className="border-green-200 bg-green-100 text-green-700">Vigente</Badge>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {row.expired ? "Venció" : "Vence"} {formatDate(row.endDate)}
          </span>
        </div>
      </div>

      {row.expired ? (
        <p className="mt-3 border-t border-amber-200 pt-3 text-sm text-amber-950">
          Tu plan venció, pero las clases que te quedaron siguen disponibles. Puedes
          reservarlas; coordina con el estudio para que las tomen en cuenta al
          renovar.
        </p>
      ) : null}
    </div>
  )
}
