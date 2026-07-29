"use client"

import { startTransition, useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { CircleCheck, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import { Input } from "@/components/shared/ui/input"
import { Label } from "@/components/shared/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog"
import { DbActionSuccessEffect } from "@/components/features/admin/db-action-feedback"
import { authClient } from "@/lib/auth-client"
import { signInByDisplayId } from "@/lib/sign-in-by-display-id"
import {
  type BookingSlotOption,
  filterSlotsForBookingDate,
  formatBookingDateEs,
  formatSlotLabel,
  getDayOfWeekFromDateStr,
  nextDateWithSlots,
  resolveBookingDefaultDate,
} from "@/lib/booking-slot-options"
import {
  checkPublicBookingEligibility,
  createPublicBookingAction,
  loadAgendarDataAction,
  type AgendarData,
  type PublicBookingState,
} from "@/app/agendar/actions"
import { routes } from "@/lib/routes"

function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount)
}

async function waitForSessionUser() {
  for (let i = 0; i < 40; i++) {
    const s = await authClient.getSession()
    if (s.data?.user != null) {
      return s.data.user
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 150)
    })
  }
  return null
}

function AgendarBookingForm(props: {
  slots: BookingSlotOption[]
  defaultDate: string
  todayStr: string
  disabledSlotDateKeys: string[]
  bookedBySlotDate: Record<string, number>
  initialDate?: string
  initialSlotId?: string
  onClose: () => void
  onBooked?: () => void
}) {
  const [state, formAction, pending] = useActionState<PublicBookingState, FormData>(
    createPublicBookingAction,
    { success: false },
  )
  const { data: sessionData } = authClient.useSession()
  const sessionUser = sessionData?.user ?? null

  const [scheduleSlotId, setScheduleSlotId] = useState(() => props.initialSlotId ?? "")
  const [bookingDate, setBookingDate] = useState(() =>
    props.initialDate && props.initialDate !== ""
      ? props.initialDate
      : resolveBookingDefaultDate(props.defaultDate, props.slots, props.disabledSlotDateKeys),
  )
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [checkOk, setCheckOk] = useState<boolean | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginDisplayId, setLoginDisplayId] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginPending, setLoginPending] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<{
    date: string
    slotId: string
    userName: string
  } | null>(null)
  const [willBeCharged, setWillBeCharged] = useState<{
    priceMxn: number
    planName: string
  } | null>(null)
  const [trialAvailable, setTrialAvailable] = useState(false)
  const [useTrialClass, setUseTrialClass] = useState(false)
  // Reservas hechas en esta sesión: el cupo baja sin recargar la página.
  const [extraBooked, setExtraBooked] = useState<Record<string, number>>({})
  const { onBooked } = props

  const dayOfWeek = getDayOfWeekFromDateStr(bookingDate)
  const slotsForDay = filterSlotsForBookingDate(
    props.slots,
    bookingDate,
    props.disabledSlotDateKeys,
  ).map((slot) => {
    const key = `${slot.id}|${bookingDate}`
    const booked = (props.bookedBySlotDate[key] ?? 0) + (extraBooked[key] ?? 0)
    return { ...slot, booked, free: Math.max(0, slot.capacity - booked) }
  })
  const nextDate = nextDateWithSlots(bookingDate, props.slots, props.disabledSlotDateKeys)
  const canUseNextDate =
    bookingDate !== "" &&
    slotsForDay.length === 0 &&
    nextDate !== bookingDate &&
    filterSlotsForBookingDate(props.slots, nextDate, props.disabledSlotDateKeys).length > 0
  const canSubmit =
    bookingDate !== "" && scheduleSlotId !== "" && slotsForDay.length > 0

  const isCurrentBookingConfirmed =
    confirmedBooking != null &&
    confirmedBooking.date === bookingDate &&
    confirmedBooking.slotId === scheduleSlotId

  const sessionDisplayIdRaw =
    sessionUser != null ? (sessionUser as { displayId?: string | null }).displayId : null
  const sessionDisplayId =
    typeof sessionDisplayIdRaw === "string" && sessionDisplayIdRaw.trim() !== ""
      ? sessionDisplayIdRaw
      : null

  useEffect(() => {
    if (!scheduleSlotId) return
    const valid = slotsForDay.some((s) => s.id === scheduleSlotId && s.free > 0)
    if (!valid) {
      setScheduleSlotId("")
    }
  }, [bookingDate, slotsForDay, scheduleSlotId])

  useEffect(() => {
    if (state.success && state.message) {
      const confirmedName = state.message.replace(/, tu clase quedó confirmada\.$/, "")
      const confirmedDate = state.bookedDate ?? bookingDate
      setCheckMessage(state.message)
      setCheckOk(true)
      setLoginOpen(false)
      setConfirmedBooking({
        date: confirmedDate,
        slotId: scheduleSlotId,
        userName: confirmedName,
      })
      const key = `${scheduleSlotId}|${confirmedDate}`
      setExtraBooked((prev) => (prev[key] != null ? prev : { ...prev, [key]: 1 }))
      onBooked?.()
    }
    if (state.error) {
      setCheckMessage(state.error)
      setCheckOk(false)
    }
  }, [state, bookingDate, scheduleSlotId, onBooked])

  useEffect(() => {
    if (sessionUser == null || !scheduleSlotId || !bookingDate) {
      setCheckMessage(null)
      setCheckOk(null)
      setWillBeCharged(null)
      setTrialAvailable(false)
      setUseTrialClass(false)
      return
    }
    if (isCurrentBookingConfirmed) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      checkPublicBookingEligibility(scheduleSlotId, bookingDate).then((res) => {
        if (cancelled) return
        setWillBeCharged(res.ok ? (res.willBeCharged ?? null) : null)
        // La clase muestra viene marcada por defecto: es gratis y de una sola vez.
        const trial = res.ok && res.trialAvailable === true
        setTrialAvailable(trial)
        setUseTrialClass(trial)
        setCheckOk(res.ok)
        setCheckMessage(
          res.ok
            ? res.alumnaName
              ? `Puedes reservar: ${res.alumnaName}`
              : "Horario disponible"
            : (res.message ?? "No se puede reservar este horario"),
        )
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [sessionUser, scheduleSlotId, bookingDate, isCurrentBookingConfirmed])

  function submitBooking() {
    if (isCurrentBookingConfirmed) return
    if (bookingDate === "" || scheduleSlotId === "") return
    const fd = new FormData()
    fd.set("bookingDate", bookingDate)
    fd.set("scheduleSlotId", scheduleSlotId)
    if (trialAvailable && useTrialClass) {
      fd.set("useTrialClass", "true")
    }
    // useActionState exige transición cuando no se invoca desde `action`.
    startTransition(() => {
      formAction(fd)
    })
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoginPending(true)

    const signIn = await signInByDisplayId(loginDisplayId, loginPassword)

    if (!signIn.ok) {
      setLoginPending(false)
      setLoginError(signIn.error)
      return
    }

    const user = await waitForSessionUser()
    if (user == null) {
      setLoginPending(false)
      setLoginError("Problemas de conexión. Vuelve a intentar.")
      return
    }

    const enabled = (user as { enabled?: boolean }).enabled
    if (enabled === false) {
      await authClient.signOut()
      setLoginPending(false)
      setLoginError("Tu cuenta está inhabilitada. Contacta al estudio.")
      return
    }

    setLoginPending(false)
    setLoginOpen(false)
    setLoginDisplayId("")
    setLoginPassword("")
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 400)
    })
    submitBooking()
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isCurrentBookingConfirmed) return
    if (sessionUser == null) {
      setLoginOpen(true)
      return
    }
    void submitBooking()
  }

  return (
    <>
      <DbActionSuccessEffect success={state.success} kind="create" />
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {sessionUser != null ? (
          <div className="rounded-md border border-green-base/20 bg-green-base/5 px-4 py-3 text-sm">
            <p className="font-medium">{sessionUser.name}</p>
            {sessionDisplayId != null && sessionDisplayId !== "" ? (
              <p className="text-black/60 font-mono text-xs">{sessionDisplayId}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-black/60">
            Al confirmar, iniciarás sesión con tu ID y contraseña para identificar tu reserva.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="bookingDate">Fecha de la clase</Label>
          <Input
            id="bookingDate"
            name="bookingDate"
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduleSlotId">Horario</Label>
          {bookingDate === "" ? (
            <p className="text-sm text-black/60">Elige primero la fecha.</p>
          ) : slotsForDay.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-black/60">
                {dayOfWeek === 0
                  ? "No hay clases los domingos. Elige un día entre lunes y sábado."
                  : "No hay clases ese día. Elige otra fecha."}
              </p>
              {canUseNextDate ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBookingDate(nextDate)}
                >
                  Usar {formatBookingDateEs(nextDate)}
                </Button>
              ) : null}
            </div>
          ) : (
            <select
              id="scheduleSlotId"
              name="scheduleSlotId"
              value={scheduleSlotId}
              onChange={(e) => setScheduleSlotId(e.target.value)}
              required
              className="flex h-10 w-full rounded-inner border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="">Elige clase y hora</option>
              {slotsForDay.map((slot) => (
                <option key={slot.id} value={slot.id} disabled={slot.free <= 0}>
                  {formatSlotLabel(slot)}
                  {slot.free <= 0
                    ? " — Llena"
                    : ` — ${slot.free} ${slot.free === 1 ? "lugar" : "lugares"}`}
                </option>
              ))}
            </select>
          )}
        </div>
        {isCurrentBookingConfirmed ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold text-[#1b1a18]">
                {confirmedBooking?.userName ?? sessionUser?.name ?? "Tu nombre"}
              </span>
              <span className="text-green-700">, tu clase quedó confirmada.</span>
            </p>
            {state.trialRedeemed ? (
              <div className="rounded-inner border border-green-base/30 bg-green-base/5 px-4 py-3 text-sm">
                <p>
                  Usaste tu <span className="font-semibold">clase muestra</span>, sin costo.
                  Es una cortesía de una sola vez: las siguientes van con tu plan o se cargan
                  a tu cuenta.
                </p>
              </div>
            ) : state.pendingAmount != null ? (
              <div className="rounded-inner border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p>
                  Apartaste tu clase sin pago previo. Queda pendiente{" "}
                  <span className="font-semibold">{formatMxn(state.pendingAmount)}</span>, que
                  puedes regularizar desde tu cuenta o en el estudio.
                </p>
              </div>
            ) : null}
          </div>
        ) : willBeCharged != null && sessionUser != null && scheduleSlotId !== "" ? (
          <div className="space-y-3 rounded-inner border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">No tienes un plan vigente que cubra esta clase.</p>
            {trialAvailable ? (
              <>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setUseTrialClass(true)}
                    className={`w-full rounded-inner border px-3 py-2 text-left transition-colors ${
                      useTrialClass
                        ? "border-green-base bg-white"
                        : "border-black/10 bg-white/60 hover:bg-white"
                    }`}
                  >
                    <span className="block font-medium">Redimir mi clase muestra</span>
                    <span className="block text-xs text-black/60">
                      Gratis · una sola vez por cuenta
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseTrialClass(false)}
                    className={`w-full rounded-inner border px-3 py-2 text-left transition-colors ${
                      !useTrialClass
                        ? "border-green-base bg-white"
                        : "border-black/10 bg-white/60 hover:bg-white"
                    }`}
                  >
                    <span className="block font-medium">Contratar clase individual</span>
                    <span className="block text-xs text-black/60">
                      {formatMxn(willBeCharged.priceMxn)} · se carga a tu cuenta y lo
                      regularizas en el estudio
                    </span>
                  </button>
                </div>
                <p className="text-xs">
                  {useTrialClass
                    ? "Tu clase muestra queda apartada sin costo."
                    : `Se registrará un adeudo de ${formatMxn(willBeCharged.priceMxn)} en tu cuenta.`}
                </p>
              </>
            ) : (
              <p>
                Apartas tu lugar y queda un adeudo de{" "}
                <span className="font-semibold">{formatMxn(willBeCharged.priceMxn)}</span>. Lo
                regularizas en el estudio y ellos lo registran como pagado.
              </p>
            )}
          </div>
        ) : checkMessage ? (
          <p className={`text-sm ${checkOk ? "text-green-700" : "text-red-600"}`}>
            {checkMessage}
          </p>
        ) : null}
        {!isCurrentBookingConfirmed && !canSubmit && bookingDate !== "" && slotsForDay.length === 0 ? null : !isCurrentBookingConfirmed && !canSubmit ? (
          <p className="text-sm text-black/60">Completa la fecha y el horario.</p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            className="w-full gap-2 bg-green-base hover:bg-green-hover"
            disabled={
              isCurrentBookingConfirmed ||
              pending ||
              !canSubmit ||
              (sessionUser != null && checkOk === false)
            }
          >
            {isCurrentBookingConfirmed ? (
              <>
                <CircleCheck className="h-4 w-4" />
                Clase confirmada
              </>
            ) : pending ? (
              "Guardando..."
            ) : (
              "Confirmar reserva"
            )}
          </Button>
          {isCurrentBookingConfirmed ? (
            <Button type="button" variant="outline" className="w-full" onClick={props.onClose}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inicia sesión para reservar</DialogTitle>
            <DialogDescription>
              Usa tu ID de usuario (ST) y la contraseña que elegiste al registrarte.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="agendar-login-displayId">ID de usuario</Label>
              <Input
                id="agendar-login-displayId"
                type="text"
                autoComplete="username"
                value={loginDisplayId}
                onChange={(e) => setLoginDisplayId(e.target.value.toUpperCase())}
                required
                disabled={loginPending}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agendar-login-password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="agendar-login-password"
                  type={loginPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginPending}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setLoginPasswordVisible(!loginPasswordVisible)}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={loginPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  disabled={loginPending}
                >
                  {loginPasswordVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-green-base hover:bg-green-hover" disabled={loginPending}>
              {loginPending ? "Ingresando..." : "Iniciar sesión y confirmar"}
            </Button>
            <p className="text-center text-xs text-black/60">
              ¿Aún no tienes cuenta?{" "}
              <Link href={routes.registry} className="text-green-base underline underline-offset-4">
                Regístrate aquí
              </Link>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AgendarBookingModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: string | null
  initialSlotId?: string | null
  onBooked?: () => void
}) {
  const [data, setData] = useState<AgendarData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) return
    if (data != null) return
    setLoading(true)
    setLoadError(null)
    loadAgendarDataAction()
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch(() => {
        setLoadError("No se pudo cargar el horario. Intenta de nuevo.")
        setLoading(false)
      })
  }, [props.open, data])

  function handleClose() {
    props.onOpenChange(false)
  }

  const formKey = `${props.initialDate ?? ""}-${props.initialSlotId ?? ""}-${props.open ? "1" : "0"}`

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Agendar clase</DialogTitle>
          <DialogDescription>
            Elige fecha y horario. Cada opción muestra los lugares que quedan.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-black/60">Cargando horarios...</p>
        ) : loadError ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setData(null)
                setLoadError(null)
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : data != null ? (
          <AgendarBookingForm
            key={formKey}
            slots={data.slots}
            defaultDate={data.defaultDate}
            todayStr={data.todayStr}
            disabledSlotDateKeys={data.disabledSlotDateKeys}
            bookedBySlotDate={data.bookedBySlotDate}
            initialDate={props.initialDate ?? undefined}
            initialSlotId={props.initialSlotId ?? undefined}
            onClose={handleClose}
            onBooked={props.onBooked}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
