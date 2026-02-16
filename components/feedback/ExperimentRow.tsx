'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Check } from 'lucide-react'
import { BriefLinkCell } from './BriefLinkCell'
import { FeedbackCell } from './FeedbackCell'
import { SummaryCell } from './SummaryCell'
import { SendToMondayDialog } from './SendToMondayDialog'
import type { FeedbackExperimentRow } from '@/app/api/feedback/route'

interface ExperimentRowProps {
  experiment: FeedbackExperimentRow
  onEntrySaved: () => void
  onSummaryGenerated: () => void
}

function getEntry(experiment: FeedbackExperimentRow, role: 'strategy' | 'design' | 'copy'): string {
  const e = experiment.feedback_entries?.find((x) => x.role === role)
  return e?.content ?? ''
}

export function ExperimentRow({ experiment, onEntrySaved, onSummaryGenerated }: ExperimentRowProps) {
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  const saveEntry = useCallback(
    async (payload: { experiment_id: string; role: string; content: string }) => {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onEntrySaved()
    },
    [onEntrySaved]
  )

  return (
    <>
      <tr className="border-b border-border/30">
        <td className="align-top px-2 py-2 border-b border-border/50 text-xs font-medium text-foreground">
          {experiment.experiment_name}
        </td>
        <BriefLinkCell
          value={experiment.brief_link}
          accessible={experiment.figma_accessible}
        />
        <td className="align-top px-2 py-2 border-b border-border/50 text-center">
          {experiment.is_urgent ? (
            <span className="text-[10px] font-medium text-amber-600">Urgent</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <FeedbackCell
          role="strategy"
          value={getEntry(experiment, 'strategy')}
          experimentId={experiment.id}
          onSave={saveEntry}
        />
        <FeedbackCell
          role="design"
          value={getEntry(experiment, 'design')}
          experimentId={experiment.id}
          onSave={saveEntry}
        />
        <FeedbackCell
          role="copy"
          value={getEntry(experiment, 'copy')}
          experimentId={experiment.id}
          onSave={saveEntry}
        />
        <SummaryCell
          experimentId={experiment.id}
          cachedSummary={experiment.summary_cache}
          onGenerated={onSummaryGenerated}
        />
        <td className="align-top px-2 py-2 border-b border-border/50">
          {experiment.sent_to_monday ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Sent
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSendDialogOpen(true)}
            >
              <Send className="h-3.5 w-3.5" />
              <span className="ml-1">Send to Monday</span>
            </Button>
          )}
        </td>
      </tr>
      <SendToMondayDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        experimentId={experiment.id}
        experimentName={experiment.experiment_name}
        mondayItemId={experiment.monday_item_id}
        summary={experiment.summary_cache ?? ''}
        strategyContent={getEntry(experiment, 'strategy')}
        designContent={getEntry(experiment, 'design')}
        copyContent={getEntry(experiment, 'copy')}
        onSent={onEntrySaved}
      />
    </>
  )
}
