"use client"

import { useState } from "react"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import type { CouponPreview } from "@/lib/coupons"

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Cupón opcional de un formulario de plan. Se envía como `couponCode` y el
 * servidor lo valida al guardar; "Aplicar" sólo muestra el precio final antes.
 */
export function CouponField(props: {
  id: string
  planId: string
  preview: (code: string, planId: string) => Promise<CouponPreview>
}) {
  const [code, setCode] = useState("")
  const [shown, setShown] = useState<{ code: string; planId: string; result: CouponPreview } | null>(null)
  const [pending, setPending] = useState(false)

  // Cambiar el código o el plan invalida el precio que se mostró.
  const result =
    shown != null && shown.code === code && shown.planId === props.planId ? shown.result : null

  async function apply() {
    setPending(true)
    try {
      const preview = await props.preview(code, props.planId)
      setShown({ code, planId: props.planId, result: preview })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>Cupón (opcional)</Label>
      <div className="flex gap-2">
        <Input
          id={props.id}
          name="couponCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código"
          autoComplete="off"
          className="uppercase"
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending || code.trim() === "" || props.planId === ""}
          onClick={() => void apply()}
        >
          {pending ? "Revisando..." : "Aplicar"}
        </Button>
      </div>
      {result?.ok ? (
        <p className="text-xs text-green-700">
          {result.discountLabel} de descuento: {formatMxn(result.listPrice)} → {formatMxn(result.finalPrice)}
        </p>
      ) : result != null ? (
        <p className="text-xs text-destructive">{result.message}</p>
      ) : null}
    </div>
  )
}
