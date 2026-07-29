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
  animation: "dashboard-loading-spin 0.8s linear infinite",
  border: "3px solid rgba(13, 71, 20, 0.16)",
  borderRadius: "9999px",
  borderTopColor: "#0D4714",
  height: 32,
  width: 32,
}

export default function DashboardLoading() {
  return (
    <div style={screenStyle} role="status" aria-label="Cargando panel">
      <style>
        {"@keyframes dashboard-loading-spin { to { transform: rotate(360deg); } }"}
      </style>
      <div style={spinnerStyle} />
    </div>
  )
}
