/**
 * Forecast layout — full-screen, no sidebar.
 * Forecast is a standalone module with its own top-bar header.
 */
export default function ForecastLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
