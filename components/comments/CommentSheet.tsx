'use client'

import { useState, useRef, useMemo } from 'react'
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
  // Strip common prefixes for tab display
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

// ── Component ────────────────────────────────────────────────────

export function CommentSheet({ data }: CommentSheetProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(true)
  const [selectedLayerKey, setSelectedLayerKey] = useState<string | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)

  const activePage = data.pages[activeTabIndex] ?? null
  const layers = activePage?.layers ?? []

  // Auto-select first layer when switching tabs
  const effectiveLayerKey = selectedLayerKey ?? layers[0]?.nodeId ?? '__canvas__'

  const selectedLayer = useMemo(
    () => layers.find((l) => (l.nodeId ?? '__canvas__') === effectiveLayerKey) ?? layers[0] ?? null,
    [layers, effectiveLayerKey]
  )

  // Totals across all pages
  const totalComments = data.pages.reduce((s, p) => s + p.commentCount, 0)
  const totalOpen = data.pages.reduce((s, p) => s + p.openCount, 0)
  const totalResolved = data.pages.reduce((s, p) => s + p.resolvedCount, 0)

  // For the selected layer: compute stats for the left panel
  const layerOpenCount = selectedLayer?.comments.filter((c) => c.status === 'open').length ?? 0
  const layerResolvedCount = selectedLayer?.comments.filter((c) => c.status === 'resolved').length ?? 0
  const latestComment = selectedLayer?.comments[0] ?? null
  const layerCommentMessages = selectedLayer?.comments.map((c) => c.message) ?? []

  const handleSelectLayer = (nodeId: string | null) => {
    setSelectedLayerKey(nodeId ?? '__canvas__')
  }

  const switchTab = (idx: number) => {
    setActiveTabIndex(idx)
    setSelectedLayerKey(null)
  }

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
            'flex-shrink-0 border-r border-border/40 bg-card/20 flex flex-col transition-all duration-300 ease-in-out relative',
            previewPanelOpen
              ? 'w-[380px] px-5 py-4 gap-3'
              : 'w-0 px-0 py-4 overflow-hidden border-r-0'
          )}
        >
          {previewPanelOpen && selectedLayer && (
            <LayerPreviewPanel
              nodeId={selectedLayer.nodeId}
              nodeName={selectedLayer.nodeName}
              thumbnailUrl={selectedLayer.thumbnailUrl}
              commentCount={selectedLayer.comments.length}
              openCount={layerOpenCount}
              resolvedCount={layerResolvedCount}
              latestAuthor={latestComment?.author}
              latestTime={latestComment ? formatRelativeTime(latestComment.createdAt) : undefined}
              fileKey={data.fileKey}
              commentMessages={layerCommentMessages}
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
