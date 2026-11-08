"use client"

import nextDynamic from "next/dynamic"

const CalendarClient = nextDynamic(
  () => import("./CalendarClient").then((m) => m.CalendarClient),
  { ssr: false },
)

export function CalendarShell(props: { canManage: boolean }) {
  return <CalendarClient canManage={props.canManage} />
}
