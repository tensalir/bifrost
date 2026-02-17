'use client'

import { cn } from '@/lib/utils'
import type { BriefingAssignment } from '@/src/domain/briefingAssistant/schema'
import { LayoutGrid, ExternalLink } from 'lucide-react'

export type AssignmentRow = BriefingAssignment & {
  mondayItemId?: string
  figmaPageUrl?: string
  targetBoardId?: string | null
}

interface BoardOption {
  batch_key: string
  label: string
  board_id: string
}

export interface FeedbackStatusItem {
  hasExperiment: boolean
  roles: string[]
  sentToMonday: boolean
}

interface BriefingAssignmentsTableProps {
  assignments: AssignmentRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
  /** Map batch_key -> monday_board_id for per-row Monday links. */
  batchBoardMap?: Record<string, string>
  /** Options for the per-assignment board dropdown. */
  availableBoards?: BoardOption[]
  /** Called when user changes target board for an assignment (assignmentId, newBoardId | null). */
  onBoardChange?: (assignmentId: string, boardId: string | null) => void
  /** Map monday_item_id -> feedback status for badge. */
  feedbackStatusMap?: Record<string, FeedbackStatusItem>
}

export function BriefingAssignmentsTable({
  assignments,
  selectedId,
  onSelect,
  loading = false,
  batchBoardMap = {},
  availableBoards = [],
  onBoardChange,
  feedbackStatusMap = {},
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
          Run a split, import from Monday, or add a new brief to get started.
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
            {availableBoards.length > 0 ? (
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                Board
              </th>
            ) : null}
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
              Links
            </th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((row) => {
            const isSelected = row.id === selectedId
            const resolvedBoardId = row.targetBoardId ?? batchBoardMap[row.batchKey]
            const defaultBoardId = batchBoardMap[row.batchKey]
            const isOverridden = row.targetBoardId != null && row.targetBoardId !== defaultBoardId
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
                {availableBoards.length > 0 ? (
                  <td className="px-4 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={row.targetBoardId ?? defaultBoardId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        onBoardChange?.(row.id, v || null)
                      }}
                      className={cn(
                        'w-full max-w-[140px] rounded border border-border bg-background px-1.5 py-1 text-[11px]',
                        isOverridden && 'border-amber-500/60 bg-amber-500/5'
                      )}
                    >
                      {availableBoards.map((b) => (
                        <option key={b.batch_key} value={b.board_id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td className="px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {resolvedBoardId && row.mondayItemId ? (
                      <a
                        href={`https://loopearplugs.monday.com/boards/${resolvedBoardId}/pulses/${row.mondayItemId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        aria-label="Open Monday item"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {row.figmaPageUrl ? (
                      <a
                        href={row.figmaPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        aria-label="Open Figma page"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {row.mondayItemId && feedbackStatusMap[row.mondayItemId]?.hasExperiment ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          feedbackStatusMap[row.mondayItemId].sentToMonday
                            ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                        title={`Feedback: ${feedbackStatusMap[row.mondayItemId].roles.length}/3 roles${feedbackStatusMap[row.mondayItemId].sentToMonday ? ', sent to Monday' : ''}`}
                      >
                        {feedbackStatusMap[row.mondayItemId].sentToMonday ? 'Sent' : `${feedbackStatusMap[row.mondayItemId].roles.length}/3`}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
