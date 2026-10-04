import { getSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import { hasUsedTrialClass } from "@/lib/class-charge"
import { loadReservacionesPlans } from "@/lib/site/public-plans.server"
import { loadLandingScheduleBoard } from "@/lib/site/schedule-board.server"
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

  return (
    <HomePage
      plans={plans}
      initialBoard={board}
      loggedIn={session?.user != null}
      trialUsed={trialUsed}
    />
  )
}