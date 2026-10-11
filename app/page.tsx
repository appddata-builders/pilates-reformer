import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import { hasUsedTrialClass } from "@/lib/class-charge"
import { loadReservacionesPlans } from "@/lib/site/public-plans.server"
import { loadLandingScheduleBoard } from "@/lib/site/schedule-board.server"
import { getPlanRequestState, planRequestBlockReason } from "@/lib/plan-requests"
import { HomePage } from "./home-page"

export default async function Page() {
  const [plans, session, board] = await Promise.all([
    loadReservacionesPlans(),
    getSession(),
    loadLandingScheduleBoard(),
  ])

  // La cortesía es de una sola vez por cuenta. A quien no ha entrado sí se le
  // ofrece: puede registrarse y usarla.
  const userId = session?.user?.id
  const trialUsed =
    typeof userId === "string" ? await hasUsedTrialClass(getDb(), userId) : false

  // Con sesión, las tarjetas sólo ofrecen «Suscribirme» si de verdad puede
  // contratar: con un plan vigente o el anterior sin pagar se explica por qué.
  let planBlockedMessage: string | null = null
  if (typeof userId === "string") {
    planBlockedMessage =
      session?.user.role === "alumno"
        ? planRequestBlockReason(await getPlanRequestState(getDb(), userId))
        : "Los planes se contratan desde una cuenta de alumn@."
  }

  return (
    <HomePage
      plans={plans}
      initialBoard={board}
      loggedIn={session?.user != null}
      trialUsed={trialUsed}
      planBlockedMessage={planBlockedMessage}
    />
  )
}