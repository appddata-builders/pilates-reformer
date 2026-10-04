"use client"

import { useEffect, useRef, useState } from "react"
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
import {
  loadMyBookingContextAction,
  type MyBookingContext,
} from "@/app/agendar/actions"
import type { LandingScheduleBoard } from "@/lib/site/schedule-board.server"
import { useTranslation } from "@/lib/text/text-provider"

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

const EMPTY_CONTEXT: MyBookingContext = {
  loggedIn: false,
  myBookingKeys: [],
  takenBookingKeys: [],
  individualBookingKeys: [],
  myBookingDates: [],
  weeklyUsage: {},
  plan: null,
}

export default function SetupWeeklySchedule({
  onSelectClass,
  reloadToken = 0,
  initialBoard,
}: {
  onSelectClass?: (selection: WeeklyClassSelection) => void
  /** Al cambiar, el tablero vuelve a pedir datos: así una reserva se ve al instante. */
  reloadToken?: number
  initialBoard?: LandingScheduleBoard
} = {}) {
  const { t } = useTranslation()
  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState<PublicScheduleSlot[]>(initialBoard?.slots ?? [])
  const [enrollments, setEnrollments] = useState<Record<string, number>>(initialBoard?.enrollments ?? {})
  const [disabledSlotDateKeys, setDisabledSlotDateKeys] = useState<string[]>(initialBoard?.disabledSlotDateKeys ?? [])
  const [bookingWindowMinutes, setBookingWindowMinutes] = useState(
    initialBoard?.bookingWindowMinutes ?? DEFAULT_BOOKING_WINDOW_MINUTES,
  )
  const [loading, setLoading] = useState(initialBoard == null)
  const [ctx, setCtx] = useState<MyBookingContext>(EMPTY_CONTEXT)
  const loadedOnce = useRef(initialBoard != null)

  // `reloadToken` en las dependencias: tras reservar, quien contiene al tablero
  // lo incrementa y el cupo y las clases propias se repintan sin recargar.
  useEffect(() => {
    let cancelled = false
    // El "Cargando..." sólo la primera vez. En los refrescos posteriores el
    // tablero se queda en pantalla y se repinta con los datos nuevos: vaciarlo
    // hacía parpadear todo el horario cada vez que se reservaba una clase.
    if (!loadedOnce.current) setLoading(true)
    let refreshing = false
    async function refreshBoard() {
      if (refreshing) return
      refreshing = true
      try {
        const [boardResult, contextResult] = await Promise.allSettled([
          fetch("/api/schedule-board", { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("No se pudo consultar el cupo")
            return response.json() as Promise<LandingScheduleBoard>
          }),
          loadMyBookingContextAction(),
        ])
        if (cancelled) return
        // El cupo público se actualiza aunque falle la consulta de la cuenta.
        if (boardResult.status === "fulfilled") {
          const board = boardResult.value
          setSlots(board.slots)
          setEnrollments(board.enrollments)
          setDisabledSlotDateKeys(board.disabledSlotDateKeys)
          setBookingWindowMinutes(board.bookingWindowMinutes)
          loadedOnce.current = true
        }
        if (contextResult.status === "fulfilled") setCtx(contextResult.value)
        setLoading(false)
      } finally {
        refreshing = false
      }
    }
    void refreshBoard()
    const refreshVisibleBoard = () => {
      if (document.visibilityState === "visible") void refreshBoard()
    }
    const timer = window.setInterval(refreshVisibleBoard, 15_000)
    window.addEventListener("focus", refreshVisibleBoard)
    document.addEventListener("visibilitychange", refreshVisibleBoard)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshVisibleBoard)
      document.removeEventListener("visibilitychange", refreshVisibleBoard)
    }
  }, [reloadToken])

  // Las semanas ya transcurridas no son reservables: el tablero arranca en la
  // semana en curso y no deja retroceder más allá.
  const canGoToPreviousWeek = weekOffset > 0
  const monday = getMondayOfWeek(new Date(), weekOffset)
  const weekLabel = formatWeekRange(monday)
  const boardTimes = getBoardTimes(slots)
  const hasSlots = slots.length > 0

  const myBookingKeys = new Set(ctx.myBookingKeys)
  const takenKeys = new Set(ctx.takenBookingKeys)
  const individualKeys = new Set(ctx.individualBookingKeys)
  const plan = ctx.plan
  // El tope semanal se mide contra la semana que se está viendo, no contra hoy:
  // el tablero deja moverse a semanas futuras y cada una lleva su propia cuenta.
  const weekKey = dateStrForWeekDay(monday, 1)
  const usedThisWeek = ctx.weeklyUsage[weekKey] ?? 0
  const weeklyLimit = plan?.weeklyLimit ?? null
  const weekLimitReached = weeklyLimit != null && usedThisWeek >= weeklyLimit

  function isMine(slotId: string, dateStr: string): boolean {
    return myBookingKeys.has(`${slotId}|${dateStr}`)
  }

  /** Clase individual: blanca en el tablero; las del plan y la muestra, beige. */
  function isIndividual(slotId: string, dateStr: string): boolean {
    return individualKeys.has(`${slotId}|${dateStr}`)
  }

  /** Clase quemada: ya la dio por tomada y no queda nada que hacer con ella. */
  function isTaken(slotId: string, dateStr: string): boolean {
    return takenKeys.has(`${slotId}|${dateStr}`)
  }

  function getEnrolled(slot: PublicScheduleSlot, dayOfWeek: number): number {
    const dateStr = dateStrForWeekDay(monday, dayOfWeek)
    return getBoardEnrolledCount(enrollments, slot.id, dateStr)
  }

  function handleSelectClass(slot: PublicScheduleSlot, dayOfWeek: number) {
    if (!onSelectClass) return
    const bookingDate = dateStrForWeekDay(monday, dayOfWeek)
    // Una clase ya tomada está quemada: no hay nada que hacer con ella.
    if (isTaken(slot.id, bookingDate)) return
    // Su propia reserva sí se abre: desde el modal puede liberarla o tomarla.
    if (!isMine(slot.id, bookingDate)) {
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
    }
    onSelectClass({ slotId: slot.id, bookingDate })
  }

  function planSummary(): string | null {
    if (plan == null) return null
    if (plan.isUnlimited) return t("setup.weekly.schedule.planUnlimited")
    const left = plan.classesRemaining ?? 0
    if (left <= 0) return t("setup.weekly.schedule.planNoneRemaining")
    if (left === 1) return t("setup.weekly.schedule.planOneRemaining")
    return t("setup.weekly.schedule.planRemaining", { count: left })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-xl leading-tight">{t("setup.weekly.schedule.text001")}</p>
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
                  ? t("schedule.previousWeek")
                  : t("schedule.previousWeekUnavailable")
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

      {plan != null && !loading && hasSlots ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inner border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold sm:text-xs">
          <span className="text-white">{plan.name}</span>
          {planSummary() != null ? (
            <span className="text-white/75">· {planSummary()}</span>
          ) : null}
          {weeklyLimit != null ? (
            <span className={weekLimitReached ? "text-amber-200" : "text-white/75"}>
              ·{" "}
              {weekLimitReached
                ? t("setup.weekly.schedule.planWeekFull", { limit: weeklyLimit })
                : t("setup.weekly.schedule.planWeekUsage", {
                    used: usedThisWeek,
                    limit: weeklyLimit,
                  })}
            </span>
          ) : null}
          {plan.expired ? (
            <span className="text-amber-200">· {t("setup.weekly.schedule.planExpired")}</span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center text-sm text-white/70">
          {t("setup.weekly.schedule.text002")}</div>
      ) : !hasSlots ? (
        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="font-display text-lg leading-tight">{t("setup.weekly.schedule.text003")}</p>
          <p className="mt-2 text-xs font-semibold text-white/70">
            {t("setup.weekly.schedule.text004")}</p>
        </div>
      ) : (
        <>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-inner border border-white/10 bg-white/5 p-2">
            <table className="w-full min-w-[480px] border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr>
                  <th className="border-b border-r border-white/15 p-1.5 text-left font-bold text-white/70 sm:p-2">
                    {t("setup.weekly.schedule.text005")}</th>
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
                      const mine = isMine(slot.id, bookingDate)
                      const taken = isTaken(slot.id, bookingDate)
                      const individual = isIndividual(slot.id, bookingDate)
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
                      // El tope semanal NO deshabilita celdas: con la semana llena
                      // todavía se puede cambiar de hora o liberar una reserva.
                      // Sólo se apagan las que ya pasaron, las inhabilitadas y las
                      // llenas. La propia reserva siempre se puede abrir.
                      const canOpen =
                        !taken &&
                        (mine ||
                          canOpenBookingFromBoard({
                            enrolled,
                            capacity: slot.capacity,
                            disabled,
                            past,
                          }))
                      const title = taken
                        ? t("schedule.classTaken")
                        : mine
                          ? t("schedule.classMineOpen")
                          : past
                            ? t("schedule.classPast")
                            : disabled
                              ? t("schedule.classUnavailable")
                              : full
                                ? t("schedule.classFull")
                                : weekLimitReached
                                  ? t("schedule.classWeekLimit", { limit: weeklyLimit ?? 0 })
                                  : t("schedule.enrollment", { enrolled, capacity: slot.capacity })

                      return (
                        <td
                          key={`${day.dayOfWeek}-${time}`}
                          className="border-b border-white/10 p-1 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectClass(slot, day.dayOfWeek)}
                            disabled={!canOpen}
                            title={title}
                            className={`relative inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-md px-2 text-[10px] font-bold transition sm:h-8 sm:text-xs ${
                              taken
                                ? "cursor-default bg-green-base/60 text-white/70 ring-1 ring-white/40"
                                : mine
                                  ? individual
                                    ? "cursor-pointer bg-white text-green-base ring-2 ring-white hover:bg-white/90"
                                    : "cursor-pointer bg-beige text-green-base ring-2 ring-beige hover:bg-beige/90"
                                  : canOpen
                                  ? "cursor-pointer bg-green-base text-white hover:bg-green-hover"
                                  : past
                                    ? "cursor-not-allowed bg-white/5 text-white/25"
                                    : "cursor-not-allowed bg-white/20 text-white/60 line-through"
                            }`}
                          >
                            {taken ? (
                              t("schedule.taken")
                            ) : mine ? (
                              t("schedule.mine")
                            ) : disabled ? (
                              t("schedule.off")
                            ) : full ? (
                              t("schedule.full")
                            ) : (
                              t("schedule.class")
                            )}
                            <span
                                className={`absolute -top-1.5 -right-2 flex h-4 min-w-[1.65rem] items-center justify-center rounded-full px-1 text-[8px] font-bold leading-none sm:text-[9px] ${
                                  enrolled > 0
                                    ? full
                                      ? "bg-red-600 text-white"
                                      : "bg-red-500 text-white"
                                    : "bg-white/30 text-white"
                                }`}
                              >
                                {enrolled}/{slot.capacity}
                            </span>
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
            {t("setup.weekly.schedule.text006")}</p>
        </>
      )}
    </div>
  )
}
