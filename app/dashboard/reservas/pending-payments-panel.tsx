import { FaWhatsapp } from "react-icons/fa6"
import { Badge } from "@/components/shared/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import { sitePhoneDisplay, siteWhatsAppUrl } from "@/lib/site/routes"

export type PendingPaymentRow = {
  id: string
  amount: number
  concept: string | null
  createdAt: Date
  /** Inicio del plan cuando el cobro es de una suscripción. */
  planStartDate: Date | null
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Mensaje de WhatsApp ya escrito con lo que el estudio necesita para ubicar el
 * pago: quién paga, qué plan y desde cuándo. Sólo falta adjuntar el comprobante.
 */
function buildReceiptWhatsAppUrl(userName: string, rows: PendingPaymentRow[], total: number): string {
  const lines = [
    "Hola, te envío mi comprobante de pago.",
    userName.trim() !== "" ? `Nombre: ${userName.trim()}` : null,
    ...rows.map((row) => {
      const start = row.planStartDate != null ? ` · Inicio: ${formatDay(row.planStartDate)}` : ""
      return `- ${row.concept ?? "Pago pendiente"}${start} · ${formatMxn(row.amount)}`
    }),
    rows.length > 1 ? `Total: ${formatMxn(total)}` : null,
  ].filter((line): line is string => line != null)
  return `${siteWhatsAppUrl}?text=${encodeURIComponent(lines.join("\n"))}`
}

/** Lo que la alumna debe regularizar; el estudio marca el pago al recibirlo. */
export function PendingPaymentsPanel(props: { rows: PendingPaymentRow[]; userName: string }) {
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
          <p>
            Envía tu comprobante de pago por WhatsApp al {sitePhoneDisplay} con el plan que
            elegiste y tu fecha de inicio.
          </p>
          <a
            href={buildReceiptWhatsAppUrl(props.userName, props.rows, total)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1ebe5b]"
          >
            <FaWhatsapp className="h-4 w-4" aria-hidden />
            Enviar comprobante por WhatsApp
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
