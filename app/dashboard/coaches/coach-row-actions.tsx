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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import { useRouter } from "next/navigation"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { ConfirmRemoveDialog } from "@/components/features/admin/confirm-remove-dialog"
import { ResetPasswordControl } from "@/components/features/admin/reset-password-control"
import { ChangeRoleControl } from "@/components/features/admin/change-role-control"
import { ALUMNO_ROLE_LABEL, COACH_ROLE_LABEL } from "@/lib/user-role"
import {
  deleteCoachAction,
  resetCoachPasswordAction,
  toggleCoachEnabledAction,
  updateCoachAction,
  type ActionState,
} from "./actions"

const initial: ActionState = { success: false }

export type CoachRowData = {
  id: string
  name: string
  email: string
  phone: string | null
  enabled: boolean
}

export function CoachRowActions(props: { coach: CoachRowData }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [editState, editAction, editPending] = useActionState(updateCoachAction, initial)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleCoachEnabledAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCoachAction, initial)

  useEffect(() => {
    if (editState.success) setEditOpen(false)
  }, [editState.success])

  useEffect(() => {
    if (deleteState.success) {
      setDeleteOpen(false)
      router.refresh()
    }
  }, [deleteState.success, router])

  const isEnabled = props.coach.enabled !== false

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
              title="¿Inhabilitar este coach?"
              description={`${props.coach.name} no podrá iniciar sesión hasta que lo habilites de nuevo.`}
              confirmLabel="Sí, inhabilitar"
              clientFormAction={toggleAction}
              hiddenFields={[
                { name: "id", value: props.coach.id },
                { name: "enabled", value: "false" },
              ]}
              pending={togglePending}
            />
          </>
        ) : (
          <form action={toggleAction}>
            <input type="hidden" name="id" value={props.coach.id} />
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
          userId={props.coach.id}
          userLabel={props.coach.name}
          resetAction={resetCoachPasswordAction}
        />
        <ChangeRoleControl
          userId={props.coach.id}
          userLabel={props.coach.name}
          currentRole="coach"
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
            <DialogTitle>Editar coach</DialogTitle>
          </DialogHeader>
          <form action={editAction} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="id" value={props.coach.id} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor={`edit-coach-name-${props.coach.id}`}>Nombre completo</Label>
              <Input
                id={`edit-coach-name-${props.coach.id}`}
                name="name"
                required
                minLength={2}
                defaultValue={props.coach.name}
              />
              {editState.fieldErrors?.name ? (
                <p className="text-destructive text-sm">{editState.fieldErrors.name[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-coach-email-${props.coach.id}`}>Correo</Label>
              <Input
                id={`edit-coach-email-${props.coach.id}`}
                name="email"
                type="email"
                required
                defaultValue={props.coach.email}
              />
              {editState.fieldErrors?.email ? (
                <p className="text-destructive text-sm">{editState.fieldErrors.email[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-coach-phone-${props.coach.id}`}>Teléfono (WhatsApp)</Label>
              <Input
                id={`edit-coach-phone-${props.coach.id}`}
                name="phone"
                type="tel"
                defaultValue={props.coach.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-coach-role-${props.coach.id}`}>Rol</Label>
              <select
                id={`edit-coach-role-${props.coach.id}`}
                name="role"
                defaultValue="coach"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="coach">{COACH_ROLE_LABEL}</option>
                <option value="alumno">{ALUMNO_ROLE_LABEL}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Al guardarlo como {ALUMNO_ROLE_LABEL} pasa a la lista de Usuarios.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-coach-enabled-${props.coach.id}`}>Acceso al panel</Label>
              <select
                id={`edit-coach-enabled-${props.coach.id}`}
                name="enabled"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue={isEnabled ? "true" : "false"}
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
            <AlertDialogTitle>¿Borrar este coach?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta de {props.coach.name} ({props.coach.email}). Las clases
              asignadas quedarán sin instructor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.error ? (
            <p className="text-destructive text-sm px-6">{deleteState.error}</p>
          ) : null}
          <form action={deleteAction}>
            <input type="hidden" name="id" value={props.coach.id} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={deletePending}>
                Cancelar
              </AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                className="text-white"
                disabled={deletePending}
              >
                {deletePending ? "Borrando..." : "Borrar"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
