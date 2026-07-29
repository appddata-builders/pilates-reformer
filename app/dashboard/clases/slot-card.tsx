"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CalendarOff, CircleCheck, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { Card, CardContent } from "@/components/shared/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { ConfirmRemoveDialog } from "@/components/features/admin/confirm-remove-dialog"
import {
  deleteSlotAction,
  setSlotWeekAvailabilityAction,
  toggleSlotAction,
  updateSlotAction,
  type ActionState,
} from "./actions"
import { toLocalDateStr } from "@/lib/booking-slot-options"
import { formatTime12h, formatTimeRange12h } from "@/lib/time-utils"
import {
  occurrenceDateForWeek,
  upcomingWeekOptions,
} from "@/lib/slot-week-options"
import { OccupancyBar } from "@/components/features/admin/occupancy-bar"
import { SlotFormFields, type CoachOption, type SlotFormValues } from "./slot-form-fields"

const initial: ActionState = { success: false }

const DAY_NAMES_FULL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

function classTypeLabel(classType: string): string {
  if (classType === "reformer") return "Pilates Reformer"
  if (classType === "mat") return "Pilates Mat"
  if (classType === "barre") return "Barre"
  if (classType === "mayores_60") return "Especial para mayores de 60 años"
  return "Otro"
}

function classTypeBadgeClass(classType: string): string {
  if (classType === "mat") return "bg-green-100 text-green-800 border-green-200"
  if (classType === "barre") return "bg-purple-100 text-purple-800 border-purple-200"
  if (classType === "mayores_60") return "bg-amber-100 text-amber-900 border-amber-200"
  if (classType === "otro") return "bg-gray-100 text-gray-800 border-gray-200"
  return "bg-orange-100 text-orange-800 border-orange-200"
}

export type SlotCardData = {
  id: string
  className: string
  instructor: string | null
  alternateInstructor: string | null
  scheduleMode: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  capacity: number
  classType: string
  isActive: boolean
  bookedToday: number
  disabledDates: string[]
  /** Próxima fecha en que se imparte, para listar a las inscritas. */
  nextDateStr: string
  isPast?: boolean
}

export function SlotCard(props: {
  slot: SlotCardData
  coaches: CoachOption[]
  canManage: boolean
  compact?: boolean
  /** Clase de hoy cuya hora ya terminó: se atenúa. */
  isPast?: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [weeksOpen, setWeeksOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [editState, editAction, editPending] = useActionState(updateSlotAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSlotAction, initial)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleSlotAction, initial)
  const [weekState, weekAction, weekPending] = useActionState(setSlotWeekAvailabilityAction, initial)

  useEffect(() => {
    if (editState.success) setEditOpen(false)
  }, [editState.success])

  useEffect(() => {
    if (deleteState.success) {
      setDeleteOpen(false)
      router.refresh()
    }
  }, [deleteState.success, router])

  useEffect(() => {
    if (weekState.success) {
      router.refresh()
    }
  }, [weekState.success, router])

  const slot = props.slot
  const dayName = DAY_NAMES_FULL[slot.dayOfWeek] ?? "—"
  const timeLabel = formatTime12h(slot.startTime)
  const titleLine = props.compact
    ? `${slot.className} · ${timeLabel}`
    : `${slot.className} - ${dayName} ${timeLabel}`
  const disabledSet = new Set(slot.disabledDates)
  const weekOptions = upcomingWeekOptions(8).map((week) => {
    const occurrence = occurrenceDateForWeek(slot.dayOfWeek, week.monday)
    const dateStr = toLocalDateStr(occurrence)
    return {
      ...week,
      dateStr,
      available: !disabledSet.has(dateStr),
      dateLabel: occurrence.toLocaleDateString("es-MX", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    }
  })
  const disabledThisWeekCount = weekOptions.filter((w) => !w.available).length
  const dimmed = !slot.isActive || props.isPast === true
  // El tipo repite el nombre en la mayoría de las clases: no lo mostramos dos veces.
  const typeLabel = classTypeLabel(slot.classType)

  const formValues: SlotFormValues = {
    className: slot.className,
    instructor: slot.instructor ?? "",
    alternateInstructor: slot.alternateInstructor ?? "",
    scheduleMode: slot.scheduleMode ?? "fixed",
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime ?? "",
    capacity: slot.capacity,
    classType: slot.classType,
  }

  return (
    <>
      <DbActionSuccessEffect success={editState.success} kind="update" />
      <DbActionSuccessEffect success={toggleState.success} kind="update" />
      <DbActionSuccessEffect success={weekState.success} kind="update" />
      <DbActionSuccessEffect success={deleteState.success} kind="delete" />
      <div
        className={`flex h-full flex-col ${dimmed ? "opacity-55" : ""}`}
      >
        <Card className="flex min-h-0 flex-1 flex-col gap-0 border py-0 shadow-sm transition-colors hover:border-primary/40">
          <CardContent className="flex h-full min-h-0 flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-lg font-semibold leading-none tabular-nums">
                {timeLabel}
              </span>
              {props.canManage ? (
                <div className="-mt-1.5 -mr-1.5 flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Borrar</span>
                  </Button>
                </div>
              ) : null}
            </div>

            <p className="mt-1 truncate text-sm font-medium">{slot.className}</p>
            <p className="text-xs text-muted-foreground">
              {props.compact ? null : `${dayName} · `}
              {formatTimeRange12h(slot.startTime, slot.endTime)}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {typeLabel === slot.className ? null : (
                <Badge className={`border text-[10px] ${classTypeBadgeClass(slot.classType)}`}>
                  {typeLabel}
                </Badge>
              )}
              {slot.scheduleMode === "dual" || slot.scheduleMode === "alternating_weekly" ? (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-800">
                  2 coaches
                </Badge>
              ) : null}
              {!slot.isActive ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Inactiva
                </Badge>
              ) : null}
              {props.isPast ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Ya pasó
                </Badge>
              ) : null}
              {slot.isActive && disabledThisWeekCount > 0 ? (
                <Badge className="border-amber-200 bg-amber-100 text-[10px] text-amber-900">
                  {disabledThisWeekCount} semana{disabledThisWeekCount === 1 ? "" : "s"} off
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 border-t pt-3">
              <OccupancyBar
                booked={slot.bookedToday}
                capacity={slot.capacity}
                muted={dimmed}
              />
            </div>
            {toggleState.error ? (
              <p className="mt-2 text-xs text-destructive">{toggleState.error}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ConfirmRemoveDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="¿Desactivar esta clase?"
        description={`${titleLine} dejará de aparecer en el horario y no se podrá reservar.`}
        confirmLabel="Sí, desactivar"
        clientFormAction={toggleAction}
        hiddenFields={[
          { name: "id", value: slot.id },
          { name: "isActive", value: "true" },
        ]}
        pending={togglePending}
      />

      <Dialog open={weeksOpen} onOpenChange={setWeeksOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disponibilidad por semana</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Inhabilita solo la fecha de esta clase en una semana. El horario recurrente se mantiene.
          </p>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {weekOptions.map((week) => (
              <div
                key={week.dateStr}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{week.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{week.dateLabel}</p>
                </div>
                <form action={weekAction}>
                  <input type="hidden" name="id" value={slot.id} />
                  <input type="hidden" name="date" value={week.dateStr} />
                  <input type="hidden" name="available" value={week.available ? "false" : "true"} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={week.available ? "outline" : "default"}
                    className="text-xs h-8 shrink-0"
                    disabled={weekPending}
                  >
                    {week.available ? "Disponible" : "No disponible"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
          {weekState.error ? <p className="text-destructive text-sm">{weekState.error}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar clase</DialogTitle>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            <input type="hidden" name="id" value={slot.id} />
            <SlotFormFields
              idPrefix={`edit-${slot.id}`}
              coaches={props.coaches}
              values={formValues}
              fieldErrors={editState.fieldErrors}
              showWeekAvailabilityHint
            />
            {editState.error ? <p className="text-destructive text-sm">{editState.error}</p> : null}
            <Button type="submit" className="w-full" disabled={editPending}>
              Guardar cambios
            </Button>
          </form>
          <div className="space-y-2 border-t pt-4">
            {slot.isActive ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setEditOpen(false)
                    setWeeksOpen(true)
                  }}
                >
                  <CalendarOff className="h-4 w-4" />
                  Gestionar disponibilidad por semana
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={togglePending}
                  onClick={() => {
                    setEditOpen(false)
                    setDeactivateOpen(true)
                  }}
                >
                  <Ban className="h-4 w-4" />
                  Desactivar clase
                </Button>
              </>
            ) : (
              <form action={toggleAction}>
                <input type="hidden" name="id" value={slot.id} />
                <input type="hidden" name="isActive" value="false" />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full gap-2 border-green-700/40 text-green-700 hover:bg-green-100 hover:text-green-700"
                  disabled={togglePending}
                >
                  <CircleCheck className="h-4 w-4" />
                  Activar clase
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta clase?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el horario de {slot.className} ({dayName} {formatTime12h(slot.startTime)}) y sus reservas
              asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.error ? (
            <p className="text-destructive text-sm px-6">{deleteState.error}</p>
          ) : null}
          <form action={deleteAction}>
            <input type="hidden" name="id" value={slot.id} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={deletePending}>
                Cancelar
              </AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                className="text-white"
                disabled={deletePending}
              >
                {deletePending ? "Borrando..." : "Borrar"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
