'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, Activity, RefreshCw, Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QueueStats {
  queued: number
  running: number
  completed: number
  failed: number
  total: number
}

interface BatchStats {
  batchCanonical: string
  queued: number
  running: number
  completed: number
  failed: number
  total: number
}

interface HealthServices {
  monday: 'ok' | 'error' | 'unconfigured'
  figma: 'ok' | 'error' | 'unconfigured'
  kv: 'ok' | 'error' | 'unconfigured'
}

interface SetupChecks {
  kv: boolean
  monday: boolean
  figma: boolean
  routingMap: boolean
  webhookReceived: boolean
}

interface WebhookLogEntry {
  timestamp: string
  mondayItemId: string
  itemName: string
  outcome: 'queued' | 'filtered' | 'error'
  reason?: string
  errorMessage?: string
}

interface Job {
  id: string
  experimentPageName: string
  batchCanonical: string
  state: string
  createdAt: string
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string
  value: number
  icon: React.ElementType
  href?: string
}) {
  const content = (
    <Card className={href ? 'hover:bg-accent/50 transition-colors' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
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

export default function DashboardPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [batchStats, setBatchStats] = useState<BatchStats[]>([])
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [health, setHealth] = useState<HealthServices | null>(null)
  const [setup, setSetup] = useState<{ ready: boolean; checks: SetupChecks } | null>(null)
  const [webhookLog, setWebhookLog] = useState<WebhookLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, jobsRes, healthRes, setupRes, webhookRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/jobs?limit=10'),
        fetch('/api/health/deep'),
        fetch('/api/setup'),
        fetch('/api/webhooks/log?limit=5'),
      ])
      if (statsRes.ok) {
        const d = await statsRes.json()
        setStats(d.stats ?? null)
        setBatchStats(d.batchStats ?? [])
      }
      if (jobsRes.ok) {
        const d = await jobsRes.json()
        setRecentJobs(d.jobs ?? [])
      }
      if (healthRes.ok) {
        const d = await healthRes.json()
        setHealth(d.services ?? null)
      }
      if (setupRes.ok) {
        const d = await setupRes.json()
        setSetup(d)
      }
      if (webhookRes.ok) {
        const d = await webhookRes.json()
        setWebhookLog(d.entries ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [refresh])

  const serviceStatus = (s: 'ok' | 'error' | 'unconfigured') => {
    if (s === 'ok') return <Badge variant="default">Connected</Badge>
    if (s === 'unconfigured') return <Badge variant="secondary">Not configured</Badge>
    return <Badge variant="destructive">Error</Badge>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monday-to-Figma briefing sync status</p>
        </div>
        <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {setup && !setup.ready && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
            <CardDescription>Complete these steps to get Heimdall fully running</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                {setup.checks.kv ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>KV store connected</span>
              </li>
              <li className="flex items-center gap-2">
                {setup.checks.monday ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Monday API key configured</span>
              </li>
              <li className="flex items-center gap-2">
                {setup.checks.figma ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Figma API key configured</span>
              </li>
              <li className="flex items-center gap-2">
                {setup.checks.routingMap ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>
                  Routing map has at least one entry
                  {!setup.checks.routingMap && (
                    <Link href="/routing" className="ml-2 text-primary hover:underline">
                      Configure →
                    </Link>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2">
                {setup.checks.webhookReceived ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>At least one webhook received from Monday</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Queued" value={stats?.queued ?? 0} icon={Clock} href="/jobs?state=queued" />
        <StatCard title="Running" value={stats?.running ?? 0} icon={Activity} href="/jobs?state=running" />
        <StatCard title="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} href="/jobs?state=completed" />
        <StatCard title="Failed" value={stats?.failed ?? 0} icon={XCircle} href="/jobs?state=failed" />
      </div>

      {batchStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By batch</CardTitle>
            <CardDescription>Completion status per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {batchStats.map((b) => (
                <div
                  key={b.batchCanonical}
                  className="rounded border px-4 py-2 text-sm"
                >
                  <span className="font-medium">{b.batchCanonical}</span>
                  <span className="text-muted-foreground ml-2">
                    {b.completed}/{b.total} complete
                    {(b.queued > 0 || b.running > 0) && `, ${b.queued + b.running} pending`}
                    {b.failed > 0 && `, ${b.failed} failed`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Last 10 synced briefings</CardDescription>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet</p>
            ) : (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{job.experimentPageName}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.batchCanonical} • {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge state={job.state} />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <Link href="/jobs" className="text-sm font-medium text-primary hover:underline">
                View all jobs →
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>API connectivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Monday API</span>
                  {health ? serviceStatus(health.monday) : <Badge variant="secondary">—</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Figma API</span>
                  {health ? serviceStatus(health.figma) : <Badge variant="secondary">—</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">KV Store</span>
                  {health ? serviceStatus(health.kv) : <Badge variant="secondary">—</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent webhooks</CardTitle>
              <CardDescription>Last 5 from Monday</CardDescription>
            </CardHeader>
            <CardContent>
              {webhookLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhooks yet</p>
              ) : (
                <div className="space-y-2">
                  {webhookLog.map((e, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded px-2 py-1 text-xs flex items-center gap-2',
                        e.outcome === 'queued' && 'bg-green-500/10',
                        e.outcome === 'filtered' && 'bg-yellow-500/10',
                        e.outcome === 'error' && 'bg-destructive/10'
                      )}
                    >
                      <Badge variant={e.outcome === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {e.outcome}
                      </Badge>
                      <span className="truncate">{e.itemName}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 pt-2 border-t">
                <Link href="/logs" className="text-sm font-medium text-primary hover:underline">
                  View logs →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
