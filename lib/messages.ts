function replaceToken(template: string, key: string, value: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi")
  return template.replace(pattern, value)
}

/**
 * El ID ST ya no existe. Las plantillas guardadas antes pueden traer una línea
 * como "Tu ID es: {{displayId}}": se quita completa, no sólo el token. Si la
 * plantilla era esa sola línea, se quita nada más la frase del ID.
 */
function withoutDisplayId(template: string): string {
  const withoutLine = template
    .replace(/^.*\{\{\s*displayId\s*\}\}.*(\r?\n|$)/gim, "")
    .replace(/\n{3,}/g, "\n\n")
  if (withoutLine.trim() !== "") return withoutLine
  return template.replace(/,?\s*[^,.\n]*\{\{\s*displayId\s*\}\}/gi, "")
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
  let out = withoutDisplayId(template)
  out = replaceToken(out, "nombre", ctx.nombre ?? "")
  out = replaceToken(out, "plan", ctx.plan ?? "")
  out = replaceToken(out, "estudio", ctx.estudio ?? "")
  out = replaceToken(out, "fecha", ctx.fecha ?? "")
  out = replaceToken(out, "monto", ctx.monto ?? "")
  out = replaceToken(out, "concepto", ctx.concepto ?? "")
  out = replaceToken(out, "metodo", ctx.metodo ?? "")
  return out
}
