/**
 * Briefing Assistant root layout — pass-through only.
 * (overview) route group adds Nav for /briefing-assistant and /briefing-assistant/new.
 * (sheet) route group uses full-screen layout for /briefing-assistant/[sprintId].
 */
export default function BriefingAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
