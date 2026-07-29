"use client"

import { useActionState, useEffect, useState } from "react"
import { Eye, EyeOff, UserPlus } from "lucide-react"
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
import { createAlumnoAction, type ActionState } from "./actions"
import { PlanPickerFields, type PlanOption } from "./plan-picker-fields"

const initial: ActionState = { success: false }

export function NewAlumnoDialog(props: { planes: PlanOption[] }) {
  const [open, setOpen] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [state, action, pending] = useActionState(createAlumnoAction, initial)

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
          Alumn@
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" name="name" required />
            {state.fieldErrors?.name ? (
              <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required />
            {state.fieldErrors?.email ? (
              <p className="text-destructive text-sm">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={passwordVisible ? "text" : "password"}
                minLength={6}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {passwordVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {state.fieldErrors?.password ? (
              <p className="text-destructive text-sm">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (WhatsApp)</Label>
            <Input id="phone" name="phone" type="tel" placeholder="5512345678" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthdate">Fecha de cumpleaños</Label>
            <Input id="birthdate" name="birthdate" type="date" required />
            {state.fieldErrors?.birthdate ? (
              <p className="text-destructive text-sm">{state.fieldErrors.birthdate[0]}</p>
            ) : null}
          </div>
          <PlanPickerFields
            idPrefix="new"
            planes={props.planes}
            showStartDate
          />
          {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          {state.success && state.displayId ? (
            <p className="text-sm text-green-700">
              Usuario creado. ID asignado: <span className="font-mono">{state.displayId}</span>
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            Registrar usuario
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
