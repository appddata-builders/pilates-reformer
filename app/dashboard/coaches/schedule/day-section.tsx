"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shared/ui/collapsible"

/** Un día del horario. Arranca abierto sólo el de hoy; el resto se abre al hacer clic. */
export function DaySection(props: {
  dayName: string
  dayShort: string
  classCount: number
  isToday: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(props.isToday)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`overflow-hidden rounded-xl border ${
        props.isToday ? "border-primary/40 bg-primary/[0.03]" : "bg-card"
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
        <h2 className="text-base font-semibold">{props.dayName}</h2>
        {props.isToday ? (
          <Badge className="border-primary/30 bg-primary/10 text-xs text-primary">Hoy</Badge>
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
