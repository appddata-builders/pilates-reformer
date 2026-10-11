"use client"

import { useState } from "react"
import Image from "next/image"
import { SubscribePlanButton } from "@/components/features/site/subscribe-plan-button"
import { planCardImage, type PublicPlan } from "@/lib/site/plans"

/**
 * Las mismas tarjetas de planes de la landing, en el panel de la alumna que
 * aún no tiene plan vigente, con «Suscribirme» en lugar de mandar al registro.
 */
export function PlanOffers(props: { plans: PublicPlan[] }) {
  const [cadence, setCadence] = useState<Record<string, string>>({})

  if (props.plans.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Planes disponibles
        </h2>
        <p className="text-sm text-muted-foreground">
          Suscríbete y queda activo hoy: tus reservas se descuentan solas del plan.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {props.plans.map((plan, index) => {
          const active = plan.prices.find((price) => price.label === cadence[plan.id]) ?? plan.prices[0]
          const multiple = plan.prices.length > 1
          return (
            <article
              key={plan.id}
              className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <div className="relative h-32 w-full bg-muted sm:h-40">
                <Image
                  src={planCardImage(index)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                <div>
                  {plan.badge ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {plan.badge}
                    </p>
                  ) : null}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm font-medium text-primary">{active.includes}</p>
                  {plan.note ? <p className="text-sm text-muted-foreground">{plan.note}</p> : null}
                </div>
                <div className="grid gap-2 text-sm" role={multiple ? "radiogroup" : undefined}>
                  {plan.prices.map((price) => {
                    const isActive = price.planId === active.planId
                    return (
                      <button
                        key={price.planId}
                        type="button"
                        role={multiple ? "radio" : undefined}
                        aria-checked={multiple ? isActive : undefined}
                        disabled={!multiple}
                        onClick={() => setCadence((prev) => ({ ...prev, [plan.id]: price.label }))}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition ${
                          isActive
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border bg-muted/40 hover:border-primary/40"
                        } disabled:cursor-default`}
                      >
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {price.label}
                        </span>
                        <span className="text-base font-semibold">{price.priceLabel}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-auto">
                  <SubscribePlanButton
                    planId={active.planId}
                    planName={multiple ? `${plan.name} ${active.label}` : plan.name}
                    priceLabel={active.priceLabel}
                    className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
