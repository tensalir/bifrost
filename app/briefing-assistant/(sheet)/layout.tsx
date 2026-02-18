import { SheetSidebar } from '@/components/sheets/SheetSidebar'

/**
 * Sprint sheet layout — sidebar + main content. Route group (sheet) keeps URL as /briefing-assistant/[sprintId].
 */
export default function BriefingSheetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SheetSidebar />
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
