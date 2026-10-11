import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"
import { canAccessHiddenRegistry } from "@/lib/hidden-registry"
import { getStudioBranding } from "@/lib/studio-branding"
import { getDb } from "@/lib/db"
import { listRequestablePlans } from "@/lib/plan-requests"
import { RegistryForm } from "./registry-form"

export const metadata: Metadata = {
  title: "Registro",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<{ t?: string; plan?: string }>
}

export default async function RegistryPage(props: PageProps) {
  const searchParams = await props.searchParams
  const token = typeof searchParams.t === "string" ? searchParams.t : undefined

  if (!canAccessHiddenRegistry(token)) {
    notFound()
  }

  // El plan que eligió en la landing o en el modal; uno que ya no se ofrece se
  // ignora y la cuenta se crea sin plan.
  const planParam = typeof searchParams.plan === "string" ? searchParams.plan.trim() : ""
  const [branding, plans] = await Promise.all([
    getStudioBranding(),
    planParam !== "" ? listRequestablePlans(getDb()) : Promise.resolve([]),
  ])
  const chosen = plans.find((plan) => plan.id === planParam)
  const selectedPlan =
    chosen != null ? { id: chosen.id, name: chosen.name, priceMxn: chosen.priceMxn } : null
  const registryToken = token ?? ""

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <DashboardBrand
        studioName={branding.studioName}
        logoUrl={branding.logoUrl}
        subtitle="Alta de usuario"
        className="mb-8 justify-center"
      />
      <RegistryForm registryToken={registryToken} selectedPlan={selectedPlan} />
    </div>
  )
}
