'use client'

import { useState, useCallback } from 'react'
import { ExternalLink, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const match = trimmed.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)(?:\/.*?node-id=(\d+[-]\d+))?/)
  if (!match) return null
  const fileKey = match[1]
  const nodeId = match[2] ? match[2].replace('-', ':') : ''
  return { fileKey, nodeId }
}

interface BriefLinkCellProps {
  value: string | null
  accessible?: boolean
  onSave?: (link: string) => Promise<void>
  className?: string
}

export function BriefLinkCell({ value, accessible, onSave, className }: BriefLinkCellProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  const handleBlur = useCallback(async () => {
    setEditing(false)
    const trimmed = input.trim()
    if (trimmed === (value ?? '')) return
    if (onSave && trimmed) {
      setSaving(true)
      try {
        await onSave(trimmed)
      } finally {
        setSaving(false)
      }
    }
  }, [input, value, onSave])

  const tryLoadThumb = useCallback(() => {
    const parsed = parseFigmaUrl(value ?? input)
    if (!parsed?.fileKey) return
    setChecking(true)
    setThumbUrl(null)
    const nodeIds = parsed.nodeId ? [parsed.nodeId] : []
    const params = new URLSearchParams({ fileKey: parsed.fileKey })
    if (nodeIds.length) params.set('nodeId', parsed.nodeId)
    fetch(`/api/feedback/variants?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.accessible && d.thumbnails) {
          const first = Object.values(d.thumbnails)[0]
          setThumbUrl(typeof first === 'string' ? first : null)
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [value, input])

  const displayUrl = value ?? input
  const parsed = displayUrl ? parseFigmaUrl(displayUrl) : null
  const isFigma = displayUrl.includes('figma.com')

  if (editing) {
    return (
      <td className={cn('align-top px-2 py-1 border-b border-border/50', className)}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          placeholder="Paste Figma or brief link..."
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </td>
    )
  }

  return (
    <td className={cn('align-top px-2 py-2 border-b border-border/50', className)}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {checking ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : thumbUrl ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 block w-12 h-8 rounded border border-border overflow-hidden"
          >
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
          </a>
        ) : null}
        {displayUrl ? (
          <>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate max-w-[180px]"
              title={displayUrl}
            >
              {isFigma ? 'Figma link' : 'Link'}
            </a>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground"
          title="Edit link"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        {isFigma && parsed?.fileKey && !thumbUrl && !checking && (
          <button
            type="button"
            onClick={tryLoadThumb}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Load preview
          </button>
        )}
      </div>
    </td>
  )
}
