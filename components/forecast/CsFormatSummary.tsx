'use client'

export interface CsFormatSummaryData {
  static: number
  carousel: number
  video: number
  total: number
  fcForecasted?: number
}

interface CsFormatSummaryProps {
  formatSummary: CsFormatSummaryData
}

export function CsFormatSummary({ formatSummary }: CsFormatSummaryProps) {
  const { static: s, carousel: c, video: v, total, fcForecasted } = formatSummary
  const diff = fcForecasted != null ? total - fcForecasted : null
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Format</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Format</th>
            <th className="text-right p-2">CS total</th>
            {fcForecasted != null && <th className="text-right p-2">FC forecasted</th>}
            {diff !== null && <th className="text-right p-2">Diff</th>}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/50">
            <td className="p-2">Static</td>
            <td className="p-2 text-right">{s}</td>
            {fcForecasted != null && <td className="p-2 text-right">—</td>}
            {diff !== null && <td className="p-2 text-right">—</td>}
          </tr>
          <tr className="border-t border-border/50">
            <td className="p-2">Carousel</td>
            <td className="p-2 text-right">{c}</td>
            {fcForecasted != null && <td className="p-2 text-right">—</td>}
            {diff !== null && <td className="p-2 text-right">—</td>}
          </tr>
          <tr className="border-t border-border/50">
            <td className="p-2">Video</td>
            <td className="p-2 text-right">{v}</td>
            {fcForecasted != null && <td className="p-2 text-right">—</td>}
            {diff !== null && <td className="p-2 text-right">—</td>}
          </tr>
          <tr className="border-t border-border/50 font-medium">
            <td className="p-2">Total</td>
            <td className="p-2 text-right">{total}</td>
            {fcForecasted != null && <td className="p-2 text-right">{fcForecasted}</td>}
            {diff !== null && (
              <td className={`p-2 text-right ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-amber-600' : ''}`}>
                {diff > 0 ? `+${diff}` : diff}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
