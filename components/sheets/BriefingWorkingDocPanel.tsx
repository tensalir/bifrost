'use client'

import { useState, useEffect, useCallback } from 'react'
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
}

export function BriefingWorkingDocPanel({
  assignmentId,
  briefName,
  sections,
  readOnly = true,
  onSaveSections,
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
      <div
        className="px-5 border-y border-primary/20 flex items-center flex-shrink-0"
        style={{ height: 38 }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 leading-none">
          Working doc
        </span>
        {saving ? (
          <span className="ml-2 text-[10px] text-muted-foreground">Saving…</span>
        ) : null}
      </div>

      {briefName ? (
        <div className="px-4 py-3 flex-shrink-0 mx-4 mt-3 rounded-md bg-primary/[0.06] border border-primary/15">
          <p className="text-[13px] font-medium text-foreground/90 truncate" title={briefName}>
            {briefName}
          </p>
        </div>
      ) : null}

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
