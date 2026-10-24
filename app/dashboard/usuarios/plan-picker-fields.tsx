"use client"

import { useState } from "react"
import { Label } from "@/components/shared/ui/label"
import { Input } from "@/components/shared/ui/input"
import { CouponField } from "@/components/features/admin/coupon-field"
import { formatPlanPickerLabel } from "@/lib/site/plans"
import { previewPlanCouponAction } from "./actions"

export type PlanOption = {
  id: string
  name: string
  priceMxn: number
  planType: string
}

const BILLING_OPTIONS = [
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "semanal", label: "Semanal" },
  { value: "efectivo", label: "Efectivo" },
]

export function PlanPickerFields(props: {
  idPrefix: string
  planes: PlanOption[]
  defaultPlanId?: string
  defaultBillingCycle?: string
  showStartDate?: boolean
  defaultStartDate?: string
  /** Cuenta que se edita: el cupón se usa una vez por usuario. */
  userId?: string
}) {
  const planDefault = props.defaultPlanId ?? ""
  const [planId, setPlanId] = useState(planDefault)
  const billingDefault = props.defaultBillingCycle ?? "mensual"
  const startDefault =
    props.defaultStartDate ?? new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-planId`}>Plan</Label>
        <select
          id={`${props.idPrefix}-planId`}
          name="planId"
          defaultValue={planDefault}
          onChange={(e) => setPlanId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sin plan</option>
          {props.planes.map((p) => (
            <option key={p.id} value={p.id}>
              {formatPlanPickerLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-billingCycle`}>Ciclo de pago</Label>
        <select
          id={`${props.idPrefix}-billingCycle`}
          name="billingCycle"
          defaultValue={billingDefault}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {BILLING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {props.showStartDate ? (
        <div className="space-y-2">
          <Label htmlFor={`${props.idPrefix}-startDate`}>Inicio del plan</Label>
          <Input
            id={`${props.idPrefix}-startDate`}
            name="startDate"
            type="date"
            defaultValue={startDefault}
          />
        </div>
      ) : null}
      <CouponField
        id={`${props.idPrefix}-couponCode`}
        planId={planId}
        preview={(code, selected) => previewPlanCouponAction(code, selected, props.userId ?? null)}
      />
    </>
  )
}
