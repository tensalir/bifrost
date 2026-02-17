'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { BriefingAssignment, WorkingDocSections } from '@/src/domain/briefingAssistant/schema'
import { LayoutGrid, ExternalLink, Plus } from 'lucide-react'

export type AssignmentRow = BriefingAssignment & {
  mondayItemId?: string
  figmaPageUrl?: string
  targetBoardId?: string | null
  status?: string
  workingDocSections?: WorkingDocSections
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

const PRODUCT_OPTIONS = ['quiet', 'engage', 'experience', 'dream', 'switch', 'bundles', 'engage kids', 'earplugs collection']
const FORMAT_OPTIONS = ['static', 'video', 'static_carousel', 'video_carousel']
const FUNNEL_OPTIONS = ['tof', 'bof', 'retention']
const AGENCY_OPTIONS = ['Studio', 'Gain', 'Statiq', 'Goodo']

const STATUS_LABELS: Record<string, string> = {
  draft: 'draft',
  edited: 'edited',
  approved: 'approved',
  synced_to_monday: 'synced',
  queued: 'queued',
}

export type AssignmentPatch = Partial<{
  briefName: string
  productOrUseCase: string
  format: string
  funnel: string
  agencyRef: string
  assetCount: number
  mondayItemId: string | null
  targetBoardId: string | null
}>

interface BriefingAssignmentsTableProps {
  assignments: AssignmentRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
  batchBoardMap?: Record<string, string>
  availableBoards?: BoardOption[]
  onBoardChange?: (assignmentId: string, boardId: string | null) => void
  feedbackStatusMap?: Record<string, FeedbackStatusItem>
  /** Called when a cell is edited (blur). Parent should PATCH and refetch. */
  onPatch?: (assignmentId: string, patch: AssignmentPatch) => void | Promise<void>
  /** Called when user clicks add row. Parent should create assignment and refetch. */
  onAddRow?: () => void
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
  onPatch,
  onAddRow,
}: BriefingAssignmentsTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [patchLoading, setPatchLoading] = useState<Set<string>>(new Set())

  const handleBlur = useCallback(
    async (rowId: string, field: string, value: string | number) => {
      setEditingCell(null)
      if (!onPatch) return
      const payload: AssignmentPatch = {}
      if (field === 'briefName') payload.briefName = String(value)
      if (field === 'productOrUseCase') payload.productOrUseCase = String(value)
      if (field === 'format') payload.format = String(value)
      if (field === 'funnel') payload.funnel = String(value)
      if (field === 'agencyRef') payload.agencyRef = String(value)
      if (field === 'assetCount') payload.assetCount = Number(value)
      if (Object.keys(payload).length === 0) return
      setPatchLoading((prev) => new Set(prev).add(rowId))
      try {
        await onPatch(rowId, payload)
      } finally {
        setPatchLoading((prev) => {
          const next = new Set(prev)
          next.delete(rowId)
          return next
        })
      }
    },
    [onPatch]
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-pulse text-muted-foreground text-sm">Loading split…</div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          Run a split, import from Monday, or add a new brief to get started.
        </p>
        {onAddRow ? (
          <button
            type="button"
            onClick={onAddRow}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Add first brief
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 bg-card/95 backdrop-blur border-b border-border z-10">
          <tr>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
              Source
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Format
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Funnel
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agency
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-16">
              Assets
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">
              Experiment
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
              Status
            </th>
            {availableBoards.length > 0 ? (
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                Board
              </th>
            ) : null}
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
              Links
            </th>
            {onAddRow ? (
              <th className="px-2 py-2.5 w-10">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAddRow(); }}
                  className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Add row"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {assignments.map((row) => {
            const isSelected = row.id === selectedId
            const resolvedBoardId = row.targetBoardId ?? batchBoardMap[row.batchKey]
            const defaultBoardId = batchBoardMap[row.batchKey]
            const isOverridden = row.targetBoardId != null && row.targetBoardId !== defaultBoardId
            const sourceLabel = row.source ?? 'split'
            const statusLabel = STATUS_LABELS[row.status as string] ?? row.status ?? 'draft'
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={cn(
                  'border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer',
                  isSelected && 'bg-primary/10'
                )}
              >
                <td className="px-4 py-1.5 text-sm" onClick={(e) => e.stopPropagation()}>
                  {editingCell?.id === row.id && editingCell?.field === 'briefName' ? (
                    <input
                      autoFocus
                      defaultValue={row.briefName}
                      className="w-full max-w-[180px] rounded border border-border bg-background px-2 py-1 text-sm"
                      onBlur={(e) => handleBlur(row.id, 'briefName', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-left w-full max-w-[180px] truncate font-medium text-foreground hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
                      onClick={() => setEditingCell({ id: row.id, field: 'briefName' })}
                    >
                      {row.briefName}
                    </button>
                  )}
                </td>
                <td className="px-4 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.productOrUseCase}
                    onChange={(e) => onPatch && handleBlur(row.id, 'productOrUseCase', e.target.value)}
                    className="w-full max-w-[120px] rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {PRODUCT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {!PRODUCT_OPTIONS.includes(row.productOrUseCase) ? (
                      <option value={row.productOrUseCase}>{row.productOrUseCase}</option>
                    ) : null}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground">
                    {sourceLabel}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.format}
                    onChange={(e) => onPatch && handleBlur(row.id, 'format', e.target.value)}
                    className="w-full max-w-[100px] rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {FORMAT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.funnel}
                    onChange={(e) => onPatch && handleBlur(row.id, 'funnel', e.target.value)}
                    className="w-full max-w-[80px] rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {FUNNEL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.agencyRef}
                    onChange={(e) => onPatch && handleBlur(row.id, 'agencyRef', e.target.value)}
                    className="w-full max-w-[90px] rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {AGENCY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {row.agencyRef && !AGENCY_OPTIONS.includes(row.agencyRef) ? (
                      <option value={row.agencyRef}>{row.agencyRef}</option>
                    ) : null}
                  </select>
                </td>
                <td className="px-4 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                  {editingCell?.id === row.id && editingCell?.field === 'assetCount' ? (
                    <input
                      type="number"
                      min={1}
                      autoFocus
                      defaultValue={row.assetCount}
                      className="w-14 rounded border border-border bg-background px-1.5 py-1 text-[11px]"
                      onBlur={(e) => handleBlur(row.id, 'assetCount', Number(e.target.value) || 1)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-muted-foreground hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 min-w-[2ch]"
                      onClick={() => setEditingCell({ id: row.id, field: 'assetCount' })}
                    >
                      {row.assetCount}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <span className="text-muted-foreground/70">—</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium',
                    statusLabel === 'synced' && 'bg-green-500/15 text-green-700 dark:text-green-400',
                    statusLabel === 'approved' && 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                    statusLabel === 'queued' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                    (statusLabel === 'draft' || statusLabel === 'edited') && 'bg-muted text-muted-foreground'
                  )}>
                    {statusLabel}
                  </span>
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
                {onAddRow ? <td className="px-2" /> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
