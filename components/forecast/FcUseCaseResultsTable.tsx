'use client'

export interface FcUseCaseResultRow {
  useCase: string
  spend: number
  revenue: number
  roas: number
  manualBoost: number
  pctTotalSpend: number
  adsProduction: number
  expProduction: number
  type: 'BAU' | 'EXP' | 'CAM'
}

interface FcUseCaseResultsTableProps {
  rows: FcUseCaseResultRow[]
  onBoostChange?: (useCase: string, value: number) => void
  readOnly?: boolean
}

export function FcUseCaseResultsTable({ rows, onBoostChange, readOnly }: FcUseCaseResultsTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Use Case Results</h3>
      <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 sticky top-0">
            <tr>
              <th className="text-left p-2">Use Case</th>
              <th className="text-right p-2">Spend</th>
              <th className="text-right p-2">Revenue</th>
              <th className="text-right p-2">ROAS</th>
              <th className="text-right p-2">Manual Boost</th>
              <th className="text-right p-2">% Spend</th>
              <th className="text-right p-2">Ads Prod</th>
              <th className="text-right p-2">EXP Prod</th>
              <th className="text-left p-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.useCase} className="border-t border-border/50">
                <td className="p-2 font-medium">{row.useCase}</td>
                <td className="p-2 text-right">€{row.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="p-2 text-right">€{row.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="p-2 text-right">{row.roas ? row.roas.toFixed(2) : '—'}</td>
                <td className="p-2 text-right">
                  {readOnly ? (
                    row.manualBoost
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={row.manualBoost}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isNaN(v)) onBoostChange?.(row.useCase, v)
                      }}
                      className="w-14 rounded border border-border bg-background px-1 py-0.5 text-right"
                    />
                  )}
                </td>
                <td className="p-2 text-right">{(row.pctTotalSpend * 100).toFixed(2)}%</td>
                <td className="p-2 text-right">{row.adsProduction}</td>
                <td className="p-2 text-right">{row.expProduction}</td>
                <td className="p-2">
                  <span className={row.type === 'CAM' ? 'text-amber-600' : row.type === 'EXP' ? 'text-blue-600' : 'text-muted-foreground'}>
                    {row.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
