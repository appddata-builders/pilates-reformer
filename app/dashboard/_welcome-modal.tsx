"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog"
import { Button } from "@/components/shared/ui/button"
import { interpolateMessage } from "@/lib/messages"
import { DEFAULT_STUDIO_NAME } from "@/lib/studio-branding-constants"
import { markWelcomeShownAction } from "./_actions"

export function WelcomeModal(props: {
  template: string
  userName: string
}) {
  const [open, setOpen] = useState(true)
  const [pending, startTransition] = useTransition()

  const message = interpolateMessage(props.template, {
    nombre: props.userName,
    estudio: DEFAULT_STUDIO_NAME,
    fecha: new Date().toLocaleDateString("es-MX"),
  })

  function handleClose() {
    startTransition(async () => {
      await markWelcomeShownAction()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Bienvenida</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed max-h-[60vh] overflow-y-auto">
          {message}
        </div>
        <Button onClick={handleClose} disabled={pending} className="w-full mt-2">
          {pending ? "Guardando..." : "¡Entendido, empecemos!"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
