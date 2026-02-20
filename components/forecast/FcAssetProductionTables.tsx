'use client'

/**
 * Placeholder for the 5 Asset Production sub-tables (Funnel Split, Per Use Case, Campaigns, Growth, Localisation).
 * Full editable grid can be added later; for now we show a short note.
 */
export function FcAssetProductionTables() {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="font-semibold mb-2">Asset Production</h3>
      <p className="text-sm text-muted-foreground">
        Funnel Split, Per Use Case, Campaigns, Growth, and Localisation tables are derived from Use Case Results and asset mix. Edit overrides above to adjust; production tables will reflect in a future update.
      </p>
    </div>
  )
}
