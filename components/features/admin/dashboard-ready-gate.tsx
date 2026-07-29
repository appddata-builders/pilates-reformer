"use client"

import * as React from "react"

const screenStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#ffffff",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  minHeight: "100dvh",
  position: "fixed",
  zIndex: 9999,
}

const spinnerStyle: React.CSSProperties = {
  animation: "dashboard-ready-spin 0.8s linear infinite",
  border: "3px solid rgba(13, 71, 20, 0.16)",
  borderRadius: "9999px",
  borderTopColor: "#0D4714",
  height: 32,
  width: 32,
}

export function DashboardReadyGate(props: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setReady(true))
    })

    return () => window.cancelAnimationFrame(firstFrame)
  }, [])

  if (!ready) {
    return (
      <div style={screenStyle} role="status" aria-label="Cargando panel">
        <style>
          {"@keyframes dashboard-ready-spin { to { transform: rotate(360deg); } }"}
        </style>
        <div style={spinnerStyle} />
      </div>
    )
  }

  return props.children
}
