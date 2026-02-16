'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface FeedbackCellProps {
  role: 'strategy' | 'design' | 'copy'
  value: string
  experimentId: string
  onSave: (payload: { experiment_id: string; role: string; content: string }) => Promise<void>
  className?: string
}

const ROLE_LABEL: Record<string, string> = {
  strategy: 'Strategy',
  design: 'Design',
  copy: 'Copy',
}

export function FeedbackCell({ role, value, experimentId, onSave, className }: FeedbackCellProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(value)
  const [saving, setSaving] = useState(false)

  const handleBlur = useCallback(async () => {
    setEditing(false)
    if (input === value) return
    setSaving(true)
    try {
      await onSave({ experiment_id: experimentId, role, content: input })
    } finally {
      setSaving(false)
    }
  }, [input, value, experimentId, role, onSave])

  if (editing) {
    return (
      <td className={cn('align-top px-2 py-1 border-b border-border/50', className)}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={handleBlur}
          placeholder={`${ROLE_LABEL[role]} feedback…`}
          className="w-full min-h-[60px] rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary resize-y"
          autoFocus
        />
        {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </td>
    )
  }

  return (
    <td
      className={cn(
        'align-top px-2 py-2 border-b border-border/50 cursor-pointer hover:bg-muted/30 min-w-[140px]',
        className
      )}
      onClick={() => setEditing(true)}
    >
      <span className="text-[10px] text-muted-foreground block mb-0.5">{ROLE_LABEL[role]}</span>
      <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-3">
        {value || <span className="text-muted-foreground">Click to add…</span>}
      </p>
    </td>
  )
}
