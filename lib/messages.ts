function replaceToken(template: string, key: string, value: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi")
  return template.replace(pattern, value)
}

export function interpolateMessage(
  template: string,
  ctx: {
    nombre?: string
    plan?: string
    estudio?: string
    fecha?: string
    monto?: string
    concepto?: string
    metodo?: string
  },
): string {
  let out = template
  out = replaceToken(out, "nombre", ctx.nombre ?? "")
  out = replaceToken(out, "plan", ctx.plan ?? "")
  out = replaceToken(out, "estudio", ctx.estudio ?? "")
  out = replaceToken(out, "fecha", ctx.fecha ?? "")
  // El ID ST ya no existe; las plantillas guardadas antes pueden traer el token.
  out = replaceToken(out, "displayId", "")
  out = replaceToken(out, "monto", ctx.monto ?? "")
  out = replaceToken(out, "concepto", ctx.concepto ?? "")
  out = replaceToken(out, "metodo", ctx.metodo ?? "")
  return out
}
