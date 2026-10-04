import Link from "next/link"
import { CalendarDays, Package } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { Card, CardContent } from "@/components/shared/ui/card"
import { PageHeader } from "@/components/features/admin/page-header"
import { routes } from "@/lib/routes"
import type { PlanRequestState, RequestablePlan } from "@/lib/plan-requests"
import { RequestPlanButton } from "./request-plan-button"

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

function periodLabel(durationDays: number): string {
  if (durationDays === 7) return "semanal"
  if (durationDays === 15) return "quincenal"
  if (durationDays === 30) return "mensual"
  return `${durationDays} días`
}

function frequencyLabel(plan: RequestablePlan): string {
  if (plan.planType === "monthly" && plan.daysPerWeek > 0) {
    return `${plan.daysPerWeek} clases por semana · ${periodLabel(plan.durationDays)}`
  }
  if (plan.totalClasses != null) return `${plan.totalClasses} clases · ${plan.durationDays} días`
  return periodLabel(plan.durationDays)
}

export function MisPlanes(props: {
  rows: MiPlanRow[]
  pendingBalance: number
  requestState: PlanRequestState
}) {
  const request = props.requestState
  const blockedByDebt = request.pendingPlanDebt > 0
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

      {request.renewable != null ? (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                Tu {request.renewable.planName} terminó el {formatDate(request.renewable.endDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                {request.renewable.available
                  ? "Renuévalo para seguir reservando con tu plan, o elige otro abajo."
                  : "Ese plan ya no está disponible; elige otro abajo."}
              </p>
            </div>
            {request.renewable.available ? (
              <div className="sm:w-48">
                <RequestPlanButton
                  planId={request.renewable.planId}
                  planName={request.renewable.planName}
                  priceMxn={
                    request.plans.find((p) => p.id === request.renewable?.planId)?.priceMxn ?? 0
                  }
                  renewal
                  disabled={blockedByDebt}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activos.length === 0 ? (
        request.renewable == null ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aún no tienes un plan o paquete contratado.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige uno abajo: queda activo hoy y lo pagas en el estudio. También puedes
              reservar clases sueltas.
            </p>
          </div>
        ) : null
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
                      {row.isUnlimited ? "Sin límite" : (row.classesRemaining ?? 0)}
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

      {request.current == null ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Planes disponibles
          </h2>
          {blockedByDebt ? (
            <p className="text-sm text-amber-900">
              Para solicitar o renovar, primero paga en el estudio{" "}
              {formatMxn(request.pendingPlanDebt)} de tu plan anterior.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {request.plans.map((plan) => (
              <Card key={plan.id} className="border shadow-sm">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div>
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{frequencyLabel(plan)}</p>
                  </div>
                  <p className="text-lg font-semibold">{formatMxn(plan.priceMxn)}</p>
                  <div className="mt-auto">
                    <RequestPlanButton
                      planId={plan.id}
                      planName={plan.name}
                      priceMxn={plan.priceMxn}
                      variant="outline"
                      disabled={blockedByDebt}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cuando termine tu plan podrás renovarlo aquí o elegir otro.
        </p>
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
