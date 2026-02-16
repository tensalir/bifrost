'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  MessageSquare,
  Loader2,
  FileText,
  ClipboardList,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { Nav } from '@/components/nav'
import { cn } from '@/lib/utils'

const PERFORMANCE_ADS_PROJECT_ID = '387033831'
const PERFORMANCE_ADS_PROJECT_NAME = 'Performance Ads'

interface FigmaFile {
  key: string
  name: string
  thumbnail_url?: string
  last_modified?: string
}

interface FeedbackRound {
  id: string
  name: string
  monday_board_id: string
  created_at: string
}

/* -------------------------------------------------------------------------- */
/*  File Card                                                                 */
/* -------------------------------------------------------------------------- */

function FileCard({
  file,
  projectId,
  onClick,
}: {
  file: FigmaFile
  projectId: string
  onClick: () => void
}) {
  const modified = file.last_modified
    ? new Date(file.last_modified).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
    >
      <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        {modified && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Edited {modified}</p>
        )}
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Overview content (tabs + tab content)                                     */
/* -------------------------------------------------------------------------- */

function SheetsOverviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const activeTab = tab === 'stakeholder' ? 'stakeholder' : 'figma'

  const [figmaFiles, setFigmaFiles] = useState<FigmaFile[]>([])
  const [figmaLoading, setFigmaLoading] = useState(true)
  const [figmaError, setFigmaError] = useState<string | null>(null)

  const [rounds, setRounds] = useState<FeedbackRound[]>([])
  const [roundsLoading, setRoundsLoading] = useState(false)

  const fetchFigmaFiles = useCallback(async () => {
    setFigmaLoading(true)
    setFigmaError(null)
    try {
      const res = await fetch(`/api/figma/projects/${PERFORMANCE_ADS_PROJECT_ID}/files`)
      const data = await res.json()
      if (res.ok) {
        setFigmaFiles(data.files ?? [])
      } else {
        setFigmaError(data.error ?? 'Failed to load files')
      }
    } catch {
      setFigmaError('Failed to connect to Figma')
    } finally {
      setFigmaLoading(false)
    }
  }, [])

  const fetchRounds = useCallback(async () => {
    setRoundsLoading(true)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      if (res.ok && Array.isArray(data.rounds)) {
        setRounds(data.rounds)
      }
    } catch {
      setRounds([])
    } finally {
      setRoundsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFigmaFiles()
  }, [fetchFigmaFiles])

  useEffect(() => {
    if (activeTab === 'stakeholder') {
      fetchRounds()
    }
  }, [activeTab, fetchRounds])

  const setTab = (newTab: 'figma' | 'stakeholder') => {
    if (newTab === 'stakeholder') {
      router.push('/sheets?tab=stakeholder')
    } else {
      router.push('/sheets')
    }
  }

  const latestRound = rounds.length > 0 ? rounds[0] : null

  return (
    <main className="flex-1 min-h-0 overflow-auto flex flex-col">
      <div className="border-b border-border bg-card/40 px-6 py-3 flex items-center gap-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Feedback
        </h1>
        <div className="flex gap-0 rounded-lg p-0.5 bg-muted/50">
          <button
            onClick={() => setTab('figma')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'figma'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Figma Comments
          </button>
          <button
            onClick={() => setTab('stakeholder')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'stakeholder'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Stakeholder Feedback
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'figma' && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                {PERFORMANCE_ADS_PROJECT_NAME}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select a file to view and consolidate Figma comments.
              </p>
            </div>

            {figmaLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : figmaError ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{figmaError}</p>
              </div>
            ) : figmaFiles.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No files found in this project.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {figmaFiles.map((file) => (
                  <FileCard
                    key={file.key}
                    file={file}
                    projectId={PERFORMANCE_ADS_PROJECT_ID}
                    onClick={() =>
                      router.push(`/sheets/${file.key}?project=${PERFORMANCE_ADS_PROJECT_ID}`)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stakeholder' && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            {roundsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Link
                href="/sheets/stakeholder"
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-6 overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left w-full max-w-lg"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary shrink-0">
                  <ClipboardList className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Stakeholder Feedback
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Consolidate strategy, design, and copy feedback. Import from Excel, send to Monday.
                  </p>
                  {rounds.length > 0 && (
                    <p className="text-xs text-muted-foreground/80 mt-2">
                      {rounds.length} round{rounds.length !== 1 ? 's' : ''}
                      {latestRound && ` · Latest: ${latestRound.name}`}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0" />
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page: sidebar + overview                                                  */
/* -------------------------------------------------------------------------- */

function SheetsOverviewPage() {
  return (
    <div className="h-full flex overflow-hidden bg-background">
      <Nav />
      <SheetsOverviewContent />
    </div>
  )
}

export default function SheetsIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <SheetsOverviewPage />
    </Suspense>
  )
}
