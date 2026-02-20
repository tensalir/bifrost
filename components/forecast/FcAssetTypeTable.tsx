'use client'

export interface FcAssetTypeRow {
  assetType: string
  pctAttribution: number
  productionTarget: number
  forecasted: number
  csSheet: number
}

interface FcAssetTypeTableProps {
  assetType: FcAssetTypeRow[]
  readOnly?: boolean
}

export function FcAssetTypeTable({ assetType, readOnly }: FcAssetTypeTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <h3 className="p-2 font-semibold bg-muted/50">Asset Type</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left p-2">Type</th>
            <th className="text-right p-2">%</th>
            <th className="text-right p-2">Production Target</th>
            <th className="text-right p-2">Forecasted</th>
            <th className="text-right p-2">CS Sheet</th>
          </tr>
        </thead>
        <tbody>
          {assetType.map((row) => (
            <tr key={row.assetType} className="border-t border-border/50">
              <td className="p-2">{row.assetType}</td>
              <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(0)}%</td>
              <td className="p-2 text-right">{row.productionTarget}</td>
              <td className="p-2 text-right">{row.forecasted}</td>
              <td className="p-2 text-right">{row.csSheet}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
