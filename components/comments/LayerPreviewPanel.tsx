'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Layers,
  Sparkles,
} from 'lucide-react'

interface LayerPreviewPanelProps {
  nodeId: string | null
  nodeName: string
  thumbnailUrl: string | null
  commentCount: number
  openCount: number
  resolvedCount: number
  latestAuthor?: string
  latestTime?: string
  fileKey: string
  commentMessages: string[]
  summary?: string
  summaryLoading?: boolean
}

export function LayerPreviewPanel({
  nodeId,
  nodeName,
  thumbnailUrl,
  commentCount,
  openCount,
  resolvedCount,
  latestAuthor,
  latestTime,
  fileKey,
  summary,
  summaryLoading,
}: LayerPreviewPanelProps) {
  const [imageError, setImageError] = useState(false)
  const [dynamicThumbnail, setDynamicThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)

  useEffect(() => {
    setImageError(false)
    setDynamicThumbnail(null)
  }, [nodeId])

  useEffect(() => {
    if (thumbnailUrl || !nodeId || dynamicThumbnail) return
    setThumbnailLoading(true)
    fetch(`/api/comments/thumbnail?fileKey=${encodeURIComponent(fileKey)}&nodeId=${encodeURIComponent(nodeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.thumbnailUrl) setDynamicThumbnail(data.thumbnailUrl)
      })
      .catch(() => {})
      .finally(() => setThumbnailLoading(false))
  }, [nodeId, fileKey, thumbnailUrl, dynamicThumbnail])

  const effectiveUrl = thumbnailUrl ?? dynamicThumbnail
  const proxyUrl = effectiveUrl
    ? `/api/images/proxy?url=${encodeURIComponent(effectiveUrl)}`
    : null

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Section label */}
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium select-none">
        Layer Preview
      </span>

      {/* Layer name + stats */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
          <h3 className="text-sm font-medium text-foreground leading-snug truncate" title={nodeName}>
            {nodeName}
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </span>
          {openCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400/70">
              <AlertCircle className="h-3 w-3" />
              {openCount} open
            </span>
          )}
          {resolvedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400/70">
              <CheckCircle className="h-3 w-3" />
              {resolvedCount}
            </span>
          )}
        </div>

        {latestAuthor && (
          <p className="text-[10px] text-muted-foreground/40">
            Latest by {latestAuthor}
            {latestTime && ` · ${latestTime}`}
          </p>
        )}
      </div>

      {/* AI Summary */}
      {(summary || summaryLoading) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {summaryLoading && !summary ? (
              <Loader2 className="h-3 w-3 text-muted-foreground/30 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 text-primary/50" />
            )}
            <span className="text-[10px] uppercase tracking-wider text-primary/40 font-medium">
              Summary
            </span>
          </div>
          {summary ? (
            <p className="text-[13px] leading-relaxed text-foreground/70">{summary}</p>
          ) : (
            <div className="space-y-1.5">
              <div className="h-3 bg-muted/20 rounded animate-pulse w-full" />
              <div className="h-3 bg-muted/20 rounded animate-pulse w-4/5" />
            </div>
          )}
        </div>
      )}

      {/* Layer thumbnail */}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border/30 bg-muted/10 flex items-center justify-center">
        {proxyUrl && !imageError ? (
          <img
            src={proxyUrl}
            alt={nodeName}
            className="max-w-full max-h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : thumbnailLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px]">Loading preview...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[10px]">
              {imageError ? 'Failed to load preview' : 'No preview available'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
