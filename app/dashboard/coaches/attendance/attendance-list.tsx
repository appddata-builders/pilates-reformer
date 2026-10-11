"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus } from "lucide-react"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import type { AttendanceCandidate, AttendanceCatalogItem } from "@/lib/coach-attendance"
import { AttendanceControls } from "./attendance-controls"
import { markWalkInAttendanceAction, searchAttendanceCandidatesAction } from "./actions"

export type AttendanceSlotGroup = {
  slotId: string
  className: string
  /** Horario y, si hay, instructor: "8:00 – 9:00 a. m. · Ana". */
  subtitle: string
  bookings: {
    bookingId: string
    studentId: string
    studentName: string
    studentEmail: string
    attended: boolean | null
  }[]
}

/** Clase que se imparte ese día, para hacer presente a alguien sin reserva. */
export type DaySlotOption = { id: string; label: string }

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/** Formulario para hacer presente en una clase del día a quien llegó sin reserva. */
function WalkInForm(props: {
  candidate: AttendanceCandidate
  dateStr: string
  daySlots: DaySlotOption[]
  suggestedSlotId: string
  catalog: AttendanceCatalogItem[]
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [slotId, setSlotId] = useState(props.suggestedSlotId)
  const [catalogId, setCatalogId] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = props.catalog.find((item) => item.id === catalogId)

  async function save() {
    if (slotId === "" || pending) return
    setPending(true)
    setError(null)
    try {
      const result = await markWalkInAttendanceAction({
        userId: props.candidate.id,
        scheduleSlotId: slotId,
        dateStr: props.dateStr,
        catalogId: catalogId || undefined,
      })
      if (!result.success) {
        setError(result.error ?? "No se pudo registrar la asistencia")
        return
      }
      const slotLabel = props.daySlots.find((slot) => slot.id === slotId)?.label ?? "la clase"
      props.onDone(`${props.candidate.name} quedó presente en ${slotLabel}.`)
      router.refresh()
    } catch {
      setError("No se pudo registrar la asistencia. Intenta de nuevo.")
    } finally {
      setPending(false)
    }
  }

  if (props.daySlots.length === 0) {
    return <p className="text-sm text-muted-foreground">Este día no hay clases en el horario.</p>
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <label className="block space-y-1 text-sm">
        <span>Clase</span>
        <select
          className="w-full rounded-md border bg-background p-2"
          value={slotId}
          disabled={pending}
          onChange={(e) => setSlotId(e.target.value)}
        >
          {slotId === "" ? <option value="">Elige la clase</option> : null}
          {props.daySlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Plan o clase a cobrar</span>
        <select
          className="w-full rounded-md border bg-background p-2"
          value={catalogId}
          disabled={pending}
          onChange={(e) => setCatalogId(e.target.value)}
        >
          <option value="">Sin nuevo adeudo · usar su plan o cobro existente</option>
          {props.catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.kind === "class" ? "Clase" : "Plan"}: {item.name} · ${item.priceMxn.toFixed(2)} MXN
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        {selected
          ? `${selected.name}: $${selected.priceMxn.toFixed(2)} MXN pendientes${selected.kind === "plan" ? ". El plan inicia hoy y esta asistencia consume una clase" : ""}.`
          : "Si tiene plan con clases, se descuenta de ahí. Se aparta su lugar aunque la clase esté llena."}
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || slotId === ""} onClick={() => void save()}>
          {pending ? "Guardando…" : "✓ Marcar presente"}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={props.onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/**
 * Lista de asistencia del día con buscador por correo o nombre. Filtra al
 * instante a quien ya tiene reserva y, además, busca entre todos los alumn@s
 * para hacer presente en una clase a quien llegó sin reservar.
 */
export function AttendanceList(props: {
  slots: AttendanceSlotGroup[]
  catalog: AttendanceCatalogItem[]
  dateStr: string
  daySlots: DaySlotOption[]
  suggestedSlotId: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ q: string; items: AttendanceCandidate[] } | null>(null)
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const q = normalize(query)
  const searchable = q.length >= 2

  useEffect(() => {
    if (!searchable) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchAttendanceCandidatesAction(query)
        .then((items) => {
          if (!cancelled) setResults({ q, items })
        })
        .catch(() => {
          if (!cancelled) setResults({ q, items: [] })
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, query, searchable])

  const visible = props.slots
    .map((slot) => ({
      ...slot,
      bookings:
        q === ""
          ? slot.bookings
          : slot.bookings.filter(
              (b) =>
                normalize(b.studentEmail).includes(q) || normalize(b.studentName).includes(q),
            ),
    }))
    .filter((slot) => slot.bookings.length > 0)

  const bookedIds = new Set(props.slots.flatMap((slot) => slot.bookings.map((b) => b.studentId)))
  const searching = searchable && results?.q !== q
  const candidates =
    searchable && results?.q === q
      ? results.items.filter((candidate) => !bookedIds.has(candidate.id))
      : []

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="email"
          autoComplete="off"
          placeholder="Buscar por correo o nombre"
          aria-label="Buscar por correo o nombre"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpenCandidateId(null)
            setDoneMessage(null)
          }}
          className="pl-9"
        />
      </div>

      {doneMessage ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {doneMessage}
        </p>
      ) : null}

      {searchable ? (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Hacer presente a alguien sin reserva</p>
          </div>
          {searching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Buscando…</p>
          ) : candidates.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">
              {visible.length > 0
                ? "Quien coincide ya tiene reserva este día: márcalo en su clase abajo."
                : `Ningún alumn@ coincide con «${query.trim()}».`}
            </p>
          ) : (
            <ul className="divide-y">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{candidate.name}</p>
                      <p className="break-all text-xs text-muted-foreground">{candidate.email}</p>
                      <p className="text-xs text-muted-foreground">{candidate.planLabel}</p>
                    </div>
                    {openCandidateId !== candidate.id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenCandidateId(candidate.id)}
                      >
                        Hacer presente
                      </Button>
                    ) : null}
                  </div>
                  {openCandidateId === candidate.id ? (
                    <WalkInForm
                      candidate={candidate}
                      dateStr={props.dateStr}
                      daySlots={props.daySlots}
                      suggestedSlotId={props.suggestedSlotId}
                      catalog={props.catalog}
                      onCancel={() => setOpenCandidateId(null)}
                      onDone={(message) => {
                        setOpenCandidateId(null)
                        setDoneMessage(message)
                        setQuery("")
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {visible.length === 0 ? (
        q === "" ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay reservas confirmadas para este día. Busca a alguien por su correo para hacerlo
            presente.
          </div>
        ) : null
      ) : (
        visible.map((slot) => (
          <div key={slot.slotId} className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-base font-semibold">{slot.className}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{slot.subtitle}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {slot.bookings.length} reserva{slot.bookings.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <ul className="divide-y">
              {slot.bookings.map((b) => (
                <li
                  key={b.bookingId}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.studentName}</p>
                    <p className="break-all text-xs text-muted-foreground">{b.studentEmail}</p>
                  </div>
                  <AttendanceControls
                    bookingId={b.bookingId}
                    attended={b.attended}
                    catalog={props.catalog}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
