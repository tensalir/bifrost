'use client'

import { Download, MessageSquare, CheckCircle, AlertCircle, ArrowLeft, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

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
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleDownloadCsv = () => {
    window.open(`/api/comments?fileKey=${encodeURIComponent(fileKey)}&format=csv`, '_blank')
  }

  return (
    <header className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Branding + File selector */}
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

            {/* File selector with dropdown */}
            <div className="relative min-w-0">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 min-w-0 hover:bg-muted/30 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
              >
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
                <ChevronDown className={cn(
                  'h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform',
                  dropdownOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[280px] rounded-lg border border-border bg-card shadow-lg py-1">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">
                      Figma Files
                    </div>
                    <a
                      href={`/comments/${fileKey}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </a>
                    <div className="border-t border-border/30 mt-1 pt-1">
                      <a
                        href="/comments"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Open a different file...
                      </a>
                    </div>
                  </div>
                </>
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
