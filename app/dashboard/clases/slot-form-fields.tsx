"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import { endTimeFromStart } from "@/lib/time-utils"
import { STUDIO_CLASS_CAPACITY } from "@/lib/site/schedule"

const DAY_OPTIONS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
]

const TYPE_OPTIONS = [
  { value: "reformer", label: "Pilates Reformer" },
  { value: "mat", label: "Pilates Mat" },
  { value: "barre", label: "Barre" },
  { value: "mayores_60", label: "Especial para mayores de 60 años" },
  { value: "otro", label: "Otro" },
]

export type CoachOption = {
  id: string
  name: string
}

export type SlotFormValues = {
  className: string
  instructor: string
  alternateInstructor: string
  scheduleMode: string
  dayOfWeek: number
  startTime: string
  endTime: string
  capacity: number
  classType: string
}

function CoachSelect(props: {
  id: string
  name: string
  label: string
  value: string
  coaches: CoachOption[]
  required?: boolean
}) {
  const inCatalog = props.coaches.some((c) => c.name === props.value)

  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select
        id={props.id}
        name={props.name}
        required={props.required}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        defaultValue={props.value}
      >
        <option value="">Seleccionar coach</option>
        {!inCatalog && props.value.length > 0 ? (
          <option value={props.value}>{props.value}</option>
        ) : null}
        {props.coaches.map((coach) => (
          <option key={`${props.name}-${coach.id}`} value={coach.name}>
            {coach.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SlotFormFields(props: {
  idPrefix: string
  coaches: CoachOption[]
  values?: SlotFormValues
  fieldErrors?: Record<string, string[]>
  showWeekAvailabilityHint?: boolean
}) {
  const v = props.values
  const err = props.fieldErrors
  const instructorValue = v?.instructor ?? ""
  const alternateInstructorValue = v?.alternateInstructor ?? ""
  const startsDual =
    v?.scheduleMode === "dual" || v?.scheduleMode === "alternating_weekly"
  const [dualCoach, setDualCoach] = useState(startsDual)

  const defaultStart = v?.startTime ?? "07:00"
  const defaultEnd =
    v?.endTime != null && v.endTime.trim().length > 0 ? v.endTime : endTimeFromStart(defaultStart)
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)

  useEffect(() => {
    const start = v?.startTime ?? "07:00"
    const end =
      v?.endTime != null && v.endTime.trim().length > 0 ? v.endTime : endTimeFromStart(start)
    setStartTime(start)
    setEndTime(end)
  }, [v?.startTime, v?.endTime])

  function handleStartTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setStartTime(next)
    if (next) {
      setEndTime(endTimeFromStart(next))
    }
  }

  return (
    <>
      <input type="hidden" name="scheduleMode" value={dualCoach ? "dual" : "fixed"} />
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-className`}>Nombre de la clase</Label>
        <Input
          id={`${props.idPrefix}-className`}
          name="className"
          required
          minLength={2}
          defaultValue={v?.className ?? ""}
        />
        {err?.className ? <p className="text-destructive text-sm">{err.className[0]}</p> : null}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={dualCoach}
          onChange={(e) => setDualCoach(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <span>Esta clase tiene 2 coaches (rotan fines de semana)</span>
      </label>
      {dualCoach ? (
        <>
          <CoachSelect
            id={`${props.idPrefix}-instructor`}
            name="instructor"
            label="Coach 1"
            value={instructorValue}
            coaches={props.coaches}
            required
          />
          <CoachSelect
            id={`${props.idPrefix}-alternateInstructor`}
            name="alternateInstructor"
            label="Coach 2"
            value={alternateInstructorValue}
            coaches={props.coaches}
            required
          />
          <p className="text-xs text-muted-foreground">
            Ambas aparecen en el horario. Quién da la clase ese día lo coordinan ustedes.
          </p>
        </>
      ) : (
        <CoachSelect
          id={`${props.idPrefix}-instructor`}
          name="instructor"
          label="Instructor"
          value={instructorValue}
          coaches={props.coaches}
        />
      )}
      {props.coaches.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay coaches registrados en el sistema.</p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-dayOfWeek`}>Día</Label>
        <select
          id={`${props.idPrefix}-dayOfWeek`}
          name="dayOfWeek"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={v != null ? String(v.dayOfWeek) : "1"}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {err?.dayOfWeek ? <p className="text-destructive text-sm">{err.dayOfWeek[0]}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${props.idPrefix}-startTime`}>Hora inicio</Label>
          <Input
            id={`${props.idPrefix}-startTime`}
            name="startTime"
            type="time"
            required
            value={startTime}
            onChange={handleStartTimeChange}
          />
          {err?.startTime ? <p className="text-destructive text-sm">{err.startTime[0]}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${props.idPrefix}-endTime`}>Hora fin</Label>
          <Input
            id={`${props.idPrefix}-endTime`}
            name="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-capacity`}>Cupo máximo</Label>
        <Input
          id={`${props.idPrefix}-capacity`}
          name="capacity"
          type="number"
          min={1}
          max={100}
          required
          defaultValue={v?.capacity ?? STUDIO_CLASS_CAPACITY}
        />
        {err?.capacity ? <p className="text-destructive text-sm">{err.capacity[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${props.idPrefix}-classType`}>Tipo</Label>
        <select
          id={`${props.idPrefix}-classType`}
          name="classType"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={v?.classType ?? "reformer"}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {props.showWeekAvailabilityHint ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
          Para marcar una semana como no disponible sin borrar el horario, usa “Gestionar
          disponibilidad por semana” aquí abajo.
        </p>
      ) : null}
    </>
  )
}
