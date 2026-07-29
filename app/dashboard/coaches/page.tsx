import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

/**
 * El módulo de Coaches se fusionó con Usuarios: son la misma lista separada por
 * rol. La ruta se conserva para no romper enlaces guardados ni la miga de pan de
 * /dashboard/coaches/schedule y /dashboard/coaches/attendance.
 */
export default function CoachesPage() {
  redirect(`${routes.usuarios}?tab=coaches`)
}
