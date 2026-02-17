'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LayoutGrid,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BriefingWorkingDocPanel } from './BriefingWorkingDocPanel'
import { BriefingAssignmentsTable } from './BriefingAssignmentsTable'
import type { BriefingAssignment } from '@/src/domain/briefingAssistant/schema'
import type { SplitOutput } from '@/src/domain/briefingAssistant/split'

const DEFAULT_BATCH_KEY = '2026-01'
const DEFAULT_BATCH_LABEL = 'January 2026'
const DEFAULT_TOTAL_ASSETS = 210
const DEFAULT_MAX_BRIEFS = 53

export function BriefingAssistantSheet() {
  const [previewPanelOpen, setPreviewPanelOpen] = useState(true)
  const [splitResult, setSplitResult] = useState<SplitOutput | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [batchKey, setBatchKey] = useState(DEFAULT_BATCH_KEY)
  const [batchLabel, setBatchLabel] = useState(DEFAULT_BATCH_LABEL)
  const [totalAssets, setTotalAssets] = useState(DEFAULT_TOTAL_ASSETS)
  const [maxBriefs, setMaxBriefs] = useState(DEFAULT_MAX_BRIEFS)

  const runSplit = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/briefing-assistant/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchKey,
          batchLabel,
          totalAssets,
          maxBriefs,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Split failed')
        return
      }
      setSplitResult(data)
      setSelectedAssignmentId(data.assignments?.[0]?.id ?? null)
    } catch {
      setError('Request failed')
    } finally {
      setLoading(false)
    }
  }, [batchKey, batchLabel, totalAssets, maxBriefs])

  const assignments: BriefingAssignment[] = splitResult?.assignments ?? []
  const selected = assignments.find((a) => a.id === selectedAssignmentId)

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <header className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="px-5 py-3.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                href="/sheets"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                aria-label="Back to sheets"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Heimdall
                </span>
                <span className="text-xs text-muted-foreground/40 font-medium">
                  Briefing Assistant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-muted-foreground text-xs">Batch</label>
                <input
                  type="text"
                  value={batchKey}
                  onChange={(e) => setBatchKey(e.target.value)}
                  placeholder="2026-01"
                  className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-muted-foreground text-xs">Assets</label>
                <input
                  type="number"
                  min={1}
                  value={totalAssets}
                  onChange={(e) => setTotalAssets(Number(e.target.value) || 210)}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-muted-foreground text-xs">Max briefs</label>
                <input
                  type="number"
                  min={1}
                  value={maxBriefs}
                  onChange={(e) => setMaxBriefs(Number(e.target.value) || 53)}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <Button onClick={runSplit} disabled={loading} size="sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">Run split</span>
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
          {splitResult ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              {splitResult.allocation.briefCount} briefs · {splitResult.allocation.totalAssets} assets
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={cn(
            'flex-shrink-0 border-r border-primary/20 bg-primary/[0.03] flex flex-col transition-all duration-300 ease-in-out',
            previewPanelOpen ? 'w-[380px] pt-4 pb-4' : 'w-0 overflow-hidden border-r-0'
          )}
        >
          {previewPanelOpen ? (
            <BriefingWorkingDocPanel
              briefName={selected?.briefName}
              sections={undefined}
              readOnly
            />
          ) : null}
        </aside>

        <button
          type="button"
          onClick={() => setPreviewPanelOpen((v) => !v)}
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-5 hover:bg-muted/40 transition-colors',
            'text-muted-foreground/40 hover:text-muted-foreground/70 border-r border-border/30'
          )}
          aria-label={previewPanelOpen ? 'Hide working doc' : 'Show working doc'}
        >
          {previewPanelOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex flex-col flex-1 min-w-0">
          <BriefingAssignmentsTable
            assignments={assignments}
            selectedId={selectedAssignmentId}
            onSelect={setSelectedAssignmentId}
            loading={loading}
          />
          <footer className="flex-shrink-0 border-t border-border/50 px-5 py-2 bg-card/20">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <LayoutGrid className="h-3 w-3" />
                {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
              </span>
              <span>Powered by Heimdall</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
