'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommentHeader } from './CommentHeader'
import { CommentTable } from './CommentTable'
import { LayerPreviewPanel } from './LayerPreviewPanel'

// ── Types ────────────────────────────────────────────────────────

export interface EnrichedComment {
  id: string
  orderNumber: number | null
  author: string
  authorAvatar: string
  message: string
  createdAt: string
  resolvedAt: string | null
  status: 'open' | 'resolved'
  threadDepth: number
  replyCount: number
  parentId: string | null
}

export interface CommentLayer {
  nodeId: string | null
  nodeName: string
  thumbnailUrl: string | null
  comments: EnrichedComment[]
}

export interface CommentPageTab {
  pageId: string
  pageName: string
  layers: CommentLayer[]
  commentCount: number
  openCount: number
  resolvedCount: number
}

export interface CommentSheetData {
  fileName: string
  fileKey: string
  pages: CommentPageTab[]
}

interface CommentSheetProps {
  data: CommentSheetData
}

// ── Helpers ──────────────────────────────────────────────────────

function shortenPageName(name: string): string {
  const parts = name.split(/\s*[-—]\s*/)
  if (parts.length > 1) {
    return parts.slice(0, 2).join(' - ')
  }
  return name.length > 40 ? name.slice(0, 37) + '...' : name
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

// ── Thumbnail + Summary loading hooks ────────────────────────────

type ThumbnailMap = Record<string, string>
type SummaryMap = Record<string, string>

/**
 * Fetch summaries with concurrency limit to avoid overwhelming the API.
 */
async function fetchSummariesWithConcurrency(
  layers: CommentLayer[],
  fileKey: string,
  concurrency: number,
  onResult: (nodeKey: string, summary: string) => void
) {
  const queue = layers
    .filter((l) => l.comments.length > 0)
    .map((l) => ({
      nodeKey: l.nodeId ?? '__canvas__',
      nodeId: l.nodeId,
      nodeName: l.nodeName,
      messages: l.comments.map((c) => `${c.author}: ${c.message}`),
    }))

  let idx = 0
  async function next(): Promise<void> {
    while (idx < queue.length) {
      const item = queue[idx++]
      try {
        const res = await fetch('/api/comments/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comments: item.messages,
            nodeName: item.nodeName,
            fileKey,
            nodeId: item.nodeId ?? '__canvas__',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.summary) onResult(item.nodeKey, data.summary)
        }
      } catch {
        // silently skip failed summaries
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => next()))
}

// ── Component ────────────────────────────────────────────────────

export function CommentSheet({ data }: CommentSheetProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(true)
  const [selectedLayerKey, setSelectedLayerKey] = useState<string | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)

  // Per-page caches: pageId -> map of nodeKey -> url/summary
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, ThumbnailMap>>({})
  const [summaryCache, setSummaryCache] = useState<Record<string, SummaryMap>>({})
  const [thumbnailsLoading, setThumbnailsLoading] = useState<Record<string, boolean>>({})
  const [summariesLoading, setSummariesLoading] = useState<Record<string, boolean>>({})

  const activePage = data.pages[activeTabIndex] ?? null
  const pageId = activePage?.pageId ?? ''
  const layers = activePage?.layers ?? []

  const effectiveLayerKey = selectedLayerKey ?? layers[0]?.nodeId ?? '__canvas__'

  const selectedLayer = useMemo(
    () => layers.find((l) => (l.nodeId ?? '__canvas__') === effectiveLayerKey) ?? layers[0] ?? null,
    [layers, effectiveLayerKey]
  )

  // Totals across all pages
  const totalComments = data.pages.reduce((s, p) => s + p.commentCount, 0)
  const totalOpen = data.pages.reduce((s, p) => s + p.openCount, 0)
  const totalResolved = data.pages.reduce((s, p) => s + p.resolvedCount, 0)

  const layerOpenCount = selectedLayer?.comments.filter((c) => c.status === 'open').length ?? 0
  const layerResolvedCount = selectedLayer?.comments.filter((c) => c.status === 'resolved').length ?? 0
  const latestComment = selectedLayer?.comments[0] ?? null
  const layerCommentMessages = selectedLayer?.comments.map((c) => c.message) ?? []

  // ── Batch-fetch thumbnails when page tab changes ────────────
  useEffect(() => {
    if (!pageId || !activePage) return
    if (thumbnailCache[pageId] || thumbnailsLoading[pageId]) return

    const nodeIds = layers
      .map((l) => l.nodeId)
      .filter((id): id is string => id !== null)

    if (nodeIds.length === 0) return

    setThumbnailsLoading((prev) => ({ ...prev, [pageId]: true }))

    fetch(
      `/api/comments/thumbnails?fileKey=${encodeURIComponent(data.fileKey)}&nodeIds=${encodeURIComponent(nodeIds.join(','))}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.thumbnails) {
          setThumbnailCache((prev) => ({ ...prev, [pageId]: d.thumbnails }))
        }
      })
      .catch(() => {})
      .finally(() => {
        setThumbnailsLoading((prev) => ({ ...prev, [pageId]: false }))
      })
  }, [pageId, activePage, layers, data.fileKey, thumbnailCache, thumbnailsLoading])

  // ── Fetch summaries in parallel (capped concurrency) ────────
  useEffect(() => {
    if (!pageId || !activePage) return
    if (summaryCache[pageId] || summariesLoading[pageId]) return
    if (layers.length === 0) return

    setSummariesLoading((prev) => ({ ...prev, [pageId]: true }))

    const pageSummaries: SummaryMap = {}

    fetchSummariesWithConcurrency(layers, data.fileKey, 3, (nodeKey, summary) => {
      pageSummaries[nodeKey] = summary
      // Progressive update: each summary appears as it arrives
      setSummaryCache((prev) => ({
        ...prev,
        [pageId]: { ...(prev[pageId] ?? {}), [nodeKey]: summary },
      }))
    }).finally(() => {
      setSummariesLoading((prev) => ({ ...prev, [pageId]: false }))
    })
  }, [pageId, activePage, layers, summaryCache, summariesLoading])

  // Current page's thumbnail and summary maps
  const currentThumbnails = thumbnailCache[pageId] ?? {}
  const currentSummaries = summaryCache[pageId] ?? {}
  const areThumbnailsLoading = thumbnailsLoading[pageId] ?? false
  const areSummariesLoading = summariesLoading[pageId] ?? false

  const handleSelectLayer = useCallback((nodeId: string | null) => {
    setSelectedLayerKey(nodeId ?? '__canvas__')
  }, [])

  const switchTab = useCallback((idx: number) => {
    setActiveTabIndex(idx)
    setSelectedLayerKey(null)
  }, [])

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <CommentHeader
        fileName={data.fileName}
        fileKey={data.fileKey}
        totalComments={totalComments}
        openCount={totalOpen}
        resolvedCount={totalResolved}
        activePageName={activePage?.pageName}
      />

      {/* Main content: left preview panel + right table */}
      <div className="flex flex-1 min-h-0">
        {/* Left preview panel — collapsible */}
        <aside
          className={cn(
            'flex-shrink-0 border-r border-primary/20 bg-primary/[0.03] flex flex-col transition-all duration-300 ease-in-out relative',
            previewPanelOpen
              ? 'w-[380px] pt-4 pb-4'
              : 'w-0 pt-4 pb-4 overflow-hidden border-r-0'
          )}
        >
          {previewPanelOpen && selectedLayer && (
            <LayerPreviewPanel
              nodeId={selectedLayer.nodeId}
              nodeName={selectedLayer.nodeName}
              thumbnailUrl={currentThumbnails[selectedLayer.nodeId ?? ''] ?? selectedLayer.thumbnailUrl}
              commentCount={selectedLayer.comments.length}
              openCount={layerOpenCount}
              resolvedCount={layerResolvedCount}
              latestAuthor={latestComment?.author}
              latestTime={latestComment ? formatRelativeTime(latestComment.createdAt) : undefined}
              fileKey={data.fileKey}
              commentMessages={layerCommentMessages}
              summary={currentSummaries[selectedLayer.nodeId ?? '__canvas__']}
              summaryLoading={areSummariesLoading}
            />
          )}
        </aside>

        {/* Collapse/expand toggle */}
        <button
          onClick={() => setPreviewPanelOpen((v) => !v)}
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-5 hover:bg-muted/40 transition-colors',
            'text-muted-foreground/40 hover:text-muted-foreground/70',
            'border-r border-border/30'
          )}
          aria-label={previewPanelOpen ? 'Hide preview panel' : 'Show preview panel'}
          title={previewPanelOpen ? 'Hide preview' : 'Show preview'}
        >
          {previewPanelOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Table + tab bar + footer */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Comment table */}
          <CommentTable
            layers={layers}
            selectedLayerNodeId={effectiveLayerKey}
            onSelectLayer={handleSelectLayer}
            thumbnails={currentThumbnails}
            summaries={currentSummaries}
            thumbnailsLoading={areThumbnailsLoading}
            summariesLoading={areSummariesLoading}
          />

          {/* Bottom tab bar (pages) */}
          {data.pages.length > 1 && (
            <div className="flex-shrink-0 border-t border-border bg-card/40">
              <div
                ref={tabBarRef}
                className="flex overflow-x-auto scrollbar-thin px-2 gap-0"
              >
                {data.pages.map((page, idx) => (
                  <button
                    key={page.pageId}
                    onClick={() => switchTab(idx)}
                    className={cn(
                      'flex-shrink-0 px-4 py-2 text-xs font-medium transition-all',
                      'border-t-2 whitespace-nowrap',
                      'hover:text-foreground hover:bg-muted/30',
                      idx === activeTabIndex
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {page.resolvedCount === page.commentCount && page.commentCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[200px]">
                        {shortenPageName(page.pageName)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                        ({page.commentCount})
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="flex-shrink-0 border-t border-border/50 px-5 py-2 bg-card/20">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                {activePage?.commentCount ?? 0} comments on this page
                {activePage?.layers.length ? ` · ${activePage.layers.length} layers` : ''}
              </span>
              <span>Powered by Heimdall</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
