import { Badge } from "@/components/shared/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"

export type PendingPaymentRow = {
  id: string
  amount: number
  concept: string | null
  createdAt: Date
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Lo que la alumna debe regularizar; el estudio marca el pago al recibirlo. */
export function PendingPaymentsPanel(props: { rows: PendingPaymentRow[] }) {
  if (props.rows.length === 0) return null

  const total = props.rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Pagos pendientes · {formatMxn(total)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-2">
          {props.rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4">
              <span>
                {row.concept ?? "Pago pendiente"}
                <span className="text-muted-foreground">
                  {" · "}
                  {row.createdAt.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </span>
              <Badge variant="outline" className="shrink-0">
                {formatMxn(row.amount)}
              </Badge>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-amber-200 pt-3 text-muted-foreground">
          <p>Puedes pagar en efectivo en el estudio o por transferencia:</p>
          <p>Banco: Banco Azteca</p>
          <p>Cuenta: 5263-5401-5974-3604</p>
          <p>Titular: ADALBERTO RESENDIZ RAGEL</p>
          <p>Concepto: tu nombre completo</p>
          <p>El estudio marca el pago como recibido en cuanto lo confirma.</p>
        </div>
      </CardContent>
    </Card>
  )
}
