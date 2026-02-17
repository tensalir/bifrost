import { Nav } from '@/components/nav'

/**
 * Briefing Assistant layout — full-screen with sidebar (same as admin/sheets).
 */
export default function BriefingAssistantLayout({
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
