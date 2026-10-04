export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { ConfigFormsClient } from "./config-forms"
import { parseNavPermissionsJson } from "@/lib/nav-permissions"

export default async function ConfiguracionPage() {
  const session = await getSession()
  if (session == null) redirect("/login")

  const role = session.user.role
  if (role !== "admin" && role !== "root") redirect("/dashboard")

  const db = getDb()
  const [policy] = await db.select().from(schema.studioPolicy).where(eq(schema.studioPolicy.id, "main")).limit(1)

  const values = {
    studioName: policy?.studioName ?? "Pilates Studio",
    logoUrl: policy?.logoUrl ?? null,
    brandColor: policy?.brandColor ?? "#1b2d6e",
    maxCapacity: policy?.maxCapacity ?? 10,
    cancelHours: policy?.cancelHours ?? 1,
    cancelMinutes: policy?.cancelMinutes ?? (policy?.cancelHours != null ? policy.cancelHours * 60 : 90),
    lateCancelPenalty: policy?.lateCancelPenalty ?? true,
    noShowPenalty: policy?.noShowPenalty ?? true,
    maxBookingsPerDay: policy?.maxBookingsPerDay ?? 1,
    bookingWindowDays: policy?.bookingWindowDays ?? 7,
    bookingWindowMinutes: policy?.bookingWindowMinutes ?? 5,
    alertLastClassThreshold: policy?.alertLastClassThreshold ?? 2,
    alertDaysBeforeExpiry: policy?.alertDaysBeforeExpiry ?? 3,
    welcomeMessage:
      policy?.welcomeMessage ??
      "Te damos la bienvenida, {{nombre}}. Nos alegra tenerte en el estudio. Tu plan {{plan}} ya está activo.",
    birthdayMessage:
      policy?.birthdayMessage ??
      "¡Feliz cumpleaños {{nombre}}! El equipo de {{estudio}} te desea un día increíble.",
    maintenanceMode: policy?.maintenanceMode ?? false,
  }

  const navPermissions = parseNavPermissionsJson(policy?.navPermissions ?? null)

  return (
    <ConfigFormsClient
      policy={values}
      isRoot={role === "root"}
      navPermissions={navPermissions}
    />
  )
}
