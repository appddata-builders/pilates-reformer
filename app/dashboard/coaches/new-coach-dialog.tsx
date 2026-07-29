"use client"

import { useActionState, useEffect, useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shared/ui/dialog"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { createCoachAction, type ActionState } from "./actions"

const initial: ActionState = { success: false }

export function NewCoachDialog() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createCoachAction, initial)

  useEffect(() => {
    if (state.success) setOpen(false)
  }, [state.success])

  return (
    <>
      <DbActionSuccessEffect success={state.success} kind="create" />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Coach
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo coach</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coach-name">Nombre completo</Label>
            <Input id="coach-name" name="name" required minLength={2} />
            {state.fieldErrors?.name ? (
              <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-email">Correo</Label>
            <Input id="coach-email" name="email" type="email" required />
            {state.fieldErrors?.email ? (
              <p className="text-destructive text-sm">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-password">Contraseña temporal</Label>
            <Input id="coach-password" name="password" type="password" required minLength={6} />
            {state.fieldErrors?.password ? (
              <p className="text-destructive text-sm">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-phone">Teléfono (WhatsApp)</Label>
            <Input id="coach-phone" name="phone" type="tel" />
          </div>
          {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            Registrar coach
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
