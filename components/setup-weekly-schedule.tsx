"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  formatWeekRange,
  getMondayOfWeek,
  scheduleDayLabels,
  type PublicScheduleSlot,
} from "@/lib/site/schedule"
import { formatSlotTime } from "@/lib/attendance-report-utils"
import {
  canOpenBookingFromBoard,
  findSlotAt,
  getBoardEnrolledCount,
  getBoardTimes,
  isBoardSlotDisabled,
  isBoardSlotFull,
  isBoardSlotPast,
} from "@/lib/site/schedule-board"
import { DEFAULT_BOOKING_WINDOW_MINUTES } from "@/lib/booking-rules"
import { loadWeeklyBoardAction } from "@/app/agendar/actions"

function dateStrForWeekDay(monday: Date, dayOfWeek: number): string {
  const d = new Date(monday)
  d.setDate(monday.getDate() + (dayOfWeek - 1))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export type WeeklyClassSelection = {
  slotId: string
  bookingDate: string
}

export default function SetupWeeklySchedule({
  onSelectClass,
}: {
  onSelectClass?: (selection: WeeklyClassSelection) => void
} = {}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState<PublicScheduleSlot[]>([])
  const [enrollments, setEnrollments] = useState<Record<string, number>>({})
  const [disabledSlotDateKeys, setDisabledSlotDateKeys] = useState<string[]>([])
  const [bookingWindowMinutes, setBookingWindowMinutes] = useState(
    DEFAULT_BOOKING_WINDOW_MINUTES,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadWeeklyBoardAction()
      .then((board) => {
        if (cancelled) return
        setSlots(board.slots)
        setEnrollments(board.enrollments)
        setDisabledSlotDateKeys(board.disabledSlotDateKeys)
        setBookingWindowMinutes(board.bookingWindowMinutes)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSlots([])
        setEnrollments({})
        setDisabledSlotDateKeys([])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Las semanas ya transcurridas no son reservables: el tablero arranca en la
  // semana en curso y no deja retroceder más allá.
  const canGoToPreviousWeek = weekOffset > 0
  const monday = getMondayOfWeek(new Date(), weekOffset)
  const weekLabel = formatWeekRange(monday)
  const boardTimes = getBoardTimes(slots)
  const hasSlots = slots.length > 0

  function getEnrolled(slot: PublicScheduleSlot, dayOfWeek: number): number {
    const dateStr = dateStrForWeekDay(monday, dayOfWeek)
    return getBoardEnrolledCount(enrollments, slot.id, dateStr)
  }

  function handleSelectClass(slot: PublicScheduleSlot, dayOfWeek: number) {
    if (!onSelectClass) return
    const bookingDate = dateStrForWeekDay(monday, dayOfWeek)
    const enrolled = getBoardEnrolledCount(enrollments, slot.id, bookingDate)
    const disabled = isBoardSlotDisabled(disabledSlotDateKeys, slot.id, bookingDate)
    if (
      !canOpenBookingFromBoard({
        enrolled,
        capacity: slot.capacity,
        disabled,
      })
    ) {
      return
    }
    onSelectClass({ slotId: slot.id, bookingDate })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-xl leading-tight">Horario semanal</p>
          {hasSlots ? (
            <p className="text-xs font-semibold text-white/70">{weekLabel}</p>
          ) : null}
        </div>
        {hasSlots ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={!canGoToPreviousWeek}
              title={
                canGoToPreviousWeek
                  ? "Semana anterior"
                  : "Las semanas ya transcurridas no se pueden reservar"
              }
              className={`grid h-8 w-8 place-items-center rounded-full border border-white/25 transition ${
                canGoToPreviousWeek
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "cursor-not-allowed bg-white/5 text-white/30"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center text-sm text-white/70">
          Cargando horarios...
        </div>
      ) : !hasSlots ? (
        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="font-display text-lg leading-tight">Sin horarios por el momento</p>
          <p className="mt-2 text-xs font-semibold text-white/70">
            Vuelve pronto o contáctanos para conocer la disponibilidad.
          </p>
        </div>
      ) : (
        <>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-inner border border-white/10 bg-white/5 p-2">
            <table className="w-full min-w-[480px] border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr>
                  <th className="border-b border-r border-white/15 p-1.5 text-left font-bold text-white/70 sm:p-2">
                    Hora
                  </th>
                  {scheduleDayLabels.map((day) => (
                    <th
                      key={day.dayOfWeek}
                      className="border-b border-white/15 p-1.5 text-center font-bold text-white/90 sm:p-2"
                    >
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boardTimes.map((time) => (
                  <tr key={time}>
                    <td className="border-r border-white/10 p-1.5 font-semibold text-white/75 sm:p-2">
                      {formatSlotTime(time)}
                    </td>
                    {scheduleDayLabels.map((day) => {
                      const slot = findSlotAt(slots, day.dayOfWeek, time)
                      if (!slot) {
                        return (
                          <td
                            key={`${day.dayOfWeek}-${time}`}
                            className="border-b border-white/10 p-1 text-center"
                          >
                            <span className="inline-block py-1 text-white/35">—</span>
                          </td>
                        )
                      }

                      const bookingDate = dateStrForWeekDay(monday, day.dayOfWeek)
                      const enrolled = getEnrolled(slot, day.dayOfWeek)
                      const disabled = isBoardSlotDisabled(
                        disabledSlotDateKeys,
                        slot.id,
                        bookingDate,
                      )
                      const past = isBoardSlotPast({
                        dateStr: bookingDate,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        bookingWindowMinutes,
                      })
                      const full = isBoardSlotFull(enrolled, slot.capacity)
                      const canBook = canOpenBookingFromBoard({
                        enrolled,
                        capacity: slot.capacity,
                        disabled,
                        past,
                      })
                      const title = past
                        ? "Esta clase ya pasó"
                        : disabled
                          ? "No disponible esta semana"
                          : full
                            ? "Clase llena"
                            : `${enrolled} inscritos · aforo ${slot.capacity}`

                      return (
                        <td
                          key={`${day.dayOfWeek}-${time}`}
                          className="border-b border-white/10 p-1 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectClass(slot, day.dayOfWeek)}
                            disabled={!canBook}
                            title={title}
                            className={`relative inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-md px-2 text-[10px] font-bold transition sm:h-8 sm:text-xs ${
                              canBook
                                ? "cursor-pointer bg-green-base text-white hover:bg-green-hover"
                                : past
                                  ? "cursor-not-allowed bg-white/5 text-white/25"
                                  : "cursor-not-allowed bg-white/20 text-white/60 line-through"
                            }`}
                          >
                            {disabled ? "Off" : full ? "Llena" : "Clase"}
                            {disabled ? null : (
                              <span
                                className={`absolute -top-1.5 -right-2 flex h-4 min-w-[1.65rem] items-center justify-center rounded-full px-1 text-[8px] font-bold leading-none sm:text-[9px] ${
                                  past
                                    ? "bg-white/10 text-white/30"
                                    : enrolled > 0
                                      ? full
                                        ? "bg-red-600 text-white"
                                        : "bg-red-500 text-white"
                                      : "bg-white/30 text-white"
                                }`}
                              >
                                {enrolled}/{slot.capacity}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs font-semibold text-white/70">
            Elige una clase disponible para reservar. La burbuja muestra inscritos / aforo.
          </p>
        </>
      )}
    </div>
  )
}
