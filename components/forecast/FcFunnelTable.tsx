'use client'

export interface FcFunnelRow {
  stage: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
}

interface FcFunnelTableProps {
  funnel: FcFunnelRow[]
  readOnly?: boolean
}

export function FcFunnelTable({ funnel, readOnly }: FcFunnelTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Funnel</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Stage</th>
            <th className="text-right p-2">%</th>
            <th className="text-right p-2">Production Target</th>
            <th className="text-right p-2">Forecasted</th>
          </tr>
        </thead>
        <tbody>
          {funnel.map((row) => (
            <tr key={row.stage} className="border-t border-border/50">
              <td className="p-2">{row.stage}</td>
              <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(2)}%</td>
              <td className="p-2 text-right">{row.productionTarget}</td>
              <td className="p-2 text-right">{row.forecasted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
