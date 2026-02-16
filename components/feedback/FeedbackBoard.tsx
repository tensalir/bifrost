'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Loader2, ClipboardList } from 'lucide-react'
import { ExperimentRow } from './ExperimentRow'
import type { FeedbackExperimentRow } from '@/app/api/feedback/route'

const AGENCY_ORDER = ['Gain', 'Monks', 'Statiq', 'Goodo', 'Studio']

interface FeedbackBoardProps {
  roundId: string | null
  roundName?: string
  onSync: () => Promise<void>
  syncing?: boolean
}

export function FeedbackBoard({ roundId, roundName, onSync, syncing }: FeedbackBoardProps) {
  const [byAgency, setByAgency] = useState<Record<string, FeedbackExperimentRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!roundId) {
      setByAgency({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/feedback?round_id=${encodeURIComponent(roundId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setByAgency(data.by_agency ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setByAgency({})
    } finally {
      setLoading(false)
    }
  }, [roundId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!roundId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-card border border-border mb-4">
          <ClipboardList className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">No round selected</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Sync from Monday to create a round and load experiments, or select an existing round.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const agencies = AGENCY_ORDER.filter((a) => byAgency[a]?.length).concat(
    Object.keys(byAgency).filter((a) => !AGENCY_ORDER.includes(a))
  )

  return (
    <div className="space-y-4">
      {agencies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No experiments in this round.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Sync from Monday to pull items.</p>
            <Button variant="outline" className="mt-4" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Sync from Monday</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        agencies.map((agency) => (
          <Card key={agency}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{agency}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {(byAgency[agency] ?? []).length} experiments
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Experiment</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Brief link</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-16">Urgent</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[140px]">Strategy</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[140px]">Design</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[140px]">Copy</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[160px]">Summary</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(byAgency[agency] ?? []).map((exp) => (
                      <ExperimentRow
                        key={exp.id}
                        experiment={exp}
                        onEntrySaved={fetchData}
                        onSummaryGenerated={fetchData}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
