"use client"

import { useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { SortableTableHead } from "@/components/features/admin/sortable-table-head"
import { Badge } from "@/components/shared/ui/badge"
import { Input } from "@/components/shared/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shared/ui/table"
import { routes } from "@/lib/routes"
import { buildSortHref } from "@/lib/list-sort"
import type { ListSortDir } from "@/lib/list-sort"
import { ALUMNO_ROLE_LABEL } from "@/lib/user-role"
import { AlumnoRowActions } from "./alumno-row-actions"
import type { PlanOption } from "./plan-picker-fields"

export type UsuarioTableRow = {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  birthdate: string | null
  displayId: string | null
  displayLabel: string
  enabled: boolean
  planId: string
  billingCycle: string
  planName: string | null
  planType: string | null
  classesRemaining: number | null
  isMonthly: boolean
  remaining: number | null
  hasSubscription: boolean
  renewalLabel: string
  showExpiryAlert: boolean
  birthdayToday: boolean
  birthdaySoon: boolean
}

function subscriptionColumnBadge(hasSubscription: boolean, userEnabled: boolean) {
  if (!userEnabled) {
    return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Inhabilitada</Badge>
  }
  if (!hasSubscription) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return <Badge className="bg-green-100 text-green-700 border-green-200">Activa</Badge>
}

function rowMatchesSearch(row: UsuarioTableRow, query: string) {
  const id = row.displayLabel.toLowerCase()
  const name = row.name.toLowerCase()
  const email = row.email.toLowerCase()
  const plan = (row.planName ?? "").toLowerCase()
  const phone = (row.phone ?? "").toLowerCase()
  return (
    id.includes(query) ||
    name.includes(query) ||
    email.includes(query) ||
    plan.includes(query) ||
    phone.includes(query)
  )
}

const ALUMNOS_DEFAULT_SORT = "displayId"

export function UsuariosTable(props: {
  rows: UsuarioTableRow[]
  planes: PlanOption[]
  sort: string
  dir: ListSortDir
  sortQuery: Record<string, string | undefined>
  canManage: boolean
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const q = searchQuery.trim().toLowerCase()
  const visibleRows = q === "" ? props.rows : props.rows.filter((row) => rowMatchesSearch(row, q))
  const columnCount = props.canManage ? 10 : 9

  return (
    <div data-tour="page-table" className="rounded-lg border bg-card">
      <div className="border-b p-4 space-y-2">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, ID, teléfono o plan…"
            className="pl-9"
            aria-label="Buscar alumnas"
          />
        </div>
        {q !== "" ? (
          <p className="text-sm text-muted-foreground">
            {visibleRows.length} de {props.rows.length} usuarios
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b">
            <SortableTableHead
              className="text-muted-foreground font-normal text-sm"
              href={buildSortHref(routes.usuarios, props.sort, "displayId", props.dir, props.sortQuery, { sort: ALUMNOS_DEFAULT_SORT, dir: "asc" })}
              active={props.sort === "displayId"}
              dir={props.dir}
            >
              ID
            </SortableTableHead>
            <SortableTableHead
              className="text-muted-foreground font-normal text-sm"
              href={buildSortHref(routes.usuarios, props.sort, "name", props.dir, props.sortQuery, { sort: ALUMNOS_DEFAULT_SORT, dir: "asc" })}
              active={props.sort === "name"}
              dir={props.dir}
            >
              Nombre completo
            </SortableTableHead>
            <SortableTableHead
              className="text-muted-foreground font-normal text-sm"
              href={buildSortHref(routes.usuarios, props.sort, "email", props.dir, props.sortQuery, { sort: ALUMNOS_DEFAULT_SORT, dir: "asc" })}
              active={props.sort === "email"}
              dir={props.dir}
            >
              Correo
            </SortableTableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Rol</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Plan activo</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Rest.</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Alertas</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Estado</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Renovación</TableHead>
            {props.canManage ? (
              <TableHead className="text-muted-foreground font-normal text-sm text-right">
                Acciones
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                Sin usuarios registrados
              </TableCell>
            </TableRow>
          ) : visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                Ningún usuario coincide con la búsqueda
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-b last:border-0 ${!row.enabled ? "opacity-60" : ""}`}
              >
                <TableCell className="text-muted-foreground text-sm font-mono">
                  <Link
                    className="underline underline-offset-2 hover:text-foreground"
                    href={routes.usuarioDetail(row.id)}
                  >
                    {row.displayLabel}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link className="hover:underline" href={routes.usuarioDetail(row.id)}>
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ALUMNO_ROLE_LABEL}</Badge>
                </TableCell>
                <TableCell>{row.planName ?? "—"}</TableCell>
                <TableCell>
                  {!row.hasSubscription ? (
                    "—"
                  ) : row.isMonthly ? (
                    <span className="text-sm text-muted-foreground">Mensual</span>
                  ) : row.remaining !== null && row.remaining <= 2 ? (
                    <Badge variant="destructive">{row.remaining}</Badge>
                  ) : (
                    <Badge variant="secondary">{row.remaining ?? 0}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.birthdayToday ? (
                    <Badge className="bg-sky-100 text-sky-800 border-sky-200">Cumple hoy</Badge>
                  ) : row.birthdaySoon ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">Cumple pronto</Badge>
                  ) : row.showExpiryAlert ? (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">3 días</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{subscriptionColumnBadge(row.hasSubscription, row.enabled)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.renewalLabel}</TableCell>
                {props.canManage ? (
                  <TableCell className="text-right">
                    <AlumnoRowActions
                      planes={props.planes}
                      alumno={{
                        id: row.id,
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        notes: row.notes,
                        birthdate: row.birthdate,
                        displayId: row.displayId,
                        planId: row.planId,
                        billingCycle: row.billingCycle,
                        enabled: row.enabled,
                      }}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
