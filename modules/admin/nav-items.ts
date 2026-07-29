import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  CreditCard,
  Tag,
  TicketPercent,
  Settings2,
  BarChart2,
  ClipboardCheck,
  CalendarDays,
  Clock,
  History,
  type LucideIcon,
} from "lucide-react"
import { routes } from "@/lib/routes"

export type AdminNavItem = {
  key: string
  title: string
  url: string
  icon: LucideIcon
  badge?: string
  roles?: string[]
  searchTerms?: string[]
}

export const mainNavItems: AdminNavItem[] = [
  { key: "dashboard", url: routes.dashboard, title: "Dashboard", icon: LayoutDashboard, roles: ["admin", "root", "coach"] },
  { key: "usuarios", url: routes.usuarios, title: "Usuarios", icon: Users, roles: ["admin", "root"] },
  { key: "clases", url: routes.clases, title: "Clases", icon: Calendar, roles: ["admin", "root"] },
  { key: "mi-horario", url: routes.coachSchedule, title: "Horario", icon: Clock, roles: ["coach"] },
  { key: "reservas", url: routes.reservas, title: "Reservas", icon: BookOpen, roles: ["admin", "root", "coach", "alumno"] },
  { key: "pagos", url: routes.pagos, title: "Pagos", icon: CreditCard, roles: ["admin", "root"] },
  { key: "planes", url: routes.planes, title: "Planes", icon: Tag, roles: ["admin", "root"] },
  { key: "cupones", url: routes.cupones, title: "Cupones", icon: TicketPercent, roles: ["admin", "root"] },
  { key: "calendario", url: routes.calendario, title: "Calendario", icon: CalendarDays, roles: ["admin", "root", "coach"] },
  { key: "reportes", url: routes.reportes, title: "Reportes", icon: BarChart2, roles: ["admin", "root"] },
  { key: "asistencia", url: routes.coachAttendance, title: "Asistencia", icon: ClipboardCheck, roles: ["coach"] },
  { key: "historico", url: routes.historico, title: "Histórico", icon: History, roles: ["admin", "root", "coach", "alumno"] },
  {
    key: "configuracion",
    url: routes.configuracion,
    title: "Configuración",
    icon: Settings2,
    roles: ["admin", "root"],
    searchTerms: ["config", "ajustes", "settings", "general", "alertas", "mensajes", "permisos"],
  },
]
