"use client"

import { useActionState, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/features/admin/page-header"
import { Button } from "@/components/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shared/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { createSlotAction, type ActionState } from "./actions"
import { SlotCard, type SlotCardData } from "./slot-card"
import { SlotFormFields, type CoachOption } from "./slot-form-fields"

/** Días de la semana en curso que ya quedaron atrás (domingo no cuenta). */
function isWeekdayPast(dayOfWeek: number, todayDow: number): boolean {
  if (todayDow === 0) return false
  return dayOfWeek > 0 && dayOfWeek < todayDow
}

const initial: ActionState = { success: false }

const CLASES_DAY_STORAGE_KEY = "pilates_clases_day"

const DAY_TABS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
]

function isValidDayValue(value: string): boolean {
  return DAY_TABS.some((tab) => tab.value === value)
}

export function ClasesClient(props: {
  slots: SlotCardData[]
  activeCount: number
  coaches: CoachOption[]
  canManage: boolean
  todayDow: number
  todayKey: string
}) {
  // Domingo no tiene pestaña: en ese caso se arranca en lunes.
  const todayTab = isValidDayValue(String(props.todayDow)) ? String(props.todayDow) : "1"

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(todayTab)
  const [dayReady, setDayReady] = useState(false)
  const [createState, createAction, createPending] = useActionState(createSlotAction, initial)

  // La preferencia sólo vale dentro del mismo día: al día siguiente vuelve a hoy.
  useEffect(() => {
    let next = todayTab
    try {
      const stored = window.localStorage.getItem(CLASES_DAY_STORAGE_KEY)
      if (stored != null) {
        const [storedKey, storedDay] = stored.split("|")
        if (storedKey === props.todayKey && storedDay != null && isValidDayValue(storedDay)) {
          next = storedDay
        }
      }
    } catch {
      next = todayTab
    }
    setSelectedDay(next)
    setDayReady(true)
  }, [todayTab, props.todayKey])

  useEffect(() => {
    if (!dayReady) return
    try {
      window.localStorage.setItem(CLASES_DAY_STORAGE_KEY, `${props.todayKey}|${selectedDay}`)
    } catch {
    }
  }, [selectedDay, dayReady, props.todayKey])

  useEffect(() => {
    if (createState.success) setCreateOpen(false)
  }, [createState.success])

  const dayNumber = Number(selectedDay)
  const daySlots = props.slots
    .filter((slot) => slot.dayOfWeek === dayNumber)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const dayActiveCount = daySlots.filter((slot) => slot.isActive).length
  const selectedDayLabel = DAY_TABS.find((tab) => tab.value === selectedDay)?.label ?? ""

  if (!dayReady) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Clases"
          description={`${props.slots.length} en total · ${props.activeCount} activas`}
        />
      </div>
    )
  }

  return (
    <>
      <DbActionSuccessEffect success={createState.success} kind="create" />
      <div className="p-6 space-y-6">
        <PageHeader
          title="Clases"
          description={`${props.slots.length} en total · ${props.activeCount} activas`}
        >
          {props.canManage ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Clase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nueva clase</DialogTitle>
                </DialogHeader>
                <form action={createAction} className="space-y-4">
                  <SlotFormFields
                    idPrefix="create"
                    coaches={props.coaches}
                    fieldErrors={createState.fieldErrors}
                  />
                  {createState.error ? (
                    <p className="text-destructive text-sm">{createState.error}</p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={createPending}>
                    Crear clase
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </PageHeader>

        <Tabs value={selectedDay} onValueChange={setSelectedDay} className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1 sm:w-fit">
            {DAY_TABS.map((tab) => {
              const dow = Number(tab.value)
              const count = props.slots.filter((slot) => slot.dayOfWeek === dow).length
              const isToday = dow === props.todayDow
              const isPastDay = isWeekdayPast(dow, props.todayDow)
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`px-3 py-1.5 text-sm ${isPastDay ? "opacity-55" : ""}`}
                >
                  {tab.label}
                  {count > 0 ? (
                    <span className="text-muted-foreground ml-1 text-xs">({count})</span>
                  ) : null}
                  {isToday ? (
                    <span className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <p className="text-sm text-muted-foreground">
            {selectedDayLabel}
            {selectedDay === String(props.todayDow) ? (
              <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Hoy
              </span>
            ) : isWeekdayPast(Number(selectedDay), props.todayDow) ? (
              <span className="ml-1.5 text-xs">(ya pasó esta semana)</span>
            ) : null}
            : {daySlots.length} clase{daySlots.length === 1 ? "" : "s"} ·{" "}
            {dayActiveCount} activa{dayActiveCount === 1 ? "" : "s"}
          </p>

          {daySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Sin clases el {selectedDayLabel.toLowerCase()}
            </p>
          ) : (
            <div
              data-tour="clases-grid"
              className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {daySlots.map((slot) => (
                <div key={slot.id} className="h-full">
                  <SlotCard
                    slot={slot}
                    coaches={props.coaches}
                    canManage={props.canManage}
                    isPast={slot.isPast}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </Tabs>
      </div>
    </>
  )
}
