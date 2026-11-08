"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shared/ui/collapsible"

/**
 * Un día del horario con su fecha. Arranca abierto sólo el que indica la página
 * (hoy, o el siguiente día con clases); el resto se abre al hacer clic. Los días
 * que ya pasaron se marcan como de solo lectura.
 */
export function DaySection(props: {
  dayName: string
  dayShort: string
  /** Ej. "9 de noviembre". */
  dateLabel: string
  classCount: number
  isToday: boolean
  isPastDay: boolean
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(props.defaultOpen)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`overflow-hidden rounded-xl border ${
        props.isToday
          ? "border-primary/40 bg-primary/[0.03]"
          : props.isPastDay
            ? "bg-muted/30"
            : "bg-card"
      }`}
    >
      <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
            props.isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {props.dayShort}
        </span>
        <h2 className="text-base font-semibold">
          {props.dayName}{" "}
          <span className="font-normal text-muted-foreground">{props.dateLabel}</span>
        </h2>
        {props.isToday ? (
          <Badge className="border-primary/30 bg-primary/10 text-xs text-primary">Hoy</Badge>
        ) : props.isPastDay ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Solo lectura
          </Badge>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {props.classCount} {props.classCount === 1 ? "clase" : "clases"}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>{props.children}</CollapsibleContent>
    </Collapsible>
  )
}
