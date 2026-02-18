'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { BriefingAssignment, WorkingDocSections } from '@/src/domain/briefingAssistant/schema'
import { LayoutGrid, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  /** Called when user clicks Generate Briefing on a row. Parent generates AI content and opens panel. */
  onGenerateBriefing?: (assignmentId: string) => void | Promise<void>
  /** Set of assignment IDs currently generating (show loading spinner). */
  generatingIds?: Set<string>
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
  onGenerateBriefing,
  generatingIds = new Set(),
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

  const columnCount = 10 + (onGenerateBriefing ? 1 : 0) + (availableBoards.length > 0 ? 1 : 0)

  const thBase = 'px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-r border-border/20 last:border-r-0'
  const tdBase = 'px-5 py-2.5 text-xs border-r border-border/20 last:border-r-0'
  const stickyFirst = 'sticky left-0 z-10 bg-card after:content-[""] after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border/50 after:shadow-[2px_0_4px_rgba(0,0,0,0.08)]'

  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col">
      <table className="w-full border-collapse text-left table-fixed">
        <thead className="sticky top-0 bg-card/95 backdrop-blur border-b border-border z-10">
          <tr>
            <th className={cn(thBase, stickyFirst)} style={{ width: '16%' }}>
              Name
            </th>
            <th className={thBase} style={{ width: '12%' }}>Product</th>
            <th className={thBase} style={{ width: '7%' }}>Source</th>
            <th className={thBase} style={{ width: '10%' }}>Format</th>
            <th className={thBase} style={{ width: '8%' }}>Funnel</th>
            <th className={thBase} style={{ width: '8%' }}>Agency</th>
            <th className={thBase} style={{ width: '6%' }}>Assets</th>
            <th className={thBase} style={{ width: '10%' }}>Experiment</th>
            <th className={thBase} style={{ width: '7%' }}>Status</th>
            {onGenerateBriefing ? (
              <th className={thBase} style={{ width: '8%' }}>Briefing</th>
            ) : null}
            {availableBoards.length > 0 ? (
              <th className={thBase} style={{ width: '10%' }}>Board</th>
            ) : null}
            <th className={thBase} style={{ width: '6%' }}>Links</th>
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-12 text-center border-r-0">
                <div className="flex flex-col items-center gap-4">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground/20" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Run a split, import from Monday, or add a new brief to get started.
                  </p>
                  {onAddRow ? (
                    <button
                      type="button"
                      onClick={onAddRow}
                      className="mt-1 text-sm text-primary hover:underline"
                    >
                      Add first brief
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : (
          assignments.map((row, index) => {
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
                style={{ animationDelay: `${index * 20}ms` }}
                className={cn(
                  'border-b border-border/60 transition-colors duration-100 cursor-pointer',
                  'hover:bg-muted/40',
                  isSelected && 'bg-primary/15',
                  'animate-in fade-in-0 slide-in-from-bottom-1 duration-200'
                )}
              >
                <td
                  className={cn(
                    tdBase,
                    stickyFirst,
                    isSelected && 'bg-primary/15 border-l-2 border-primary'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingCell?.id === row.id && editingCell?.field === 'briefName' ? (
                    <input
                      autoFocus
                      defaultValue={row.briefName}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                      onBlur={(e) => handleBlur(row.id, 'briefName', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-left w-full truncate font-medium text-foreground hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
                      onClick={() => setEditingCell({ id: row.id, field: 'briefName' })}
                    >
                      {row.briefName}
                    </button>
                  )}
                </td>
                <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.productOrUseCase}
                    onChange={(e) => onPatch && handleBlur(row.id, 'productOrUseCase', e.target.value)}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {PRODUCT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {!PRODUCT_OPTIONS.includes(row.productOrUseCase) ? (
                      <option value={row.productOrUseCase}>{row.productOrUseCase}</option>
                    ) : null}
                  </select>
                </td>
                <td className={tdBase}>
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground">
                    {sourceLabel}
                  </span>
                </td>
                <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.format}
                    onChange={(e) => onPatch && handleBlur(row.id, 'format', e.target.value)}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {FORMAT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.funnel}
                    onChange={(e) => onPatch && handleBlur(row.id, 'funnel', e.target.value)}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {FUNNEL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={row.agencyRef}
                    onChange={(e) => onPatch && handleBlur(row.id, 'agencyRef', e.target.value)}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] min-h-0"
                  >
                    {AGENCY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {row.agencyRef && !AGENCY_OPTIONS.includes(row.agencyRef) ? (
                      <option value={row.agencyRef}>{row.agencyRef}</option>
                    ) : null}
                  </select>
                </td>
                <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
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
                <td className={cn(tdBase, 'text-xs text-muted-foreground')} onClick={(e) => e.stopPropagation()}>
                  <span className="text-muted-foreground/70">—</span>
                </td>
                <td
                  className={cn(
                    tdBase,
                    'text-xs font-medium text-center',
                    statusLabel === 'synced' && 'bg-green-500/20 text-green-300',
                    statusLabel === 'approved' && 'bg-blue-500/20 text-blue-300',
                    statusLabel === 'feedback' && 'bg-amber-500/20 text-amber-300',
                    statusLabel === 'queued' && 'bg-purple-500/15 text-purple-300',
                    (statusLabel === 'draft' || statusLabel === 'edited') && 'bg-muted/60 text-muted-foreground'
                  )}
                >
                  {statusLabel}
                </td>
                {onGenerateBriefing ? (
                  <td className={tdBase} onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateBriefing(row.id)}
                      disabled={generatingIds.has(row.id)}
                      className="h-7 text-xs"
                    >
                      {generatingIds.has(row.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      ) : (
                        <Sparkles className="h-3 w-3 shrink-0" />
                      )}
                      Generate
                    </Button>
                  </td>
                ) : null}
                {availableBoards.length > 0 ? (
                  <td className={cn(tdBase, 'text-xs')} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={row.targetBoardId ?? defaultBoardId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        onBoardChange?.(row.id, v || null)
                      }}
                      className={cn(
                        'w-full rounded border border-border bg-background px-1.5 py-1 text-[11px]',
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
                <td className={cn(tdBase, 'text-xs')}>
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
          })
          )}
        </tbody>
      </table>
    </div>
  )
}
