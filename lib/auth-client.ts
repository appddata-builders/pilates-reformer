"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Sesión del lado del navegador. Las cookies de Cognito son httpOnly, así que
 * se pregunta al servidor (app/api/auth/session). Conserva la forma del
 * cliente de better-auth que usaban los componentes: useSession, getSession y
 * signOut.
 */

export type ClientSessionUser = {
  id: string
  name: string
  email: string
  role: string
  enabled: boolean
  image: string | null
}

type SessionData = { user: ClientSessionUser } | null
type SessionState = { data: SessionData; isPending: boolean }

const PENDING: SessionState = { data: null, isPending: true }

// Un solo estado compartido: header, menú y modal de reserva piden la sesión
// a la vez y basta con una petición.
let state: SessionState = PENDING
let inflight: Promise<SessionData> | null = null
const listeners = new Set<() => void>()

function setState(next: SessionState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function fetchSession(): Promise<SessionData> {
  const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
  if (!res.ok) return null
  const body = (await res.json()) as SessionData
  return body?.user != null ? body : null
}

function loadSession(): Promise<SessionData> {
  inflight ??= fetchSession()
    .catch(() => null)
    .then((data) => {
      setState({ data, isPending: false })
      inflight = null
      return data
    })
  return inflight
}

function useSession(): SessionState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => PENDING)
  useEffect(() => {
    if (state.isPending) void loadSession()
  }, [])
  return snapshot
}

async function getSession(): Promise<{ data: SessionData }> {
  return { data: await loadSession() }
}

/**
 * Después de iniciar sesión con una server action la cookie ya viene en la
 * respuesta, pero se espera a que /api/auth/session la confirme antes de ir
 * al panel. Null si no aparece en ~6 s.
 */
async function waitForSessionUser(): Promise<ClientSessionUser | null> {
  for (let i = 0; i < 40; i++) {
    const s = await getSession()
    if (s.data?.user != null) return s.data.user
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 150) })
  }
  return null
}

async function signOut(): Promise<{ error: Error | null }> {
  try {
    const res = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" })
    if (!res.ok) return { error: new Error(`No se pudo cerrar la sesión (${res.status})`) }
    setState({ data: null, isPending: false })
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error("No se pudo cerrar la sesión") }
  }
}

export const authClient = { useSession, getSession, signOut, waitForSessionUser }
