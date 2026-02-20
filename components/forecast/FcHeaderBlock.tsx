'use client'

export interface FcHeaderBlockData {
  adspendTargetGlobal: number
  adspendTargetExpansion: number
  totalAdspendTarget: number
  creativeBudgetPct: number
  creativeBudgetGlobal: number
  creativeBudgetExpansion: number
  totalCreativeBudget: number
  blendedCostPerAsset: number
}

interface FcHeaderBlockProps {
  totalAdsNeeded: number
  headerBlock: FcHeaderBlockData
  onTotalAdsChange?: (value: number) => void
  onCreativeBudgetPctChange?: (value: number) => void
  readOnly?: boolean
}

export function FcHeaderBlock({
  totalAdsNeeded,
  headerBlock,
  onTotalAdsChange,
  onCreativeBudgetPctChange,
  readOnly,
}: FcHeaderBlockProps) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h3 className="font-semibold">Header</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="text-muted-foreground block mb-1">Total Ads Needed</label>
          {readOnly ? (
            <span className="font-medium">{totalAdsNeeded}</span>
          ) : (
            <input
              type="number"
              min={1}
              value={totalAdsNeeded}
              onChange={(e) => onTotalAdsChange?.(Math.max(1, parseInt(e.target.value, 10) || 0))}
              className="w-24 rounded-md border border-border bg-background px-2 py-1"
            />
          )}
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Adspend Target Global</label>
          <span className="font-medium">€{headerBlock.adspendTargetGlobal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Adspend Target Expansion</label>
          <span className="font-medium">€{headerBlock.adspendTargetExpansion.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Total Adspend Target</label>
          <span className="font-medium">€{headerBlock.totalAdspendTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Creative Budget %</label>
          {readOnly ? (
            <span className="font-medium">{(headerBlock.creativeBudgetPct * 100).toFixed(2)}%</span>
          ) : (
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={(headerBlock.creativeBudgetPct * 100).toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value) / 100
                if (!Number.isNaN(v)) onCreativeBudgetPctChange?.(v)
              }}
              className="w-20 rounded-md border border-border bg-background px-2 py-1"
            />
          )}
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Total Creative Budget</label>
          <span className="font-medium">€{headerBlock.totalCreativeBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Blended Cost / Asset</label>
          <span className="font-medium">€{headerBlock.blendedCostPerAsset.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
