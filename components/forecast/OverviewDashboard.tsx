'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export interface OverviewMonthRow {
  monthKey: string
  monthLabel: string
  totalAdsNeeded: number
  totalAssets: number
}

interface OverviewDashboardProps {
  runId: string
  monthKeys: string[]
}

export function OverviewDashboard({ runId, monthKeys }: OverviewDashboardProps) {
  const [rows, setRows] = useState<OverviewMonthRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId || monthKeys.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      monthKeys.map((monthKey) =>
        fetch(`/api/forecast/runs/${runId}/compute?monthKey=${encodeURIComponent(monthKey)}`).then((res) =>
          res.json().then((data: { fc?: { totalAdsNeeded?: number }; cs?: { totalAssets?: number }; fcMonthLabel?: string }) => ({
            monthKey,
            monthLabel: data.fc?.monthLabel ?? monthKey,
            totalAdsNeeded: data.fc?.totalAdsNeeded ?? 0,
            totalAssets: data.cs?.totalAssets ?? 0,
          }))
        )
      )
    )
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [runId, monthKeys.join(',')])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading overview…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8">No months in this run. Select a run with month keys.</p>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Monthly asset count</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-2">Month</th>
              <th className="text-right p-2">Total ads needed (FC)</th>
              <th className="text-right p-2">Total assets (CS)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.monthKey} className="border-t border-border/50">
                <td className="p-2 font-medium">{row.monthLabel}</td>
                <td className="p-2 text-right">{row.totalAdsNeeded.toLocaleString()}</td>
                <td className="p-2 text-right">{row.totalAssets.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
