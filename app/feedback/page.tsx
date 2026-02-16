'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, ClipboardList } from 'lucide-react'
import { FeedbackBoard } from '@/components/feedback/FeedbackBoard'

interface Round {
  id: string
  name: string
  monday_board_id: string
  created_at: string
}

export default function FeedbackPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [loadingRounds, setLoadingRounds] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchRounds = useCallback(async () => {
    setLoadingRounds(true)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      if (res.ok && Array.isArray(data.rounds)) {
        setRounds(data.rounds)
        if (data.rounds.length && !selectedRoundId) {
          setSelectedRoundId(data.rounds[0].id)
        }
      }
    } catch {
      setRounds([])
    } finally {
      setLoadingRounds(false)
    }
  }, [selectedRoundId])

  useEffect(() => {
    fetchRounds()
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/feedback/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.roundId) {
        setSelectedRoundId(data.roundId)
        await fetchRounds()
      }
    } finally {
      setSyncing(false)
    }
  }, [fetchRounds])

  const selectedRound = rounds.find((r) => r.id === selectedRoundId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Stakeholder Feedback
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidate Strategy, Design, and Copy feedback per experiment and send to Monday.
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="shrink-0">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Sync from Monday</span>
        </Button>
      </div>

      {loadingRounds ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rounds.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="round-select" className="text-sm font-medium text-muted-foreground">
              Round:
            </label>
            <select
              id="round-select"
              value={selectedRoundId ?? ''}
              onChange={(e) => setSelectedRoundId(e.target.value || null)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <FeedbackBoard
            roundId={selectedRoundId}
            roundName={selectedRound?.name}
            onSync={handleSync}
            syncing={syncing}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No feedback rounds yet. Sync from Monday to create one and load experiments.
          </p>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Sync from Monday</span>
          </Button>
        </div>
      )}
    </div>
  )
}
