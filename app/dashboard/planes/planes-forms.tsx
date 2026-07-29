"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/shared/ui/table"
import { Badge } from "@/components/shared/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/shared/ui/dialog"
import { Label } from "@/components/shared/ui/label"
import { Input } from "@/components/shared/ui/input"
import { useDbActionFeedback } from "@/components/features/admin/db-action-feedback"
import { ConfirmRemoveDialog } from "@/components/features/admin/confirm-remove-dialog"
import { DbActionForm } from "@/components/features/admin/db-action-form"
import {
  formatPlanIncludes,
  formatPlanTypeLabel,
  formatPublicPlanPrice,
  planPromoBadge,
} from "@/lib/site/plans"
import {
  createPlanAction,
  deletePlanAction,
  togglePlanPublicAction,
  updatePlanAction,
} from "./actions"

export type PlanRow = {
  id: string
  name: string
  planType: string
  daysPerWeek: number
  totalClasses: number | null
  priceMxn: number
  durationDays: number
  isActive: boolean
  isPublic: boolean
}

export function PlanesFormsClient(props: { planes: PlanRow[]; embedded?: boolean }) {
  const { showDbActionFeedback } = useDbActionFeedback()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null)
  const [deletePlan, setDeletePlan] = useState<PlanRow | null>(null)

  const [createPlanType, setCreatePlanType] = useState<string>("class_pack")
  const [editPlanType, setEditPlanType] = useState<string>("class_pack")
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (editPlan != null) setEditPlanType(editPlan.planType)
  }, [editPlan])

  async function handleCreate(formData: FormData) {
    setCreateError(null)
    const res = await createPlanAction({ success: false }, formData)
    if (res.success) {
      showDbActionFeedback("create")
      setCreateOpen(false)
      router.refresh()
      return
    }
    setCreateError(res.error ?? "No se pudo crear el plan")
  }

  async function handleEdit(formData: FormData) {
    setEditError(null)
    const res = await updatePlanAction({ success: false }, formData)
    if (res.success) {
      showDbActionFeedback("update")
      setEditOpen(false)
      setEditPlan(null)
      router.refresh()
      return
    }
    setEditError(res.error ?? "No se pudo guardar el plan")
  }

  return (
    <div className={props.embedded ? "space-y-6" : "p-6 space-y-6"}>
      <div className="flex items-start justify-between gap-4">
        {props.embedded ? (
          <div>
            <p className="text-sm text-muted-foreground">
              {props.planes.length} planes configurados. Los cambios aplican en la página pública y al registrar usuarios.
            </p>
          </div>
        ) : (
          <div data-tour="page-header">
            <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
            <p className="text-sm text-muted-foreground">
              {props.planes.length} planes configurados. Los cambios se reflejan en la página pública (visibles) y al registrar usuarios.
            </p>
          </div>
        )}
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) setCreateError(null)
          }}
        >
          <DialogTrigger asChild>
            <Button data-tour="page-actions" className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo plan</DialogTitle>
            </DialogHeader>
            <form action={(fd) => void handleCreate(fd)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Nombre</Label>
                <Input id="create-name" name="name" required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-planType">Tipo de plan</Label>
                <select
                  id="create-planType"
                  name="planType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createPlanType}
                  onChange={(e) => setCreatePlanType(e.target.value)}
                >
                  <option value="class_pack">Paquete de clases</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              {createPlanType === "monthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="create-daysPerWeek">Días por semana</Label>
                  <Input
                    id="create-daysPerWeek"
                    name="daysPerWeek"
                    type="number"
                    min={1}
                    max={7}
                    defaultValue={3}
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="daysPerWeek" value="0" />
              )}
              {createPlanType !== "monthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="create-totalClasses">Total de clases</Label>
                  <Input
                    id="create-totalClasses"
                    name="totalClasses"
                    type="number"
                    min={1}
                    defaultValue={8}
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="totalClasses" value="" />
              )}
              <div className="space-y-2">
                <Label htmlFor="create-priceMxn">Precio (MXN)</Label>
                <Input id="create-priceMxn" name="priceMxn" type="number" min={1} step="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-durationDays">Duración (días)</Label>
                <Input id="create-durationDays" name="durationDays" type="number" min={1} defaultValue={30} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-isPublic">Visibilidad pública</Label>
                <p className="text-xs text-muted-foreground">
                  Si lo ocultas, no aparece en la página pública de compra. Quien ya lo tiene lo sigue usando.
                </p>
                <select
                  id="create-isPublic"
                  name="isPublic"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="true"
                >
                  <option value="true">Mostrar</option>
                  <option value="false">Ocultar</option>
                </select>
              </div>
              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div data-tour="page-table" className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-muted-foreground font-normal text-sm">Nombre</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Tipo</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Días/sem</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Clases</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Precio</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Duración</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Público</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Estado</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm text-right w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.planes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Sin planes configurados
                </TableCell>
              </TableRow>
            ) : (
              props.planes.map((plan) => (
                <TableRow key={plan.id} className="border-b last:border-0">
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{plan.name}</span>
                      {planPromoBadge(plan.id) ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          {planPromoBadge(plan.id)}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatPlanTypeLabel(plan.planType)}</TableCell>
                  <TableCell>{plan.planType === "monthly" ? `${plan.daysPerWeek}x sem` : "—"}</TableCell>
                  <TableCell>
                    {formatPlanIncludes(
                      plan.planType,
                      plan.totalClasses,
                      false,
                      plan.daysPerWeek,
                    )}
                  </TableCell>
                  <TableCell>
                    {formatPublicPlanPrice(plan.planType, plan.priceMxn)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{plan.durationDays} días</TableCell>
                  <TableCell>
                    {plan.isPublic
                      ? <Badge className="bg-blue-100 text-blue-700 border-blue-200">Visible</Badge>
                      : <Badge variant="secondary">Oculto</Badge>}
                  </TableCell>
                  <TableCell>
                    {plan.isActive
                      ? <Badge className="bg-green-100 text-green-700 border-green-200">Activo</Badge>
                      : <Badge variant="secondary">Inactivo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DbActionForm action={togglePlanPublicAction} kind="update" className="inline-flex">
                        <input type="hidden" name="id" value={plan.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={plan.isPublic ? "Ocultar en página pública" : "Mostrar en página pública"}
                        >
                          {plan.isPublic ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {plan.isPublic ? "Ocultar" : "Mostrar"}
                          </span>
                        </Button>
                      </DbActionForm>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditPlan(plan)
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletePlan(plan)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Borrar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => {
        setEditOpen(v)
        if (!v) {
          setEditPlan(null)
          setEditError(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar plan</DialogTitle>
          </DialogHeader>
          {editPlan != null ? (
            <form action={(fd) => void handleEdit(fd)} className="space-y-4">
              <input type="hidden" name="id" value={editPlan.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" name="name" required minLength={2} defaultValue={editPlan.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-planType">Tipo de plan</Label>
                <select
                  id="edit-planType"
                  name="planType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editPlanType}
                  onChange={(e) => setEditPlanType(e.target.value)}
                >
                  <option value="class_pack">Paquete de clases</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              {editPlanType === "monthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-daysPerWeek">Días por semana</Label>
                  <Input
                    id="edit-daysPerWeek"
                    name="daysPerWeek"
                    type="number"
                    min={1}
                    max={7}
                    defaultValue={editPlan.daysPerWeek}
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="daysPerWeek" value="0" />
              )}
              {editPlanType !== "monthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-totalClasses">Total de clases</Label>
                  <Input
                    id="edit-totalClasses"
                    name="totalClasses"
                    type="number"
                    min={1}
                    defaultValue={editPlan.totalClasses ?? 1}
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="totalClasses" value="" />
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-priceMxn">Precio (MXN)</Label>
                <Input
                  id="edit-priceMxn"
                  name="priceMxn"
                  type="number"
                  min={1}
                  step="1"
                  required
                  defaultValue={editPlan.priceMxn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-durationDays">Duración (días)</Label>
                <Input
                  id="edit-durationDays"
                  name="durationDays"
                  type="number"
                  min={1}
                  required
                  defaultValue={editPlan.durationDays}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-isPublic">Visibilidad pública</Label>
                <p className="text-xs text-muted-foreground">
                  Ocultar no desactiva el plan: las alumnas que ya lo tienen lo siguen usando.
                </p>
                <select
                  id="edit-isPublic"
                  name="isPublic"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editPlan.isPublic ? "true" : "false"}
                >
                  <option value="true">Mostrar</option>
                  <option value="false">Ocultar</option>
                </select>
              </div>
              {editError ? (
                <p className="text-sm text-destructive">{editError}</p>
              ) : null}
              <DialogFooter>
                <Button type="submit">Guardar cambios</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmRemoveDialog
        open={deletePlan != null}
        onOpenChange={(open) => {
          if (!open) setDeletePlan(null)
        }}
        title="¿Borrar este plan?"
        description={
          deletePlan != null
            ? `El plan "${deletePlan.name}" dejará de ofrecerse. Si nadie lo ha contratado se elimina por completo; si ya se vendió, se desactiva y no aparecerá para nuevas altas.`
            : ""
        }
        confirmLabel="Sí, borrar"
        feedbackKind="delete"
        serverAction={async (fd) => {
          const res = await deletePlanAction({ success: false }, fd)
          if (res.success) setDeletePlan(null)
          return res
        }}
        hiddenFields={
          deletePlan != null ? [{ name: "id", value: deletePlan.id }] : []
        }
      />
    </div>
  )
}
