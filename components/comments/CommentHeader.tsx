'use client'

import { Download, MessageSquare, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommentHeaderProps {
  fileName: string
  fileKey: string
  totalComments: number
  openCount: number
  resolvedCount: number
  activePageName?: string
}

export function CommentHeader({
  fileName,
  fileKey,
  totalComments,
  openCount,
  resolvedCount,
  activePageName,
}: CommentHeaderProps) {
  const handleDownloadCsv = () => {
    window.open(`/api/comments?fileKey=${encodeURIComponent(fileKey)}&format=csv`, '_blank')
  }

  return (
    <header className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Branding + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <a
              href="/"
              className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Heimdall
              </span>
              <span className="text-xs text-muted-foreground/40 font-medium">
                Comments
              </span>
            </div>

            <div className="h-5 w-px bg-border/60 flex-shrink-0" />

            <div className="min-w-0">
              <h1 className="text-sm font-medium text-foreground truncate" title={fileName}>
                {fileName}
              </h1>
              {activePageName && (
                <p className="text-[11px] text-muted-foreground/60 truncate">
                  {activePageName}
                </p>
              )}
            </div>
          </div>

          {/* Right: Stats + Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Stats */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {totalComments}
              </span>
              <span className="flex items-center gap-1 text-blue-400/70">
                <AlertCircle className="h-3 w-3" />
                {openCount} open
              </span>
              <span className="flex items-center gap-1 text-emerald-400/70">
                <CheckCircle className="h-3 w-3" />
                {resolvedCount} resolved
              </span>
            </div>

            {/* CSV download */}
            <button
              onClick={handleDownloadCsv}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
                'border border-border text-muted-foreground',
                'hover:bg-muted/50 hover:text-foreground transition-colors'
              )}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
