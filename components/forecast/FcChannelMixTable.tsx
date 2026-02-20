'use client'

export interface FcChannelMixRow {
  channel: string
  pctAttribution: number
  productionTarget: number
}

interface FcChannelMixTableProps {
  channelMix: FcChannelMixRow[]
  readOnly?: boolean
}

export function FcChannelMixTable({ channelMix, readOnly }: FcChannelMixTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Channel Mix</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Channel</th>
            <th className="text-right p-2">%</th>
            <th className="text-right p-2">Production Target</th>
          </tr>
        </thead>
        <tbody>
          {channelMix.map((row) => (
            <tr key={row.channel} className="border-t border-border/50">
              <td className="p-2">{row.channel}</td>
              <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(2)}%</td>
              <td className="p-2 text-right">{row.productionTarget}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
