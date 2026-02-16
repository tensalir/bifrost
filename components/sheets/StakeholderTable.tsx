'use client'

import { ChevronRight, Layers, ClipboardList, CheckCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExperimentRow } from '@/components/feedback/ExperimentRow'
import type { FeedbackExperimentRow } from '@/app/api/feedback/route'

const COL_WIDTHS = ['14%', '12%', '6%', '14%', '14%', '14%', '14%', '12%'] as const
const COLUMNS = [
  'Experiment',
  'Brief link',
  'Urgent',
  'Strategy',
  'Design',
  'Copy',
  'Summary',
  'Actions',
] as const

interface StakeholderTableProps {
  byAgency: Record<string, FeedbackExperimentRow[]>
  orderedAgencies: string[]
  selectedAgency: string | null
  onSelectAgency: (agency: string | null) => void
  onEntrySaved: () => void
  onSummaryGenerated: () => void
}

export function StakeholderTable({
  byAgency,
  orderedAgencies,
  selectedAgency,
  onSelectAgency,
  onEntrySaved,
  onSummaryGenerated,
}: StakeholderTableProps) {
  if (orderedAgencies.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-muted-foreground/40">
        <ClipboardList className="h-8 w-8 mb-2" />
        <p className="text-sm">No experiments in this round</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky column headers — match CommentTable */}
      <div className="flex-shrink-0 pt-4">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            {COL_WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-y border-border">
              {COLUMNS.map((label, i) => (
                <th
                  key={label}
                  className={cn(
                    'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                    i < COLUMNS.length - 1 && 'border-r border-border/50'
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            {COL_WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            {orderedAgencies.map((agency) => (
              <AgencyGroup
                key={agency}
                agency={agency}
                experiments={byAgency[agency] ?? []}
                isSelected={selectedAgency === agency}
                onSelect={() => onSelectAgency(selectedAgency === agency ? null : agency)}
                onEntrySaved={onEntrySaved}
                onSummaryGenerated={onSummaryGenerated}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface AgencyGroupProps {
  agency: string
  experiments: FeedbackExperimentRow[]
  isSelected: boolean
  onSelect: () => void
  onEntrySaved: () => void
  onSummaryGenerated: () => void
}

function AgencyGroup({
  agency,
  experiments,
  isSelected,
  onSelect,
  onEntrySaved,
  onSummaryGenerated,
}: AgencyGroupProps) {
  const withSummary = experiments.filter((e) => e.summary_cache).length
  const sentCount = experiments.filter((e) => e.sent_to_monday).length

  return (
    <>
      {/* Agency header row — like LayerGroup */}
      <tr
        onClick={onSelect}
        className={cn(
          'cursor-pointer transition-colors border-b border-border/40',
          isSelected ? 'bg-primary/8 hover:bg-primary/10' : 'bg-muted/20 hover:bg-muted/30'
        )}
      >
        <td colSpan={8} className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground/50 transition-transform flex-shrink-0',
                isSelected && 'rotate-90 text-primary/70'
              )}
            />
            <Layers className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
            <span
              className={cn(
                'text-sm font-medium truncate',
                isSelected ? 'text-primary' : 'text-foreground'
              )}
            >
              {agency}
            </span>
            <span className="text-xs text-muted-foreground/50 flex-shrink-0">
              {experiments.length} experiment{experiments.length !== 1 ? 's' : ''}
            </span>
            {withSummary > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground/60 flex-shrink-0">
                <CheckCircle className="h-3 w-3" />
                {withSummary} with summary
              </span>
            )}
            {sentCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-emerald-400/60 flex-shrink-0">
                <Send className="h-3 w-3" />
                {sentCount} sent
              </span>
            )}
          </div>
        </td>
      </tr>

      {experiments.map((exp) => (
        <ExperimentRow
          key={exp.id}
          experiment={exp}
          onEntrySaved={onEntrySaved}
          onSummaryGenerated={onSummaryGenerated}
        />
      ))}
    </>
  )
}
