'use client'

import { cn } from '@/lib/utils'
import type { BriefingAssignment } from '@/src/domain/briefingAssistant/schema'

interface BriefingAssignmentsTableProps {
  assignments: BriefingAssignment[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

export function BriefingAssignmentsTable({
  assignments,
  selectedId,
  onSelect,
  loading = false,
}: BriefingAssignmentsTableProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-pulse text-muted-foreground text-sm">Loading split…</div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          Run a split above to see briefing assignments.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 bg-card/95 backdrop-blur border-b border-border z-10">
          <tr>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Brief
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Product / Use case
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Format
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Funnel
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bucket
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agency
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-16">
              Assets
            </th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((row) => {
            const isSelected = row.id === selectedId
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={cn(
                  'border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer',
                  isSelected && 'bg-primary/10'
                )}
              >
                <td className="px-4 py-2.5 text-sm font-medium text-foreground truncate max-w-[180px]">
                  {row.briefName}
                </td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground truncate max-w-[120px]">
                  {row.productOrUseCase}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {row.format}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {row.funnel}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {row.contentBucket}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {row.agencyRef}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground w-16">
                  {row.assetCount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
