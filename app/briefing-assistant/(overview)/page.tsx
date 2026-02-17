'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, LayoutGrid, ArrowRight, Plus, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SprintSummary {
  id: string
  name: string
  created_at: string
  updated_at: string
  batch_count?: number
  assignment_count?: number
  batches?: Array<{ batch_key: string; batch_label: string; batch_type?: string; monday_board_id: string | null; figma_file_key: string | null }>
}

type BatchType = 'monthly' | 'campaign'

interface BatchRow {
  batch_type: BatchType
  batch_key: string
  batch_label: string
  monday_board_id: string | null
  figma_file_key: string | null
}

function BriefingOverviewContent() {
  const router = useRouter()
  const [sprints, setSprints] = useState<SprintSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBatches, setNewBatches] = useState<BatchRow[]>([])
  const [batchType, setBatchType] = useState<BatchType>('monthly')
  const [batchInput, setBatchInput] = useState('')
  const [campaignLabel, setCampaignLabel] = useState('')
  const [campaignBoardId, setCampaignBoardId] = useState('')
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchSprints = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/briefing-assistant/sprints')
      const data = await res.json()
      if (res.ok && Array.isArray(data.sprints)) {
        setSprints(data.sprints)
      } else {
        setSprints([])
      }
    } catch {
      setSprints([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSprints()
  }, [fetchSprints])

  const handleAddBatch = useCallback(async () => {
    setResolveError(null)
    if (batchType === 'monthly') {
      const raw = batchInput.trim()
      if (!raw) return
      setResolveLoading(true)
      try {
        const res = await fetch(`/api/briefing-assistant/resolve-batch?batch=${encodeURIComponent(raw)}`)
        const data = await res.json()
        if (!res.ok) {
          setResolveError(data.error ?? 'Failed to resolve batch')
          return
        }
        setNewBatches((prev) => {
          if (prev.some((b) => b.batch_key === data.batch_key)) return prev
          return [...prev, { batch_type: 'monthly' as const, batch_key: data.batch_key, batch_label: data.batch_label, monday_board_id: data.monday_board_id, figma_file_key: data.figma_file_key }]
        })
        setBatchInput('')
      } catch {
        setResolveError('Request failed')
      } finally {
        setResolveLoading(false)
      }
      return
    }
    const label = campaignLabel.trim()
    const boardId = campaignBoardId.trim().replace(/^https?:\/\/(?:[^/]+\.)?monday\.com\/boards\/(\d+).*$/i, '$1').replace(/\D/g, '')
    if (!label || !boardId) {
      setResolveError('Campaign label and Monday board ID are required')
      return
    }
    const slug = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const batchKey = slug || `campaign-${Date.now()}`
    setNewBatches((prev) => {
      if (prev.some((b) => b.batch_key === batchKey)) return prev
      return [...prev, { batch_type: 'campaign' as const, batch_key: batchKey, batch_label: label, monday_board_id: boardId, figma_file_key: null }]
    })
    setCampaignLabel('')
    setCampaignBoardId('')
  }, [batchType, batchInput, campaignLabel, campaignBoardId])

  const handleRemoveBatch = useCallback((batchKey: string) => {
    setNewBatches((prev) => prev.filter((b) => b.batch_key !== batchKey))
  }, [])

  const handleSubmitSprint = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    setSubmitLoading(true)
    try {
      const res = await fetch('/api/briefing-assistant/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          batches: newBatches.length
            ? newBatches.map((b) => ({
                batch_type: b.batch_type,
                batch_key: b.batch_key,
                batch_label: b.batch_label,
                monday_board_id: b.monday_board_id,
                figma_file_key: b.figma_file_key,
              }))
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResolveError(data.error ?? 'Failed to create sprint')
        return
      }
      setDialogOpen(false)
      setNewName('')
      setNewBatches([])
      setBatchInput('')
      setResolveError(null)
      if (data.sprint?.id) {
        router.push(`/briefing-assistant/${data.sprint.id}`)
      } else {
        fetchSprints()
      }
    } catch {
      setResolveError('Request failed')
    } finally {
      setSubmitLoading(false)
    }
  }, [newName, newBatches, router, fetchSprints])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="flex-1 min-h-0 overflow-auto flex flex-col">
      <div className="border-b border-border bg-card/40 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Briefing Assistant
        </h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">New sprint</span>
        </Button>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">New sprint</h2>
              <button
                type="button"
                onClick={() => { setDialogOpen(false); setResolveError(null); }}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sprint name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sprint 5: Jan+Feb"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Batches (optional)</label>
                <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setBatchType('monthly')}
                    className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors', batchType === 'monthly' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchType('campaign')}
                    className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors', batchType === 'campaign' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                  >
                    Campaign
                  </button>
                </div>
                {batchType === 'monthly' ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">Add batch keys like 2026-03 or &quot;March 2026&quot; to link Monday and Figma.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={batchInput}
                        onChange={(e) => { setBatchInput(e.target.value); setResolveError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBatch())}
                        placeholder="2026-03 or March 2026"
                        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={handleAddBatch} disabled={resolveLoading}>
                        {resolveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">Add a campaign batch with a label and Monday board ID (or paste board URL).</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={campaignLabel}
                        onChange={(e) => { setCampaignLabel(e.target.value); setResolveError(null); }}
                        placeholder="e.g. Coachella 2026"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={campaignBoardId}
                        onChange={(e) => { setCampaignBoardId(e.target.value); setResolveError(null); }}
                        placeholder="Monday board ID or full board URL"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={handleAddBatch}>
                        Add campaign
                      </Button>
                    </div>
                  </>
                )}
                {resolveError ? <p className="mt-1 text-xs text-destructive">{resolveError}</p> : null}
                {newBatches.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {newBatches.map((b) => (
                      <li key={b.batch_key} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                        <span>{b.batch_label} <span className="text-[10px] text-muted-foreground">({b.batch_type})</span></span>
                        <button type="button" onClick={() => handleRemoveBatch(b.batch_key)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitSprint} disabled={!newName.trim() || submitLoading}>
                {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-2">Create</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-6">
        {sprints.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4 mx-auto">
              <LayoutGrid className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No sprints yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create a sprint to run splits, link batches to Monday and Figma, and manage briefing assignments.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-2">New sprint</span>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {sprints.map((sprint) => (
              <Link
                key={sprint.id}
                href={`/briefing-assistant/${sprint.id}`}
                className={cn(
                  'group flex items-center gap-4 rounded-xl border border-border bg-card p-6',
                  'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left'
                )}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-foreground truncate" title={sprint.name}>
                    {sprint.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sprint.assignment_count ?? 0} assignment{(sprint.assignment_count ?? 0) !== 1 ? 's' : ''}
                    {sprint.batch_count != null && sprint.batch_count > 0
                      ? ` · ${sprint.batch_count} batch${sprint.batch_count !== 1 ? 'es' : ''}`
                      : ''}
                  </p>
                  {sprint.batches && sprint.batches.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sprint.batches.slice(0, 3).map((b) => (
                        <span
                          key={b.batch_key}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                        >
                          {b.batch_label}
                        </span>
                      ))}
                      {sprint.batches.length > 3 ? (
                        <span className="text-[10px] text-muted-foreground">+{sprint.batches.length - 3}</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function BriefingAssistantOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <BriefingOverviewContent />
    </Suspense>
  )
}
