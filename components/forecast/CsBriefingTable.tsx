'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

export interface CsDetailRow {
  id: string
  run_id: string
  month_key: string
  row_index: number
  siobhanRef: string
  contentBucket: string
  static: number
  video: number
  carousel: number
  ideationStarter: string
  experimentName: string
  notes: string
  typeUseCase: string
  briefOwner: string
  localisationOrGrowth?: string
  studioAgency: string
  agencyRef: string
  numAssets: number
}

interface CsBriefingTableProps {
  runId: string
  monthKey: string
  rows: CsDetailRow[]
  onRefresh: () => void
  contentBucketOptions: string[]
  studioAgencyOptions: string[]
  briefOwnerOptions: string[]
  useCaseOptions: string[]
}

export function CsBriefingTable({
  runId,
  monthKey,
  rows,
  onRefresh,
  contentBucketOptions,
  studioAgencyOptions,
  briefOwnerOptions,
  useCaseOptions,
}: CsBriefingTableProps) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const patchRow = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setSavingId(id)
      try {
        const res = await fetch(`/api/forecast/runs/${runId}/cs-detail-rows`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        })
        if (res.ok) onRefresh()
      } finally {
        setSavingId(null)
      }
    },
    [runId, onRefresh]
  )

  const addRow = useCallback(async () => {
    setAdding(true)
    try {
      const nextRef = `AP${rows.length + 1}`
      const res = await fetch(`/api/forecast/runs/${runId}/cs-detail-rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, siobhanRef: nextRef }),
      })
      if (res.ok) onRefresh()
    } finally {
      setAdding(false)
    }
  }, [runId, monthKey, rows.length, onRefresh])

  const deleteRow = useCallback(
    async (id: string) => {
      if (!confirm('Delete this briefing row?')) return
      const res = await fetch(`/api/forecast/runs/${runId}/cs-detail-rows?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) onRefresh()
    },
    [runId, onRefresh]
  )

  const sortedRows = [...rows].sort((a, b) => {
    const sa = a.studioAgency || '—'
    const sb = b.studioAgency || '—'
    if (sa !== sb) return sa.localeCompare(sb)
    return a.row_index - b.row_index
  })

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="p-2 bg-muted/50 flex items-center justify-between">
        <h3 className="font-semibold">Briefing rows</h3>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={adding}>
          <Plus className="h-4 w-4 mr-1" />
          Add row
        </Button>
      </div>
      <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 sticky top-0">
            <tr>
              <th className="text-left p-1 w-14">Ref</th>
              <th className="text-left p-1">Bucket</th>
              <th className="text-right p-1 w-14">Static</th>
              <th className="text-right p-1 w-14">Video</th>
              <th className="text-right p-1 w-14">Carousel</th>
              <th className="text-right p-1 w-14"># Assets</th>
              <th className="text-left p-1">Use Case</th>
              <th className="text-left p-1">Brief Owner</th>
              <th className="text-left p-1">Studio</th>
              <th className="text-left p-1">L/G</th>
              <th className="text-left p-1 w-8" aria-label="Delete" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => {
              const prevStudio = idx > 0 ? (sortedRows[idx - 1].studioAgency || '—') : ''
              const studio = row.studioAgency || '—'
              const showStudioSep = prevStudio !== '' && prevStudio !== studio
              const numAssets = row.static + row.video + row.carousel
              return (
                <tr
                  key={row.id}
                  className={`border-t border-border/50 ${showStudioSep ? 'border-t-2 border-primary/30' : ''}`}
                >
                  <td className="p-1">
                    <input
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs"
                      value={row.siobhanRef}
                      onChange={(e) => patchRow(row.id, { siobhanRef: e.target.value })}
                      onBlur={(e) => patchRow(row.id, { siobhanRef: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs min-w-[100px]"
                      value={row.contentBucket}
                      onChange={(e) => patchRow(row.id, { contentBucket: e.target.value })}
                    >
                      <option value="">—</option>
                      {contentBucketOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      className="w-12 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
                      value={row.static}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                        patchRow(row.id, { static: v })
                      }}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      className="w-12 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
                      value={row.video}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                        patchRow(row.id, { video: v })
                      }}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      className="w-12 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
                      value={row.carousel}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                        patchRow(row.id, { carousel: v })
                      }}
                    />
                  </td>
                  <td className="p-1 text-right text-muted-foreground">{numAssets}</td>
                  <td className="p-1">
                    <select
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs min-w-[100px]"
                      value={row.typeUseCase}
                      onChange={(e) => patchRow(row.id, { typeUseCase: e.target.value })}
                    >
                      <option value="">—</option>
                      {useCaseOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs min-w-[80px]"
                      value={row.briefOwner}
                      onChange={(e) => patchRow(row.id, { briefOwner: e.target.value })}
                    >
                      <option value="">—</option>
                      {briefOwnerOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs min-w-[100px]"
                      value={row.studioAgency}
                      onChange={(e) => patchRow(row.id, { studioAgency: e.target.value })}
                    >
                      <option value="">—</option>
                      {studioAgencyOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs"
                      value={row.localisationOrGrowth ?? ''}
                      onChange={(e) => patchRow(row.id, { localisationOrGrowth: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      disabled={savingId === row.id}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="p-4 text-center text-sm text-muted-foreground">No briefing rows. Add one to get started.</p>
      )}
    </div>
  )
}
