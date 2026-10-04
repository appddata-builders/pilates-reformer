"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/features/admin/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/ui/card"
import { Label } from "@/components/shared/ui/label"
import { Input } from "@/components/shared/ui/input"
import { Textarea } from "@/components/shared/ui/textarea"
import { Button } from "@/components/shared/ui/button"
import { DbActionForm } from "@/components/features/admin/db-action-form"
import { saveConfigAction } from "./actions"
import { NavPermissionsForm } from "./nav-permissions-form"
import type { NavPermissionsMap } from "@/lib/nav-permissions"

const CONFIG_TAB_STORAGE_KEY = "pilates_config_tab"

const ADMIN_TABS = ["general", "booking", "alerts", "messages"] as const
const ROOT_EXTRA_TABS = ["nav", "advanced"] as const

function validTabsForRole(isRoot: boolean): string[] {
  if (isRoot) return [...ADMIN_TABS, ...ROOT_EXTRA_TABS]
  return [...ADMIN_TABS]
}

export type StudioPolicyFormValues = {
  studioName: string
  logoUrl: string | null
  brandColor: string
  maxCapacity: number
  cancelHours: number
  cancelMinutes: number
  lateCancelPenalty: boolean
  noShowPenalty: boolean
  maxBookingsPerDay: number
  bookingWindowDays: number
  bookingWindowMinutes: number
  alertLastClassThreshold: number
  alertDaysBeforeExpiry: number
  welcomeMessage: string
  birthdayMessage: string
  maintenanceMode: boolean
}

export function ConfigFormsClient(props: {
  policy: StudioPolicyFormValues
  isRoot: boolean
  navPermissions: NavPermissionsMap
}) {
  const [welcomeDraft, setWelcomeDraft] = useState(props.policy.welcomeMessage)
  const [birthdayDraft, setBirthdayDraft] = useState(props.policy.birthdayMessage)
  const [activeTab, setActiveTab] = useState("general")
  const [tabsReady, setTabsReady] = useState(false)

  useEffect(() => {
    setWelcomeDraft(props.policy.welcomeMessage)
    setBirthdayDraft(props.policy.birthdayMessage)
  }, [props.policy.welcomeMessage, props.policy.birthdayMessage])

  useEffect(() => {
    const allowed = validTabsForRole(props.isRoot)
    let next = "general"
    try {
      const stored = window.localStorage.getItem(CONFIG_TAB_STORAGE_KEY)
      if (stored != null && allowed.includes(stored)) {
        next = stored
      }
    } catch {
      next = "general"
    }
    setActiveTab(next)
    setTabsReady(true)
  }, [props.isRoot])

  useEffect(() => {
    if (!tabsReady) return
    try {
      window.localStorage.setItem(CONFIG_TAB_STORAGE_KEY, activeTab)
    } catch {
    }
  }, [activeTab, tabsReady])

  if (!tabsReady) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader className="py-1" title="Configuración" description="Ajustes generales del estudio" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader className="py-1" title="Configuración" description="Ajustes generales del estudio" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList data-tour="config-tabs" className="flex flex-wrap h-auto gap-1 p-1 [&_[data-slot=tabs-trigger]]:py-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="booking">Políticas de reserva</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
          {props.isRoot ? <TabsTrigger value="nav">Permisos</TabsTrigger> : null}
          {props.isRoot ? <TabsTrigger value="advanced">Avanzado</TabsTrigger> : null}
        </TabsList>

        <TabsContent className="py-1" value="general">
          <Card data-tour="config-form" className="border-none shadow-sm max-w-2xl">
            <CardHeader className="py-1">
              <CardTitle className="text-base font-medium">General</CardTitle>
            </CardHeader>
            <CardContent className="py-1 pb-6">
              <DbActionForm action={saveConfigAction} kind="update" className="space-y-4">
                <input type="hidden" name="tab" value="general" />
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="studioName">Nombre del estudio</Label>
                  <Input className="py-1" id="studioName" name="studioName" required defaultValue={props.policy.studioName} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="brandColor">Color de marca (hex)</Label>
                  <Input className="py-1" id="brandColor" name="brandColor" required defaultValue={props.policy.brandColor} />
                </div>
                <div className="py-1 pt-4">
                  <Button
                    type="submit"
                    className="px-6 py-1 min-h-[calc(2.25rem+4px)]"
                  >
                    Guardar cambios
                  </Button>
                </div>
              </DbActionForm>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="py-1" value="booking">
          <Card className="border-none shadow-sm max-w-2xl">
            <CardHeader className="py-1">
              <CardTitle className="text-base font-medium">Políticas de reserva</CardTitle>
            </CardHeader>
            <CardContent className="py-1 pb-6">
              <DbActionForm action={saveConfigAction} kind="update" className="space-y-4">
                <input type="hidden" name="tab" value="booking" />
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="maxCapacity">Capacidad máxima por clase</Label>
                  <Input className="py-1" id="maxCapacity" name="maxCapacity" type="number" min={1} required defaultValue={props.policy.maxCapacity} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="cancelMinutes">Anticipación mínima para cancelar (minutos)</Label>
                  <p className="text-xs text-muted-foreground py-1">
                    Con menos tiempo no se puede cancelar. El cierre de reservas nuevas se controla con la ventana en minutos.
                  </p>
                  <Input className="py-1" id="cancelMinutes" name="cancelMinutes" type="number" min={0} step={15} required defaultValue={props.policy.cancelMinutes} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="lateCancelPenalty">
                    Descontar clase si cancela tarde
                  </Label>
                  <p className="text-xs text-muted-foreground py-1">
                    Reservado para políticas futuras. Hoy, dentro de la ventana mínima la cancelación está bloqueada.
                  </p>
                  <select
                    id="lateCancelPenalty"
                    name="lateCancelPenalty"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue={props.policy.lateCancelPenalty ? "true" : "false"}
                  >
                    <option value="true">Sí, descontar clase</option>
                    <option value="false">No descontar</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="noShowPenalty">
                    Descontar clase si reservó y no asistió
                  </Label>
                  <p className="text-xs text-muted-foreground py-1">
                    La clase ya se descuenta al reservar. Marcar no-show solo registra asistencia.
                  </p>
                  <select
                    id="noShowPenalty"
                    name="noShowPenalty"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue={props.policy.noShowPenalty ? "true" : "false"}
                  >
                    <option value="true">Sí, descontar clase</option>
                    <option value="false">No descontar</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="maxBookingsPerDay">Máximo de reservas por día por usuario</Label>
                  <Input className="py-1" id="maxBookingsPerDay" name="maxBookingsPerDay" type="number" min={1} required defaultValue={props.policy.maxBookingsPerDay} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="bookingWindowDays">Ventana de reserva (días)</Label>
                  <Input className="py-1" id="bookingWindowDays" name="bookingWindowDays" type="number" min={1} required defaultValue={props.policy.bookingWindowDays} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="bookingWindowMinutes">Ventana de reserva (minutos)</Label>
                  <p className="text-xs text-muted-foreground py-1">
                    Minutos antes de que termine la clase hasta cuando se permite una reserva nueva.
                  </p>
                  <Input className="py-1" id="bookingWindowMinutes" name="bookingWindowMinutes" type="number" min={0} step={1} required defaultValue={props.policy.bookingWindowMinutes} />
                </div>
                <div className="py-1 pt-4">
                  <Button
                    type="submit"
                    className="px-6 py-1 min-h-[calc(2.25rem+4px)]"
                  >
                    Guardar cambios
                  </Button>
                </div>
              </DbActionForm>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="py-1" value="alerts">
          <Card className="border-none shadow-sm max-w-2xl">
            <CardHeader className="py-1">
              <CardTitle className="text-base font-medium">Alertas</CardTitle>
            </CardHeader>
            <CardContent className="py-1 pb-6">
              <DbActionForm action={saveConfigAction} kind="update" className="space-y-4">
                <input type="hidden" name="tab" value="alerts" />
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="alertLastClassThreshold">Umbral de última clase</Label>
                  <Input className="py-1" id="alertLastClassThreshold" name="alertLastClassThreshold" type="number" min={0} required defaultValue={props.policy.alertLastClassThreshold} />
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <Label className="py-1" htmlFor="alertDaysBeforeExpiry">Días antes de vencimiento para alertar</Label>
                  <Input className="py-1" id="alertDaysBeforeExpiry" name="alertDaysBeforeExpiry" type="number" min={0} required defaultValue={props.policy.alertDaysBeforeExpiry} />
                </div>
                <div className="py-1 pt-4">
                  <Button
                    type="submit"
                    className="px-6 py-1 min-h-[calc(2.25rem+4px)]"
                  >
                    Guardar cambios
                  </Button>
                </div>
              </DbActionForm>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="py-1" value="messages">
          <Card className="border-none shadow-sm max-w-4xl">
            <CardHeader className="py-1 space-y-1">
              <CardTitle className="text-base font-medium">Mensajes al usuario</CardTitle>
              <p className="text-sm text-muted-foreground py-1">
                Edita cada mensaje con las variables del encabezado. Se aplican al enviarlos al alumno.
              </p>
            </CardHeader>
            <CardContent className="py-1 pb-6">
              <DbActionForm action={saveConfigAction} kind="update" className="space-y-14">
                <input type="hidden" name="tab" value="messages" />

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">Bienvenida</p>
                      <p className="text-xs text-muted-foreground py-1">Modal al entrar por primera vez</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{nombre}}"}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{plan}}"}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{estudio}}"}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{fecha}}"}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-col gap-1 py-1">
                      <Label className="py-1" htmlFor="welcomeMessage">Texto del mensaje</Label>
                      <Textarea
                        id="welcomeMessage"
                        name="welcomeMessage"
                        required
                        rows={6}
                        value={welcomeDraft}
                        onChange={(e) => setWelcomeDraft(e.target.value)}
                        className="min-h-[10rem] resize-y py-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-accent/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-accent-foreground">Cumpleaños</p>
                      <p className="text-xs text-muted-foreground py-1">Mensaje automático del día</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{nombre}}"}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{estudio}}"}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{"{{fecha}}"}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-col gap-1 py-1">
                      <Label className="py-1" htmlFor="birthdayMessage">Texto del mensaje</Label>
                      <Textarea
                        id="birthdayMessage"
                        name="birthdayMessage"
                        required
                        rows={6}
                        value={birthdayDraft}
                        onChange={(e) => setBirthdayDraft(e.target.value)}
                        className="min-h-[10rem] resize-y py-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="py-1 pt-2">
                  <Button
                    type="submit"
                    className="px-6 py-1 min-h-[calc(2.25rem+4px)]"
                  >
                    Guardar cambios
                  </Button>
                </div>
              </DbActionForm>
            </CardContent>
          </Card>
        </TabsContent>

        {props.isRoot ? (
          <TabsContent className="py-1" value="nav">
            <Card className="border-none shadow-sm max-w-4xl">
              <CardHeader className="py-1">
                <CardTitle className="text-base font-medium">Permisos de menú por perfil</CardTitle>
              </CardHeader>
              <CardContent className="py-1 pb-6">
                <NavPermissionsForm permissions={props.navPermissions} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {props.isRoot ? (
          <TabsContent className="py-1" value="advanced">
            <Card className="border-none shadow-sm max-w-2xl">
              <CardHeader className="py-1">
                <CardTitle className="text-base font-medium">Avanzado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 py-1 pb-6">
                <DbActionForm action={saveConfigAction} kind="update" className="space-y-4">
                  <input type="hidden" name="tab" value="advanced" />
                  <div className="flex flex-col gap-1 py-1">
                    <Label className="py-1" htmlFor="maintenanceMode">Modo mantenimiento</Label>
                    <select
                      id="maintenanceMode"
                      name="maintenanceMode"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      defaultValue={props.policy.maintenanceMode ? "true" : "false"}
                    >
                      <option value="false">Desactivado</option>
                      <option value="true">Activado</option>
                    </select>
                  </div>
                  <div className="py-1 pt-4">
                    <Button
                      type="submit"
                      className="px-6 py-1 min-h-[calc(2.25rem+4px)]"
                    >
                      Guardar cambios
                    </Button>
                  </div>
                </DbActionForm>

                <div className="flex flex-col gap-1 py-1 pt-6">
                  <div className="font-medium text-sm py-1">Exportación de datos</div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                      <a href="/api/export/csv?kind=alumnos">CSV usuarios</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/api/export/csv?kind=reservas">CSV reservas</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/api/export/csv?kind=pagos">CSV pagos</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
