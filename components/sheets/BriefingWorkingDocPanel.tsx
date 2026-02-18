'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, X } from 'lucide-react'
import type { WorkingDocSections } from '@/src/domain/briefingAssistant/schema'

const SECTION_KEYS: (keyof WorkingDocSections)[] = [
  'idea',
  'why',
  'audience',
  'product',
  'visual',
  'copyInfo',
  'test',
  'variants',
]

const SECTION_LABELS: Record<keyof WorkingDocSections, string> = {
  idea: 'Idea',
  why: 'Why',
  audience: 'Audience',
  product: 'Product',
  visual: 'Visual',
  copyInfo: 'Copy info',
  test: 'Test',
  variants: 'Variants',
}

interface BriefingWorkingDocPanelProps {
  /** Assignment id for saving (required when editable). */
  assignmentId?: string | null
  /** Assignment brief name for context. */
  briefName?: string
  /** Working doc sections (from API / parent). */
  sections?: WorkingDocSections
  /** Whether the panel is read-only (no textareas). */
  readOnly?: boolean
  /** Called when user blurs a section after edit. Parent should PATCH and refetch. */
  onSaveSections?: (assignmentId: string, sections: WorkingDocSections) => void | Promise<void>
  /** Called when user clicks the panel close button. */
  onClose?: () => void
}

export function BriefingWorkingDocPanel({
  assignmentId,
  briefName,
  sections,
  readOnly = true,
  onSaveSections,
  onClose,
}: BriefingWorkingDocPanelProps) {
  const [localSections, setLocalSections] = useState<WorkingDocSections>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalSections(sections ?? {})
  }, [sections, assignmentId])

  const handleSectionChange = useCallback((key: keyof WorkingDocSections, value: string) => {
    setLocalSections((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSectionBlur = useCallback(async () => {
    if (!assignmentId || !onSaveSections) return
    setSaving(true)
    try {
      await onSaveSections(assignmentId, localSections)
    } finally {
      setSaving(false)
    }
  }, [assignmentId, onSaveSections, localSections])

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground truncate" title={briefName ?? 'Working doc'}>
            {briefName ?? 'Working doc'}
          </span>
          {saving ? (
            <span className="text-xs text-muted-foreground shrink-0">Saving…</span>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
        {briefName && assignmentId ? (
          SECTION_KEYS.map((key) => (
            <div key={key} className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                {SECTION_LABELS[key]}
              </label>
              {readOnly ? (
                <div className="text-[13px] text-foreground/90 bg-card border border-border/50 rounded-md px-3 py-2 min-h-[60px]">
                  {localSections[key] ?? (
                    <span className="text-muted-foreground/60 italic">—</span>
                  )}
                </div>
              ) : (
                <textarea
                  value={localSections[key] ?? ''}
                  onChange={(e) => handleSectionChange(key, e.target.value)}
                  onBlur={handleSectionBlur}
                  placeholder="—"
                  className="w-full text-[13px] text-foreground/90 bg-card border border-border/50 rounded-md px-3 py-2 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                />
              )}
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
