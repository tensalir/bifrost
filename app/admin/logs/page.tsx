'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogCategory = 'webhook' | 'mapping' | 'queue' | 'figma' | 'api' | 'system'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  context?: Record<string, unknown>
  error?: { message: string; stack?: string; code?: string }
  duration?: number
}

interface WebhookLogEntry {
  timestamp: string
  mondayItemId: string
  itemName: string
  outcome: 'queued' | 'filtered' | 'error'
  reason?: string
  errorMessage?: string
}

export default function LogsPage() {
  const [tab, setTab] = useState<'logs' | 'webhooks'>('logs')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [webhookEntries, setWebhookEntries] = useState<WebhookLogEntry[]>([])
  const [level, setLevel] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (category) params.set('category', category)
    params.set('limit', '100')
    const res = await fetch(`/api/logs?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs ?? [])
    }
  }, [level, category])

  const fetchWebhooks = useCallback(async () => {
    const res = await fetch('/api/webhooks/log?limit=100')
    if (res.ok) {
      const data = await res.json()
      setWebhookEntries(data.entries ?? [])
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    if (tab === 'logs') await fetchLogs()
    else await fetchWebhooks()
    setLoading(false)
  }, [tab, fetchLogs, fetchWebhooks])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  const filteredLogs = search
    ? logs.filter(
        (e) =>
          e.message.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(e.context ?? {}).toLowerCase().includes(search.toLowerCase())
      )
    : logs

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">Structured logs and webhook activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Auto-refresh 5s</span>
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('logs')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            tab === 'logs' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          Logs
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            tab === 'webhooks' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          Webhooks
        </button>
      </div>

      {tab === 'logs' && (
        <Card>
          <CardHeader>
            <CardTitle>Structured logs</CardTitle>
            <CardDescription>Filter by level and category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="">All levels</option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="">All categories</option>
                <option value="webhook">webhook</option>
                <option value="mapping">mapping</option>
                <option value="queue">queue</option>
                <option value="figma">figma</option>
                <option value="api">api</option>
                <option value="system">system</option>
              </select>
              <input
                type="text"
                placeholder="Search message or context..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-sm min-w-[200px]"
              />
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No log entries</p>
              ) : (
                filteredLogs.map((entry) => {
                  const isExpanded = expandedId === entry.id
                  const levelColor =
                    entry.level === 'error'
                      ? 'text-destructive'
                      : entry.level === 'warn'
                        ? 'text-yellow-600'
                        : 'text-muted-foreground'
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'rounded border p-2 text-sm',
                        entry.level === 'error' && 'border-destructive/50 bg-destructive/5'
                      )}
                    >
                      <button
                        className="flex items-start gap-2 w-full text-left"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <span className="mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <Badge
                          variant={entry.level === 'error' ? 'destructive' : 'secondary'}
                          className={cn('shrink-0', levelColor)}
                        >
                          {entry.level}
                        </Badge>
                        <Badge variant="outline" className="shrink-0">
                          {entry.category}
                        </Badge>
                        <span className="flex-1 truncate">{entry.message}</span>
                        {entry.duration != null && (
                          <span className="text-muted-foreground shrink-0">{entry.duration}ms</span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 pl-6 space-y-2 border-t pt-2">
                          {entry.error && (
                            <div>
                              <p className="font-medium text-destructive">Error</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                {entry.error.message}
                                {entry.error.stack ? `\n${entry.error.stack}` : ''}
                              </pre>
                            </div>
                          )}
                          {entry.context && Object.keys(entry.context).length > 0 && (
                            <div>
                              <p className="font-medium text-muted-foreground">Context</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(entry.context, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'webhooks' && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook activity</CardTitle>
            <CardDescription>What Monday sent and how it was handled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {webhookEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No webhook entries yet</p>
              ) : (
                webhookEntries.map((e, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded border p-3 text-sm',
                      e.outcome === 'queued' && 'border-green-500/30 bg-green-500/5',
                      e.outcome === 'filtered' && 'border-yellow-500/30 bg-yellow-500/5',
                      e.outcome === 'error' && 'border-destructive/50 bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                      <Badge
                        variant={
                          e.outcome === 'error'
                            ? 'destructive'
                            : e.outcome === 'queued'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {e.outcome}
                      </Badge>
                      <span className="font-medium">{e.itemName}</span>
                      <span className="font-mono text-muted-foreground">{e.mondayItemId}</span>
                    </div>
                    {(e.reason || e.errorMessage) && (
                      <p className="mt-1 text-muted-foreground text-xs">
                        {e.reason ?? e.errorMessage}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
