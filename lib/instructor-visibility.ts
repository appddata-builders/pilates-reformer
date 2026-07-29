/**
 * La asignación de instructor es un dato interno de administración: sirve para
 * organizar el estudio, pero no se le muestra a coaches ni a alumnas, porque
 * cualquier coach puede cubrir una clase y el nombre que figure puede cambiar.
 */
export function hidesInstructorAssignment(role: string | null | undefined): boolean {
  return role !== "admin" && role !== "root"
}
