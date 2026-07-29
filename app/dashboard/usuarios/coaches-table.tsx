"use client"

import { useState } from "react"
import { Search } from "lucide-react"
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
import { COACH_ROLE_LABEL } from "@/lib/user-role"
import { CoachRowActions } from "@/app/dashboard/coaches/coach-row-actions"

export type CoachTableRow = {
  id: string
  name: string
  email: string
  phone: string | null
  enabled: boolean
  classesThisMonth: number
  activeSlots: number
}

function rowMatchesSearch(row: CoachTableRow, query: string) {
  return (
    row.name.toLowerCase().includes(query) ||
    row.email.toLowerCase().includes(query) ||
    (row.phone ?? "").toLowerCase().includes(query)
  )
}

export function CoachesTable(props: { rows: CoachTableRow[]; canManage: boolean }) {
  const [searchQuery, setSearchQuery] = useState("")
  const q = searchQuery.trim().toLowerCase()
  const visibleRows = q === "" ? props.rows : props.rows.filter((row) => rowMatchesSearch(row, q))
  const columnCount = props.canManage ? 7 : 6

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4 space-y-2">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono…"
            className="pl-9"
            aria-label="Buscar coaches"
          />
        </div>
        {q !== "" ? (
          <p className="text-sm text-muted-foreground">
            {visibleRows.length} de {props.rows.length} coaches
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="text-muted-foreground font-normal text-sm">Nombre</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Correo</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Rol</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Clases este mes</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Horarios activos</TableHead>
            <TableHead className="text-muted-foreground font-normal text-sm">Acceso</TableHead>
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
                Sin coaches registrados. Cambia el rol de un usuario para crear el primero.
              </TableCell>
            </TableRow>
          ) : visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                Ningún coach coincide con la búsqueda
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-b last:border-0 ${!row.enabled ? "opacity-60" : ""}`}
              >
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{COACH_ROLE_LABEL}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.classesThisMonth}</TableCell>
                <TableCell className="text-muted-foreground">{row.activeSlots}</TableCell>
                <TableCell>
                  {row.enabled ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Inhabilitado</Badge>
                  )}
                </TableCell>
                {props.canManage ? (
                  <TableCell className="text-right">
                    <CoachRowActions
                      coach={{
                        id: row.id,
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
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
