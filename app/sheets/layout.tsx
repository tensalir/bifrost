/**
 * Sheets layout — full-screen, no sidebar.
 * Sheets are reviewer-facing and use their own auth (cookie-based).
 */
export default function SheetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen overflow-hidden bg-background">
      {children}
    </div>
  )
}
