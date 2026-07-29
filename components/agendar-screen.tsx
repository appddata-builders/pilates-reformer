"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SetupWeeklySchedule from "@/components/setup-weekly-schedule"
import type { WeeklyClassSelection } from "@/components/setup-weekly-schedule"
import { AgendarBookingModal } from "@/components/agendar-booking-modal"
import { routes } from "@/lib/routes"

export function AgendarScreen(props: {
  initialDate?: string | null
  initialSlotId?: string | null
  showIntro?: boolean
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [initialDate, setInitialDate] = useState<string | null>(props.initialDate ?? null)
  const [initialSlotId, setInitialSlotId] = useState<string | null>(props.initialSlotId ?? null)

  useEffect(() => {
    if (props.initialSlotId != null && props.initialSlotId !== "") {
      setInitialDate(props.initialDate ?? null)
      setInitialSlotId(props.initialSlotId)
      setModalOpen(true)
    }
  }, [props.initialDate, props.initialSlotId])

  function openBooking(selection?: WeeklyClassSelection) {
    if (selection != null) {
      setInitialDate(selection.bookingDate)
      setInitialSlotId(selection.slotId)
      router.replace(
        `${routes.agendar}?date=${encodeURIComponent(selection.bookingDate)}&slot=${encodeURIComponent(selection.slotId)}`,
        { scroll: false },
      )
    } else {
      setInitialDate(null)
      setInitialSlotId(null)
    }
    setModalOpen(true)
  }

  function handleModalOpenChange(open: boolean) {
    setModalOpen(open)
    if (!open) {
      setInitialDate(null)
      setInitialSlotId(null)
      router.replace(routes.agendar, { scroll: false })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {props.showIntro !== false ? (
        <div className="space-y-2 text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-base">Agenda</p>
          <h1 className="font-display text-3xl font-semibold text-[#1b1a18] sm:text-4xl">
            Horarios de la semana
          </h1>
          <p className="max-w-2xl text-sm text-black/65 sm:text-base">
            Elige una clase disponible para reservar. Solo se pueden agendar horarios con cupo y
            que no estén inhabilitados.
          </p>
        </div>
      ) : null}

      <div className="rounded-card border border-green-base/20 bg-green-base p-4 text-white shadow-[0_20px_40px_rgba(27,26,24,0.12)] sm:p-6">
        <SetupWeeklySchedule onSelectClass={openBooking} />
      </div>

      <AgendarBookingModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        initialDate={initialDate}
        initialSlotId={initialSlotId}
        onBooked={() => router.refresh()}
      />
    </div>
  )
}
