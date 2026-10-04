"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/shared/ui/input"
import { PasswordChecklist } from "@/components/features/auth/password-checklist"

/**
 * Campo de contraseña con su lista de reglas. Guarda su propio valor, así que
 * dentro de un diálogo se limpia solo al cerrarlo.
 */
export function PasswordInput(props: { id: string; name?: string; autoComplete?: string }) {
  const [value, setValue] = useState("")
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={props.id}
          name={props.name ?? "password"}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={props.autoComplete ?? "new-password"}
          required
          maxLength={128}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <PasswordChecklist password={value} />
    </div>
  )
}
