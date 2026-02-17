'use client'

import type { WorkingDocSections } from '@/src/domain/briefingAssistant/schema'

interface BriefingWorkingDocPanelProps {
  /** Assignment brief name for context. */
  briefName?: string
  /** Working doc sections (editable in future). */
  sections?: WorkingDocSections
  /** Whether the panel is in read-only preview. */
  readOnly?: boolean
}

export function BriefingWorkingDocPanel({
  briefName,
  sections,
  readOnly = true,
}: BriefingWorkingDocPanelProps) {
  const sectionLabels: { key: keyof WorkingDocSections; label: string }[] = [
    { key: 'idea', label: 'Idea' },
    { key: 'why', label: 'Why' },
    { key: 'audience', label: 'Audience' },
    { key: 'product', label: 'Product' },
    { key: 'visual', label: 'Visual' },
    { key: 'copyInfo', label: 'Copy info' },
    { key: 'test', label: 'Test' },
    { key: 'variants', label: 'Variants' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-5 border-y border-primary/20 flex items-center flex-shrink-0"
        style={{ height: 38 }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 leading-none">
          Working doc
        </span>
      </div>

      {briefName ? (
        <div className="px-4 py-3 flex-shrink-0 mx-4 mt-3 rounded-md bg-primary/[0.06] border border-primary/15">
          <p className="text-[13px] font-medium text-foreground/90 truncate" title={briefName}>
            {briefName}
          </p>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
        {briefName ? (
          sectionLabels.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                {label}
              </label>
              <div className="text-[13px] text-foreground/90 bg-card border border-border/50 rounded-md px-3 py-2 min-h-[60px]">
                {sections?.[key] ?? (
                  <span className="text-muted-foreground/60 italic">—</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            Select a briefing row to view or edit the working doc here.
          </p>
        )}
      </div>
    </div>
  )
}
