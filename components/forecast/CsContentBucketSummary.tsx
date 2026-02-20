'use client'

import { cn } from '@/lib/utils'

export interface CsContentBucketSummaryRow {
  bucket: string
  productionTargetUgcExcluded: number
  forecastedUgcExcluded: number
  csSheet: number
}

interface CsContentBucketSummaryProps {
  rows: CsContentBucketSummaryRow[]
}

function diffLabel(target: number, actual: number): string {
  const d = actual - target
  if (d === 0) return '—'
  if (d > 0) return `+${d}`
  return String(d)
}

export function CsContentBucketSummary({ rows }: CsContentBucketSummaryProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Content Bucket</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Bucket</th>
            <th className="text-right p-2">Production (UGC excl.)</th>
            <th className="text-right p-2">Forecasted</th>
            <th className="text-right p-2">CS Sheet</th>
            <th className="text-right p-2">Diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const diff = row.csSheet - row.productionTargetUgcExcluded
            return (
              <tr key={row.bucket} className="border-t border-border/50">
                <td className="p-2">{row.bucket}</td>
                <td className="p-2 text-right">{row.productionTargetUgcExcluded}</td>
                <td className="p-2 text-right">{row.forecastedUgcExcluded}</td>
                <td className="p-2 text-right">{row.csSheet}</td>
                <td className={cn('p-2 text-right', diff > 0 ? 'text-green-600' : diff < 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                  {diffLabel(row.productionTargetUgcExcluded, row.csSheet)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
