import { Nav } from '@/components/nav'

/**
 * Overview layout — sidebar for /briefing-assistant and /briefing-assistant/new.
 */
export default function BriefingOverviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen overflow-hidden bg-background flex">
      <Nav />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
