'use client'

import { CheckCircle, AlertCircle, MessageSquare, ChevronRight, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────

interface EnrichedComment {
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

interface CommentLayer {
  nodeId: string | null
  nodeName: string
  thumbnailUrl: string | null
  comments: EnrichedComment[]
}

interface CommentTableProps {
  layers: CommentLayer[]
  selectedLayerNodeId: string | null
  onSelectLayer: (nodeId: string | null) => void
  thumbnails: Record<string, string>
  summaries: Record<string, string>
  thumbnailsLoading: boolean
  summariesLoading: boolean
}

// ── Helpers ──────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── CommentTable ─────────────────────────────────────────────────

export function CommentTable({
  layers,
  selectedLayerNodeId,
  onSelectLayer,
}: CommentTableProps) {
  if (layers.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-muted-foreground/40">
        <MessageSquare className="h-8 w-8 mb-2" />
        <p className="text-sm">No comments on this page</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
      <div className="flex-shrink-0 pt-4">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '44%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="border-y border-border">
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50">
                Layer
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50">
                Author
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50">
                Comment
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50">
                Time
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '44%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <tbody>
            {layers.map((layer) => (
              <LayerGroup
                key={layer.nodeId ?? '__canvas__'}
                layer={layer}
                isSelected={selectedLayerNodeId === (layer.nodeId ?? '__canvas__')}
                onSelect={() => onSelectLayer(layer.nodeId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Layer Group ──────────────────────────────────────────────────

interface LayerGroupProps {
  layer: CommentLayer
  isSelected: boolean
  onSelect: () => void
}

function LayerGroup({ layer, isSelected, onSelect }: LayerGroupProps) {
  const openCount = layer.comments.filter((c) => c.status === 'open').length
  const resolvedCount = layer.comments.filter((c) => c.status === 'resolved').length

  return (
    <>
      {/* Layer header row */}
      <tr
        onClick={onSelect}
        className={cn(
          'cursor-pointer transition-colors border-b border-border/40',
          isSelected
            ? 'bg-primary/5 hover:bg-primary/8'
            : 'bg-muted/10 hover:bg-muted/20'
        )}
      >
        <td colSpan={5} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground/50 transition-transform flex-shrink-0',
                isSelected && 'rotate-90 text-primary/70'
              )}
            />
            <Layers className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
            <span className={cn(
              'text-xs font-medium truncate',
              isSelected ? 'text-primary' : 'text-foreground/80'
            )}>
              {layer.nodeName}
            </span>
            <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
              {layer.comments.length} comment{layer.comments.length !== 1 ? 's' : ''}
            </span>
            {openCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-blue-400/60 flex-shrink-0">
                <AlertCircle className="h-2.5 w-2.5" />
                {openCount}
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/60 flex-shrink-0">
                <CheckCircle className="h-2.5 w-2.5" />
                {resolvedCount}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Comment rows */}
      {layer.comments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} />
      ))}
    </>
  )
}

// ── Comment Row ──────────────────────────────────────────────────

function CommentRow({ comment }: { comment: EnrichedComment }) {
  const isReply = comment.threadDepth > 0

  return (
    <tr className={cn(
      'group border-b border-border/20 hover:bg-muted/10 transition-colors',
      isReply && 'bg-muted/5'
    )}>
      {/* Layer column: comment number or reply indicator */}
      <td className="px-3 py-2 text-xs text-muted-foreground/30 border-r border-border/20 align-top">
        {isReply && (
          <span className="inline-block ml-4 text-muted-foreground/20">↳ reply</span>
        )}
        {!isReply && comment.orderNumber && (
          <span className="font-mono text-muted-foreground/40">#{comment.orderNumber}</span>
        )}
      </td>

      {/* Author */}
      <td className="px-3 py-2 border-r border-border/20 align-top">
        <div className="flex items-center gap-1.5 min-w-0">
          {comment.authorAvatar && (
            <img
              src={comment.authorAvatar}
              alt=""
              className="w-4 h-4 rounded-full flex-shrink-0"
              loading="lazy"
            />
          )}
          <span className="text-xs font-medium text-foreground/80 truncate">
            {comment.author}
          </span>
        </div>
      </td>

      {/* Comment message */}
      <td className="px-3 py-2 border-r border-border/20 align-top">
        <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap block">
          {comment.message}
        </span>
      </td>

      {/* Time */}
      <td className="px-3 py-2 border-r border-border/20 align-top">
        <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap" title={comment.createdAt}>
          {formatRelativeTime(comment.createdAt)}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2 align-top">
        {comment.status === 'resolved' ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/70 font-medium">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-blue-400/60 font-medium">
            <AlertCircle className="h-3 w-3" />
            Open
          </span>
        )}
      </td>
    </tr>
  )
}
