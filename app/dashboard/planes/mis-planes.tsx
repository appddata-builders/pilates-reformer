import Link from "next/link"
import { CalendarDays, Package } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { Card, CardContent } from "@/components/shared/ui/card"
import { PageHeader } from "@/components/features/admin/page-header"
import { routes } from "@/lib/routes"

export type MiPlanRow = {
  id: string
  planName: string
  planType: string
  status: string
  startDate: Date
  endDate: Date
  classesRemaining: number | null
  isUnlimited: boolean
  paidAmount: number | null
  vigente: boolean
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
}

function conceptLabel(planType: string): string {
  return planType === "monthly" ? "Plan activo" : "Paquete"
}

export function MisPlanes(props: { rows: MiPlanRow[]; pendingBalance: number }) {
  const activos = props.rows.filter((r) => r.vigente)
  const pasados = props.rows.filter((r) => !r.vigente)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mis planes"
        description={
          activos.length === 0
            ? "No tienes un plan o paquete vigente"
            : `${activos.length} vigente${activos.length === 1 ? "" : "s"}`
        }
      >
        <Button asChild>
          <Link href={routes.agendar}>Agendar clase</Link>
        </Button>
      </PageHeader>

      {props.pendingBalance > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">
            Tienes {formatMxn(props.pendingBalance)} por regularizar
          </p>
          <p className="mt-1">
            Son clases que apartaste sin pago previo. Págalas en el estudio y ahí las
            registran como recibidas.
          </p>
        </div>
      ) : null}

      {activos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no tienes un plan o paquete contratado.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Puedes reservar clases sueltas y el estudio te asigna un plan cuando lo contrates.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((row) => (
            <Card key={row.id} className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {conceptLabel(row.planType)}
                    </p>
                    <h3 className="mt-0.5 truncate text-base font-semibold">{row.planName}</h3>
                  </div>
                  <Badge className="border-green-200 bg-green-100 text-green-700">Vigente</Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clases restantes</span>
                    <span className="font-medium">
                      {row.isUnlimited || row.planType === "monthly"
                        ? "Sin límite"
                        : (row.classesRemaining ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Vence
                    </span>
                    <span className="font-medium">{formatDate(row.endDate)}</span>
                  </div>
                  {row.paidAmount != null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Importe</span>
                      <span className="font-medium">{formatMxn(row.paidAmount)}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pasados.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Anteriores
          </h2>
          <div className="rounded-lg border bg-card divide-y">
            {pasados.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                <span className="font-medium">{row.planName}</span>
                <span className="text-xs text-muted-foreground">
                  {conceptLabel(row.planType)} · {formatDate(row.startDate)} –{" "}
                  {formatDate(row.endDate)}
                </span>
                <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
                  {row.status === "cancelled" ? "Cancelado" : "Vencido"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
