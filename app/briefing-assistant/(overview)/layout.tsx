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
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
