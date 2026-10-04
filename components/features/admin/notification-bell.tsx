"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu"
import { Badge } from "@/components/shared/ui/badge"

type Row = {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

function iconForType(type: string) {
  if (type === "welcome") return "✉"
  if (type === "birthday") return "🎂"
  if (type === "last_class") return "⚠"
  if (type === "plan_expiry") return "📅"
  if (type === "plan_requested") return "🧾"
  if (type === "coach_schedule") return "📋"
  return "•"
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function relativeLabel(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "hace un momento"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} día(s)`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)

  async function refresh() {
    const res = await fetch("/api/notifications", { credentials: "include" })
    if (!res.ok) return
    const data = (await res.json()) as { unreadCount: number; items: Row[] }
    setUnreadCount(data.unreadCount)
    setItems(data.items)
    setLoaded(true)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST", credentials: "include" })
    await refresh()
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notificaciones</span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" type="button" onClick={() => void markAllRead()}>
            Marcar todo como leído
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!loaded ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Sin notificaciones</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 whitespace-normal">
              <div className="flex w-full items-start justify-between gap-2">
                <div className="text-sm font-medium">
                  <span className="mr-2">{iconForType(n.type)}</span>
                  {n.title}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{relativeLabel(n.createdAt)}</span>
              </div>
              <div className="text-xs text-muted-foreground">{truncate(n.body, 60)}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
