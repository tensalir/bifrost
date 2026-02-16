'use client'

interface StakeholderPreviewPanelProps {
  roundName?: string
  roundCreatedAt?: string
  experimentCount?: number
  agencyCount?: number
  selectedAgency?: string | null
}

export function StakeholderPreviewPanel({
  roundName,
  roundCreatedAt,
  experimentCount = 0,
  agencyCount = 0,
  selectedAgency,
}: StakeholderPreviewPanelProps) {
  const dateStr = roundCreatedAt
    ? new Date(roundCreatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header — matches LayerPreviewPanel / FEEDBACK SUMMARY style */}
      <div className="px-5 border-y border-primary/20 flex items-center" style={{ height: 38 }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 leading-none">
          Round Summary
        </span>
      </div>

      {/* Round info */}
      <div className="px-4 py-3 flex-shrink-0 mx-4 mt-3 rounded-md bg-primary/[0.06] border border-primary/15 space-y-2">
        {roundName && (
          <p className="text-[13px] font-medium text-foreground/90 truncate" title={roundName}>
            {roundName}
          </p>
        )}
        {dateStr && (
          <p className="text-[11px] text-muted-foreground/70">{dateStr}</p>
        )}
        <div className="flex gap-3 text-[11px] text-muted-foreground/60 pt-1">
          <span>{experimentCount} experiment{experimentCount !== 1 ? 's' : ''}</span>
          <span>{agencyCount} agenc{agencyCount !== 1 ? 'ies' : 'y'}</span>
        </div>
      </div>

      {/* Selected agency / future detail placeholder */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
        {selectedAgency ? (
          <p className="text-xs text-muted-foreground/70">
            Viewing <span className="font-medium text-foreground/80">{selectedAgency}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            Select an agency row in the table to see details here.
          </p>
        )}
      </div>
    </div>
  )
}
