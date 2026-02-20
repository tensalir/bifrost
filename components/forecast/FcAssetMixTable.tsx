'use client'

export interface FcAssetMixRow {
  bucket: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
  static: number
  carousel: number
  video: number
  ugc: number
  partnershipCode: number
}

interface FcAssetMixTableProps {
  assetMix: FcAssetMixRow[]
  readOnly?: boolean
}

export function FcAssetMixTable({ assetMix, readOnly }: FcAssetMixTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Asset Mix</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-2">Bucket</th>
              <th className="text-right p-2">%</th>
              <th className="text-right p-2">Prod Target</th>
              <th className="text-right p-2">Forecasted</th>
              <th className="text-right p-2">Static</th>
              <th className="text-right p-2">Carousel</th>
              <th className="text-right p-2">Video</th>
              <th className="text-right p-2">UGC</th>
              <th className="text-right p-2">Partnership</th>
            </tr>
          </thead>
          <tbody>
            {assetMix.map((row) => (
              <tr key={row.bucket} className="border-t border-border/50">
                <td className="p-2">{row.bucket}</td>
                <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(0)}%</td>
                <td className="p-2 text-right">{row.productionTarget}</td>
                <td className="p-2 text-right">{row.forecasted}</td>
                <td className="p-2 text-right">{row.static}</td>
                <td className="p-2 text-right">{row.carousel}</td>
                <td className="p-2 text-right">{row.video}</td>
                <td className="p-2 text-right">{row.ugc}</td>
                <td className="p-2 text-right">{row.partnershipCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
