"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { LogOut, ChevronDown, UserRound } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/shared/ui/avatar"
import { SidebarTrigger } from "@/components/shared/ui/sidebar"
import { Separator } from "@/components/shared/ui/separator"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/shared/ui/breadcrumb"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"
import { pathSegmentLabels } from "@/modules/admin/path-segment-labels"

import { NotificationBell } from "@/components/features/admin/notification-bell"
import { HelpTourButton } from "@/components/features/admin/help-tour-button"
import { DbActionFeedbackBadge } from "@/components/features/admin/db-action-feedback"

export function Navbar({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const userInitials = userName.slice(0, 2).toUpperCase()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const res = await authClient.signOut()
    if (res.error != null) {
      setSigningOut(false)
      return
    }
    window.location.assign(routes.login)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1
              const href = "/" + segments.slice(0, index + 1).join("/")
              const label = pathSegmentLabels[segment]
                ?? segment.charAt(0).toUpperCase() + segment.slice(1)
              return (
                <span key={`${segment}-${index}`} className="contents">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <DbActionFeedbackBadge />
        <HelpTourButton />
        <NotificationBell />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 pl-3 pr-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline font-medium text-sm">{userName}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={routes.cuenta} className="cursor-pointer">
              <UserRound className="mr-2 h-4 w-4" />
              Ver cuenta
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            disabled={signingOut}
            onSelect={(e) => {
              e.preventDefault()
              void handleSignOut()
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
