"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserCog } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { changeUserRoleAction, type ChangeRoleState } from "@/app/dashboard/_role-actions"
import { manageableRoleLabel, type ManageableRole } from "@/lib/user-role"

const initial: ChangeRoleState = { success: false }

function describeChange(nextRole: ManageableRole, userLabel: string): string {
  if (nextRole === "coach") {
    return `${userLabel} pasará a ser Coach y dejará de aparecer en la lista de usuarios. Sus reservas y planes se conservan.`
  }
  return `${userLabel} pasará a ser ${manageableRoleLabel("alumno")} y se liberarán los horarios donde figura como instructor. Si no tenía ID de usuario, se le asignará uno.`
}

export function ChangeRoleControl(props: {
  userId: string
  userLabel: string
  currentRole: ManageableRole
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [state, formAction, pending] = useActionState(changeUserRoleAction, initial)

  const nextRole: ManageableRole = props.currentRole === "coach" ? "alumno" : "coach"

  useEffect(() => {
    if (state.success) {
      setConfirmOpen(false)
      router.refresh()
    }
  }, [state.success, router])

  return (
    <>
      <DbActionSuccessEffect success={state.success} kind="update" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setConfirmOpen(true)}
      >
        <UserCog className="h-4 w-4" />
        <span className="sr-only">Cambiar rol a {manageableRoleLabel(nextRole)}</span>
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Cambiar el rol a {manageableRoleLabel(nextRole)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {describeChange(nextRole, props.userLabel)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && !state.success ? (
            <p className="text-destructive text-sm px-6">{state.error}</p>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="id" value={props.userId} />
            <input type="hidden" name="role" value={nextRole} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancelar
              </AlertDialogCancel>
              <Button type="submit" disabled={pending}>
                {pending ? "Cambiando..." : `Sí, hacer ${manageableRoleLabel(nextRole)}`}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
