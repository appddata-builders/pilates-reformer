"use client"

import { Check, X } from "lucide-react"
import { checkPassword } from "@/lib/password-rules"

/**
 * Qué reglas cumple la contraseña mientras se escribe. Con `confirm` agrega
 * "las contraseñas coinciden", como el registro de refautomex.
 */
export function PasswordChecklist(props: { password: string; confirm?: string }) {
  const items = checkPassword(props.password)
  if (props.confirm !== undefined) {
    items.push({
      key: "same",
      label: "Las contraseñas coinciden",
      ok: props.password !== "" && props.password === props.confirm,
    })
  }

  return (
    <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-live="polite">
      {items.map((item) => (
        <li
          key={item.key}
          className={`flex items-center gap-1.5 ${item.ok ? "text-green-700" : "text-muted-foreground"}`}
        >
          {item.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {item.label}
            <span className="sr-only">{item.ok ? " (cumple)" : " (falta)"}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
