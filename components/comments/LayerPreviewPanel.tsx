'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Image as ImageIcon,
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
  thumbnailUrl,
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
    <div className="flex flex-col h-full">
      {/* Summary header — matches table th row exactly */}
      <div className="px-5 border-y border-primary/20 flex items-center" style={{ height: 38 }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/70 leading-none">
          Feedback Summary
        </span>
      </div>

      {/* Summary content */}
      <div className="px-4 py-3 flex-shrink-0 mx-4 mt-3 rounded-md bg-primary/[0.06] border border-primary/15">
        {summary ? (
          <p className="text-[13px] leading-relaxed text-foreground/70">{summary}</p>
        ) : summaryLoading ? (
          <div className="space-y-1.5">
            <div className="h-3 bg-primary/10 rounded animate-pulse w-full" />
            <div className="h-3 bg-primary/10 rounded animate-pulse w-4/5" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/30 italic">No summary yet</p>
        )}
      </div>

      {/* Layer thumbnail */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center mx-4 mb-4">
        {proxyUrl && !imageError ? (
          <img
            src={proxyUrl}
            alt=""
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
