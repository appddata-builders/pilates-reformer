"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { getNavItemsForRole } from "@/lib/nav-permissions"
import type { NavPermissionsMap } from "@/lib/nav-permissions"
import type { AdminNavItem } from "@/modules/admin/nav-items"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/shared/ui/sidebar"
import { Input } from "@/components/shared/ui/input"
import { Badge } from "@/components/shared/ui/badge"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { DEFAULT_STUDIO_NAME } from "@/lib/studio-branding-constants"
import { DashboardBrand } from "@/components/features/admin/dashboard-brand"

interface AppSidebarProps {
  role?: string
  navPermissions?: NavPermissionsMap
  studioName?: string
  logoUrl?: string | null
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function navItemMatchesQuery(item: AdminNavItem, query: string): boolean {
  if (query === "") return true
  const normalizedQuery = normalizeSearchText(query)
  const urlSlug = item.url.split("/").filter(Boolean).join(" ")
  const extraTerms = item.searchTerms ?? []
  const haystack = normalizeSearchText(
    `${item.title} ${item.key} ${urlSlug} ${extraTerms.join(" ")}`
  )
  return haystack.includes(normalizedQuery)
}

export function AppSidebar({
  role = "admin",
  navPermissions,
  studioName = DEFAULT_STUDIO_NAME,
  logoUrl = null,
}: Readonly<AppSidebarProps>) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = getNavItemsForRole(role, navPermissions)
  const [searchQuery, setSearchQuery] = React.useState("")
  const trimmedSearch = searchQuery.trim()
  const hasSearch = trimmedSearch.length > 0
  const matchingItems = hasSearch
    ? navItems.filter((item) => navItemMatchesQuery(item, trimmedSearch))
    : navItems
  const visibleItems = hasSearch ? matchingItems : navItems
  const menuItems = visibleItems.filter((item) => item.key !== "configuracion")
  const configItems = visibleItems.filter((item) => item.key === "configuracion")

  function goToItem(item: AdminNavItem) {
    setSearchQuery("")
    router.push(item.url)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    if (matchingItems.length === 0) return
    e.preventDefault()
    goToItem(matchingItems[0])
  }

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4">
        <DashboardBrand
          studioName={studioName}
          logoUrl={logoUrl}
          href="/"
          className="mb-4 border-b border-border pb-4"
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            type="search"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 h-9 bg-background"
          />
          {hasSearch ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
              {matchingItems.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
              ) : (
                matchingItems.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => goToItem(item)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{item.title}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent data-tour="sidebar-nav" className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            {hasSearch && matchingItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Sin resultados para &quot;{trimmedSearch}&quot;</p>
            ) : null}
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  pathname === item.url ||
                  (item.url !== routes.dashboard && pathname.startsWith(item.url))
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        onClick={() => setSearchQuery("")}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          hasSearch &&
                            !isActive &&
                            "bg-accent/60 text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-xs bg-primary/10 text-primary"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
            {configItems.length > 0 && !hasSearch ? (
              <div className="mt-auto border-t border-border pt-2">
                <SidebarMenu>
                  {configItems.map((item) => {
                    const isActive =
                      pathname === item.url || pathname.startsWith(`${item.url}/`)
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link
                            href={item.url}
                            onClick={() => setSearchQuery("")}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </div>
            ) : null}
            {hasSearch
              ? configItems.map((item) => {
                  const isActive =
                    pathname === item.url || pathname.startsWith(`${item.url}/`)
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={item.url}
                          onClick={() => setSearchQuery("")}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            !isActive && "bg-accent/60 text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground">v1.0</div>
      </SidebarFooter>
    </Sidebar>
  )
}
