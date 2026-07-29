"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs"
import type { ListSortDir } from "@/lib/list-sort"
import { ALUMNO_ROLE_LABEL, COACH_ROLE_LABEL } from "@/lib/user-role"
import { UsuariosTable, type UsuarioTableRow } from "./usuarios-table"
import { CoachesTable, type CoachTableRow } from "./coaches-table"
import type { PlanOption } from "./plan-picker-fields"

/** Alumn@s y coaches son la misma lista de usuarios, separada por rol. */
export function UsuariosClient(props: {
  alumnos: UsuarioTableRow[]
  coaches: CoachTableRow[]
  planes: PlanOption[]
  sort: string
  dir: ListSortDir
  sortQuery: Record<string, string | undefined>
  canManage: boolean
  initialTab: "alumnos" | "coaches"
}) {
  const [tab, setTab] = useState<string>(props.initialTab)

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1 sm:w-fit">
        <TabsTrigger value="alumnos" className="px-3 py-1.5 text-sm">
          {ALUMNO_ROLE_LABEL}s
          <span className="text-muted-foreground ml-1 text-xs">({props.alumnos.length})</span>
        </TabsTrigger>
        <TabsTrigger value="coaches" className="px-3 py-1.5 text-sm">
          {COACH_ROLE_LABEL}es
          <span className="text-muted-foreground ml-1 text-xs">({props.coaches.length})</span>
        </TabsTrigger>
      </TabsList>

      {tab === "alumnos" ? (
        <UsuariosTable
          rows={props.alumnos}
          planes={props.planes}
          sort={props.sort}
          dir={props.dir}
          sortQuery={props.sortQuery}
          canManage={props.canManage}
        />
      ) : (
        <CoachesTable rows={props.coaches} canManage={props.canManage} />
      )}
    </Tabs>
  )
}
