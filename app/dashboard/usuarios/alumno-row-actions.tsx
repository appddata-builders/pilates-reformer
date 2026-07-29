"use client"

import { useActionState, useEffect, useState } from "react"
import { Ban, CircleCheck, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import { Textarea } from "@/components/shared/ui/textarea"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { ConfirmRemoveDialog } from "@/components/features/admin/confirm-remove-dialog"
import { ResetPasswordControl } from "@/components/features/admin/reset-password-control"
import { ChangeRoleControl } from "@/components/features/admin/change-role-control"
import { ALUMNO_ROLE_LABEL, COACH_ROLE_LABEL } from "@/lib/user-role"
import {
  deleteAlumnoAction,
  resetAlumnoPasswordAction,
  toggleUserEnabledAction,
  updateAlumnoAction,
  type ActionState,
} from "./actions"
import { PlanPickerFields, type PlanOption } from "./plan-picker-fields"

const initial: ActionState = { success: false }

export type AlumnoRowData = {
  id: string
  name: string
  email: string
  phone: string | null
  birthdate: string | null
  notes: string | null
  displayId: string | null
  planId: string
  billingCycle: string
  enabled: boolean
}

function birthdateForInput(birthdate: string | null): string {
  if (birthdate == null || birthdate.length < 8) return ""
  const normalized = birthdate.match(/^\d{4}-\d{2}-\d{2}/)
  if (normalized) return normalized[0]
  return birthdate
}

export function AlumnoRowActions(props: { alumno: AlumnoRowData; planes: PlanOption[] }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [editState, editAction, editPending] = useActionState(updateAlumnoAction, initial)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleUserEnabledAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAlumnoAction, initial)

  useEffect(() => {
    if (editState.success) setEditOpen(false)
  }, [editState.success])

  useEffect(() => {
    if (deleteState.success) setDeleteOpen(false)
  }, [deleteState.success])

  useEffect(() => {
    if (toggleState.success) {
      setEditOpen(false)
      setDisableOpen(false)
    }
  }, [toggleState.success])

  const displayLabel = props.alumno.displayId ?? props.alumno.name
  const isEnabled = props.alumno.enabled !== false

  return (
    <>
      <DbActionSuccessEffect success={editState.success} kind="update" />
      <DbActionSuccessEffect success={toggleState.success} kind="update" />
      <DbActionSuccessEffect success={deleteState.success} kind="delete" />
      <div className="flex items-center justify-end gap-1">
        {isEnabled ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={togglePending}
              onClick={() => setDisableOpen(true)}
            >
              <Ban className="h-4 w-4" />
              <span className="sr-only">Inhabilitar</span>
            </Button>
            <ConfirmRemoveDialog
              open={disableOpen}
              onOpenChange={setDisableOpen}
              title="¿Inhabilitar este usuario?"
              description={`${displayLabel} no podrá iniciar sesión hasta que lo habilites de nuevo.`}
              confirmLabel="Sí, inhabilitar"
              clientFormAction={toggleAction}
              hiddenFields={[
                { name: "id", value: props.alumno.id },
                { name: "enabled", value: "false" },
              ]}
              pending={togglePending}
            />
          </>
        ) : (
          <form action={toggleAction}>
            <input type="hidden" name="id" value={props.alumno.id} />
            <input type="hidden" name="enabled" value="true" />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-700 hover:text-green-700 hover:bg-green-100"
              disabled={togglePending}
            >
              <CircleCheck className="h-4 w-4" />
              <span className="sr-only">Habilitar</span>
            </Button>
          </form>
        )}
        <ResetPasswordControl
          userId={props.alumno.id}
          userLabel={displayLabel}
          resetAction={resetAlumnoPasswordAction}
        />
        <ChangeRoleControl
          userId={props.alumno.id}
          userLabel={displayLabel}
          currentRole="alumno"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Editar</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Borrar</span>
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form action={editAction} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="id" value={props.alumno.id} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor={`edit-name-${props.alumno.id}`}>Nombre completo</Label>
              <Input
                id={`edit-name-${props.alumno.id}`}
                name="name"
                defaultValue={props.alumno.name}
                required
              />
              {editState.fieldErrors?.name ? (
                <p className="text-destructive text-sm">{editState.fieldErrors.name[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-email-${props.alumno.id}`}>Correo</Label>
              <Input
                id={`edit-email-${props.alumno.id}`}
                name="email"
                type="email"
                defaultValue={props.alumno.email}
                required
              />
              {editState.fieldErrors?.email ? (
                <p className="text-destructive text-sm">{editState.fieldErrors.email[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-phone-${props.alumno.id}`}>Teléfono (WhatsApp)</Label>
              <Input
                id={`edit-phone-${props.alumno.id}`}
                name="phone"
                type="tel"
                defaultValue={props.alumno.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-birthdate-${props.alumno.id}`}>Fecha de cumpleaños</Label>
              <Input
                id={`edit-birthdate-${props.alumno.id}`}
                name="birthdate"
                type="date"
                defaultValue={birthdateForInput(props.alumno.birthdate)}
              />
              {editState.fieldErrors?.birthdate ? (
                <p className="text-destructive text-sm">{editState.fieldErrors.birthdate[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-notes-${props.alumno.id}`}>Notas</Label>
              <Textarea
                id={`edit-notes-${props.alumno.id}`}
                name="notes"
                rows={3}
                defaultValue={props.alumno.notes ?? ""}
              />
            </div>
            <PlanPickerFields
              idPrefix={`edit-${props.alumno.id}`}
              planes={props.planes}
              defaultPlanId={props.alumno.planId}
              defaultBillingCycle={props.alumno.billingCycle}
              showStartDate
            />
            <div className="space-y-2">
              <Label htmlFor={`edit-role-${props.alumno.id}`}>Rol</Label>
              <select
                id={`edit-role-${props.alumno.id}`}
                name="role"
                defaultValue="alumno"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="alumno">{ALUMNO_ROLE_LABEL}</option>
                <option value="coach">{COACH_ROLE_LABEL}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Al guardarlo como {COACH_ROLE_LABEL} pasa a la lista de Coaches.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-enabled-${props.alumno.id}`}>Acceso al panel</Label>
              <select
                id={`edit-enabled-${props.alumno.id}`}
                name="enabled"
                defaultValue={isEnabled ? "true" : "false"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="true">Habilitado</option>
                <option value="false">Inhabilitado</option>
              </select>
            </div>
              {editState.error ? (
                <p className="text-destructive text-sm">{editState.error}</p>
              ) : null}
              {toggleState.error ? (
                <p className="text-destructive text-sm">{toggleState.error}</p>
              ) : null}
            </div>
            <div className="shrink-0 border-t px-6 py-4">
              <Button type="submit" className="w-full" disabled={editPending}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro de {displayLabel} ({props.alumno.name}), incluyendo
              reservas, pagos y planes asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.error ? (
            <p className="text-destructive text-sm px-6">{deleteState.error}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancelar</AlertDialogCancel>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={props.alumno.id} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={deletePending}
              >
                {deletePending ? "Borrando..." : "Borrar"}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
