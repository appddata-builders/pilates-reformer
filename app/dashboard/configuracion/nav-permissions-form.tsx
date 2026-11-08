"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/shared/ui/button"
import { Checkbox } from "@/components/shared/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shared/ui/table"
import { mainNavItems } from "@/modules/admin/nav-items"
import {
  CONFIGURABLE_ROLES,
  ROLE_LABELS,
  type ConfigurableRole,
  type NavPermissionsMap,
} from "@/lib/nav-permissions"
import { useDbActionFeedback } from "@/components/features/admin/db-action-feedback"
import { saveNavPermissionsAction } from "./actions"

export function NavPermissionsForm(props: {
  permissions: NavPermissionsMap
  /** Root ve y cambia las 4 columnas; admin sólo las de coach y alumno. */
  editableRoles: ConfigurableRole[]
}) {
  const columns = CONFIGURABLE_ROLES.filter((role) => props.editableRoles.includes(role))
  const editsAllRoles = columns.length === CONFIGURABLE_ROLES.length
  const { showDbActionFeedback } = useDbActionFeedback()
  const router = useRouter()
  const [permissions, setPermissions] = useState<NavPermissionsMap>(props.permissions)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function setCell(navKey: string, role: ConfigurableRole, allowed: boolean) {
    setPermissions((prev) => {
      const row = prev[navKey]
      if (row == null) return prev
      return {
        ...prev,
        [navKey]: {
          ...row,
          [role]: allowed,
        },
      }
    })
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const res = await saveNavPermissionsAction(permissions)
    setSaving(false)
    if (res.success) {
      showDbActionFeedback("update")
      setMessage("Permisos guardados")
      router.refresh()
    } else {
      setMessage(res.error ?? "No se pudieron guardar los permisos")
    }
  }

  return (
    <div className="flex flex-col gap-4 py-1">
      <p className="text-sm text-muted-foreground py-1">
        {editsAllRoles
          ? "Marca qué secciones del menú lateral puede ver cada perfil. Tras reiniciar la base (seed), ningún perfil tiene permisos hasta guardar aquí. Root siempre puede entrar a Dashboard y Configuración aunque no estén marcados."
          : "Marca qué secciones del menú lateral pueden ver los coaches y los alumnos. Los coaches, además, podrán hacer cambios en las secciones que tengan marcadas."}
      </p>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="py-1 text-muted-foreground font-normal text-sm min-w-[160px]">
                Sección
              </TableHead>
              {columns.map((role) => (
                <TableHead
                  key={role}
                  className="py-1 text-muted-foreground font-normal text-sm text-center w-[88px]"
                >
                  {ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {mainNavItems.map((item) => {
              const row = permissions[item.key]
              if (row == null) return null
              const rootLocked = item.key === "dashboard" || item.key === "configuracion"
              return (
                <TableRow key={item.key} className="border-b last:border-0">
                  <TableCell className="py-1 font-medium text-sm">{item.title}</TableCell>
                  {columns.map((role) => {
                    const locked = role === "root" && rootLocked
                    return (
                      <TableCell key={role} className="text-center py-1">
                        <Checkbox
                          checked={locked ? true : row[role]}
                          disabled={locked}
                          onCheckedChange={(checked) => {
                            if (locked) return
                            setCell(item.key, role, checked === true)
                          }}
                          aria-label={`${item.title} — ${ROLE_LABELS[role]}`}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {message ? <p className="text-sm text-muted-foreground py-1">{message}</p> : null}
      <div className="py-1 pt-4">
        <Button type="button" onClick={() => void handleSave()} disabled={saving} className="px-6 py-1 min-h-[calc(2.25rem+4px)]">
          {saving ? "Guardando..." : "Guardar permisos de menú"}
        </Button>
      </div>
    </div>
  )
}
