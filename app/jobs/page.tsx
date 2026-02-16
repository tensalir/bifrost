'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, X, ExternalLink, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'all'

interface PendingSyncJob {
  id: string
  idempotencyKey: string
  mondayItemId: string
  mondayBoardId: string
  batchCanonical: string
  figmaFileKey: string | null
  expectedFileName: string
  experimentPageName: string
  briefingPayload: unknown
  nodeMapping?: Array<{ nodeName: string; value: string }>
  frameRenames?: Array<{ oldName: string; newName: string }>
  images?: Array<{ url: string; name: string; source: string }>
  state: string
  createdAt: string
  updatedAt: string
  figmaPageId?: string | null
  figmaFileUrl?: string | null
  errorCode?: string | null
}

interface QueueStats {
  queued: number
  running: number
  completed: number
  failed: number
  total: number
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const s = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`
  return `${Math.floor(s / 86400)} d ago`
}

function StatusBadge({ state }: { state: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    queued: 'default',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
  }
  return <Badge variant={variants[state] ?? 'outline'}>{state}</Badge>
}

const validStates: JobState[] = ['all', 'queued', 'running', 'completed', 'failed']

function JobsPageContent() {
  const searchParams = useSearchParams()
  const stateFromUrl = searchParams.get('state')
  const initialFilter = stateFromUrl && validStates.includes(stateFromUrl as JobState) ? (stateFromUrl as JobState) : 'all'

  const [jobs, setJobs] = useState<PendingSyncJob[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [filter, setFilter] = useState<JobState>(initialFilter)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailJob, setDetailJob] = useState<PendingSyncJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    const stateParam = filter === 'all' ? '' : `&state=${filter}`
    const res = await fetch(`/api/jobs?limit=100${stateParam}`)
    if (res.ok) {
      const data = await res.json()
      setJobs(data.jobs ?? [])
    }
  }, [filter])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats ?? null)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchJobs(), fetchStats()])
    setLoading(false)
  }, [fetchJobs, fetchStats])

  useEffect(() => {
    const s = searchParams.get('state')
    if (s && validStates.includes(s as JobState)) setFilter(s as JobState)
  }, [searchParams])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    if (!selectedId) {
      setDetailJob(null)
      return
    }
    let cancelled = false
    fetch(`/api/jobs/${selectedId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((job) => {
        if (!cancelled && job) setDetailJob(job)
      })
    return () => { cancelled = true }
  }, [selectedId])

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId)
    try {
      const res = await fetch('/api/jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (res.ok) await refresh()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.message || data.error || 'Retry failed')
      }
    } finally {
      setRetrying(null)
    }
  }

  const tabs: { key: JobState; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: stats?.total },
    { key: 'queued', label: 'Queued', count: stats?.queued },
    { key: 'running', label: 'Running', count: stats?.running },
    { key: 'completed', label: 'Completed', count: stats?.completed },
    { key: 'failed', label: 'Failed', count: stats?.failed },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">All briefing sync jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Auto-refresh 10s</span>
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {label} {count != null ? `(${count})` : ''}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
          <CardDescription>Click a row to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Experiment</th>
                  <th className="text-left p-4 font-medium">Batch</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Created</th>
                  <th className="text-left p-4 font-medium">Monday ID</th>
                  <th className="text-left p-4 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr
                      key={job.id}
                      className={cn(
                        'border-b last:border-0 hover:bg-accent/50 cursor-pointer',
                        selectedId === job.id && 'bg-accent/70'
                      )}
                      onClick={() => setSelectedId(selectedId === job.id ? null : job.id)}
                    >
                      <td className="p-4">
                        <div className="font-medium">{job.experimentPageName}</div>
                        {job.figmaFileUrl && (
                          <a
                            href={job.figmaFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View in Figma
                          </a>
                        )}
                      </td>
                      <td className="p-4 text-sm">{job.batchCanonical}</td>
                      <td className="p-4">
                        <StatusBadge state={job.state} />
                      </td>
                      <td className="p-4 text-sm text-muted-foreground" title={job.createdAt}>
                        {relativeTime(job.createdAt)}
                      </td>
                      <td className="p-4 text-sm font-mono">{job.mondayItemId}</td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        {job.state === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(job.id)}
                            disabled={retrying === job.id}
                          >
                            {retrying === job.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {detailJob && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Job details</h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Experiment</p>
              <p className="font-medium">{detailJob.experimentPageName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Batch</p>
              <p>{detailJob.batchCanonical}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <StatusBadge state={detailJob.state} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monday</p>
              <a
                href={`https://tensalir.monday.com/boards/${detailJob.mondayBoardId}/pulses/${detailJob.mondayItemId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Item {detailJob.mondayItemId} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {detailJob.figmaFileUrl && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Figma</p>
                <a
                  href={detailJob.figmaFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Open page <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {detailJob.state === 'failed' && detailJob.errorCode && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error</p>
                <p className="text-sm text-destructive font-mono">{detailJob.errorCode}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Timeline</p>
              <p className="text-sm">Created: {new Date(detailJob.createdAt).toLocaleString()}</p>
              <p className="text-sm">Updated: {new Date(detailJob.updatedAt).toLocaleString()}</p>
            </div>
            {detailJob.nodeMapping && detailJob.nodeMapping.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Node mapping (preview)</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(detailJob.nodeMapping.slice(0, 10), null, 2)}
                  {detailJob.nodeMapping.length > 10 ? '\n...' : ''}
                </pre>
              </div>
            )}
            {detailJob.frameRenames && detailJob.frameRenames.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Frame renames</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(detailJob.frameRenames, null, 2)}
                </pre>
              </div>
            )}
            {detailJob.images && detailJob.images.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Images ({detailJob.images.length})</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {detailJob.images.slice(0, 5).map((img, i) => (
                    <li key={i}>{img.name}</li>
                  ))}
                  {detailJob.images.length > 5 && <li>... and {detailJob.images.length - 5} more</li>}
                </ul>
              </div>
            )}
            {detailJob.state === 'failed' && (
              <Button
                className="w-full"
                onClick={() => handleRetry(detailJob.id)}
                disabled={retrying === detailJob.id}
              >
                {retrying === detailJob.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry this job
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading jobs…</div>}>
      <JobsPageContent />
    </Suspense>
  )
}
