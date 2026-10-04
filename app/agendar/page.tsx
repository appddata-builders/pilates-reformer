import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AgendarScreen } from "@/components/agendar-screen"
import { AccountNavLink } from "@/components/features/site/account-nav-link"
import { getSession } from "@/lib/session"
import { siteLogo } from "@/lib/site/routes"
import { getStudioBranding } from "@/lib/studio-branding"
import { getServerT } from "@/lib/text/server-text"

type SearchParams = Promise<{ date?: string; slot?: string }>

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [params, t, branding, session] = await Promise.all([
    searchParams,
    getServerT(),
    getStudioBranding(),
    getSession(),
  ])

  if (params.slot && session?.user == null) redirect("/login")

  const logoSrc =
    branding.logoUrl != null && branding.logoUrl.trim() !== ""
      ? branding.logoUrl.trim()
      : siteLogo

  return (
    <main className="min-h-screen bg-[#f9f0e3] text-[#1b1a18]">
      <div className="border-b border-black/10 bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-green-base transition hover:text-green-hover"
          >
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white">
              <Image
                src={logoSrc}
                alt={branding.studioName}
                fill
                sizes="36px"
                className="object-cover"
                unoptimized={logoSrc.startsWith("http")}
              />
            </span>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("agendar.page.back")}
          </Link>
          <AccountNavLink
            initialLoggedIn={session?.user != null}
            className="rounded-full bg-green-base px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-hover"
          />
        </div>
      </div>
      <AgendarScreen
        initialDate={params.date ?? null}
        initialSlotId={params.slot ?? null}
      />
    </main>
  )
}
