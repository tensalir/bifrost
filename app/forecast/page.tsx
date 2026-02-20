'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Upload, Loader2, Database, BarChart3, Users, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { csOutputToMinimalAssignments } from '@/src/domain/forecast/csToBriefingAssignments'

interface ForecastRun {
  id: string
  name: string | null
  uploaded_at: string
  workbook_filename: string | null
  sheet_names: string[]
  month_keys: string[]
  created_at: string
}

interface UseCaseRow {
  id: string
  run_id: string
  row_index: number
  year_num: number | null
  month_date: string | null
  use_case: string
  graph_spent: number | null
  graph_revenue: number | null
  roas: number | null
  results_spent: number | null
  spent_pct_total: number | null
  forecasted_spent: number | null
  forecasted_revenue: number | null
}

interface FcOutput {
  monthKey: string
  monthLabel: string
  totalAdsNeeded: number
  assetMix: Array<{
    bucket: string
    pctAttribution: number
    productionTarget: number
    forecasted: number
  }>
  funnel: Array<{ stage: string; pctAttribution: number; productionTarget: number; forecasted: number }>
  assetType: Array<{ assetType: string; pctAttribution: number; productionTarget: number; forecasted: number }>
  totalProductionTarget: number
  totalForecasted: number
}

interface CsOutput {
  monthKey: string
  monthLabel: string
  totalAssets: number
  contentBucketSummary: Array<{
    bucket: string
    productionTargetUgcExcluded: number
    forecastedUgcExcluded: number
    csSheet: number
  }>
  studioAgencyTable: Array<{ studioAgency: string; numAssets: number }>
}

export default function ForecastPage() {
  const [runs, setRuns] = useState<ForecastRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)
  const [useCaseRows, setUseCaseRows] = useState<UseCaseRow[]>([])
  const [fc, setFc] = useState<FcOutput | null>(null)
  const [cs, setCs] = useState<CsOutput | null>(null)
  const [loadingCompute, setLoadingCompute] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parityStatus, setParityStatus] = useState<string | null>(null)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [sprints, setSprints] = useState<Array<{ id: string; name: string; batches?: Array<{ batch_key: string; batch_label: string }> }>>([])
  const [pushSprintId, setPushSprintId] = useState<string | null>(null)
  const [pushBatchKey, setPushBatchKey] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [parityFile, setParityFile] = useState<File | null>(null)
  const [parityChecking, setParityChecking] = useState(false)
  const [parityReport, setParityReport] = useState<{
    matches: number
    mismatches: Array<{ sheet: string; cell: string; description: string; expected: unknown; actual: unknown; delta?: number }>
    total: number
    summary: string
  } | null>(null)

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true)
    try {
      const res = await fetch('/api/forecast/runs')
      const data = await res.json()
      if (res.ok && Array.isArray(data.runs)) {
        setRuns(data.runs)
        if (!selectedRunId && data.runs.length > 0) {
          setSelectedRunId(data.runs[0].id)
          const keys = data.runs[0].month_keys as string[]
          if (keys?.length && !selectedMonthKey) setSelectedMonthKey(keys[0])
        }
      }
    } catch {
      setRuns([])
    } finally {
      setLoadingRuns(false)
    }
  }, [selectedRunId, selectedMonthKey])

  useEffect(() => {
    fetchRuns()
  }, [])

  useEffect(() => {
    if (!selectedRunId) {
      setUseCaseRows([])
      setFc(null)
      setCs(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/forecast/runs/${selectedRunId}`)
      const data = await res.json()
      if (cancelled || !res.ok) return
      setUseCaseRows(data.useCaseRows ?? [])
    })()
    return () => { cancelled = true }
  }, [selectedRunId])

  useEffect(() => {
    if (!selectedRunId || !selectedMonthKey) {
      setFc(null)
      setCs(null)
      return
    }
    setLoadingCompute(true)
    let cancelled = false
    fetch(`/api/forecast/runs/${selectedRunId}/compute?monthKey=${encodeURIComponent(selectedMonthKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setFc(data.fc ?? null)
        setCs(data.cs ?? null)
        setParityStatus(data.fc ? 'Computed (parity check: run validator for full report)' : null)
      })
      .catch(() => { if (!cancelled) setFc(null); setCs(null) })
      .finally(() => { if (!cancelled) setLoadingCompute(false) })
    return () => { cancelled = true }
  }, [selectedRunId, selectedMonthKey])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.set('file', file)
    try {
      const res = await fetch('/api/forecast/import', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.runId) {
        setSelectedRunId(data.runId)
        if (data.monthKeys?.length) setSelectedMonthKey(data.monthKeys[0])
        fetchRuns()
      } else {
        setUploadError(data.error ?? 'Import failed')
      }
    } catch {
      setUploadError('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [fetchRuns])

  const currentRun = runs.find((r) => r.id === selectedRunId)
  const monthKeys = currentRun?.month_keys ?? []

  const pushAssignments = useCallback(() => {
    if (!cs || !selectedMonthKey || !pushSprintId || !pushBatchKey) return
    const batchLabel = cs.monthLabel
    const assignments = csOutputToMinimalAssignments(cs, batchLabel).map((a) => ({
      ...a,
      batchKey: pushBatchKey,
    }))
    if (assignments.length === 0) {
      setPushError('No assignments to push')
      return
    }
    setPushing(true)
    setPushError(null)
    fetch(`/api/briefing-assistant/sprints/${pushSprintId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_key: pushBatchKey,
        batch_label: batchLabel,
        assignments: assignments.map((a) => ({
          id: a.id,
          contentBucket: a.contentBucket,
          ideationStarter: a.ideationStarter,
          productOrUseCase: a.productOrUseCase,
          briefOwner: a.briefOwner,
          agencyRef: a.agencyRef,
          assetCount: a.assetCount,
          format: a.format,
          funnel: a.funnel,
          batchKey: a.batchKey,
          briefName: a.briefName,
          source: a.source ?? 'imported',
        })),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setPushError(data.error)
        else {
          setPushModalOpen(false)
          setPushSprintId(null)
          setPushBatchKey(null)
        }
      })
      .catch(() => setPushError('Request failed'))
      .finally(() => setPushing(false))
  }, [cs, selectedMonthKey, pushSprintId, pushBatchKey])

  const runParityCheck = useCallback(async () => {
    if (!parityFile || !selectedMonthKey) return
    setParityChecking(true)
    setParityReport(null)
    const form = new FormData()
    form.set('file', parityFile)
    form.set('monthKey', selectedMonthKey)
    try {
      const res = await fetch('/api/forecast/parity-check', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setParityReport({
          matches: data.matches?.length ?? 0,
          mismatches: data.mismatches ?? [],
          total: data.total ?? 0,
          summary: data.summary ?? '',
        })
      }
    } finally {
      setParityChecking(false)
    }
  }, [parityFile, selectedMonthKey])

  useEffect(() => {
    if (!pushModalOpen) return
    fetch('/api/briefing-assistant/sprints')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.sprints)) {
          setSprints(data.sprints)
          const first = data.sprints[0]
          if (first) {
            setPushSprintId((prev) => prev ?? first.id)
            const batches = first.batches ?? []
            if (batches.length) setPushBatchKey((prev) => prev ?? batches[0].batch_key)
          }
        }
      })
  }, [pushModalOpen])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7" />
          Forecast
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload Use Case Data from Excel, then view FC and CS outputs with parity indicators.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button type="button" variant="outline" asChild>
            <span>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload workbook
            </span>
          </Button>
        </label>
        {uploadError && (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}
        {loadingRuns ? (
          <span className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs…</span>
        ) : (
          <>
            <label className="text-sm text-muted-foreground">Run:</label>
            <select
              value={selectedRunId ?? ''}
              onChange={(e) => { setSelectedRunId(e.target.value || null); const r = runs.find(x => x.id === e.target.value); if (r?.month_keys?.length) setSelectedMonthKey(r.month_keys[0]); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-[200px]"
            >
              <option value="">Select a run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>{r.name ?? r.workbook_filename ?? r.id.slice(0, 8)}</option>
              ))}
            </select>
            {monthKeys.length > 0 && (
              <>
                <label className="text-sm text-muted-foreground">Month:</label>
                <select
                  value={selectedMonthKey ?? ''}
                  onChange={(e) => setSelectedMonthKey(e.target.value || null)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-[120px]"
                >
                  {monthKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </>
            )}
          </>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
        <p className="text-sm text-muted-foreground">{parityStatus ?? 'Upload the same workbook and run parity check to compare engine vs Excel.'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer text-sm">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setParityFile(e.target.files?.[0] ?? null)}
            />
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/50">
              {parityFile ? parityFile.name : 'Select workbook'}
            </span>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={runParityCheck}
            disabled={!parityFile || !selectedMonthKey || parityChecking}
          >
            {parityChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-1">Run parity check</span>
          </Button>
        </div>
        {parityReport && (
          <div className="text-sm pt-2 border-t border-border/50">
            <p className="font-medium">{parityReport.summary}</p>
            {parityReport.mismatches.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {parityReport.mismatches.slice(0, 10).map((m, i) => (
                  <li key={i}>{m.sheet} {m.cell}: expected {String(m.expected)}, actual {String(m.actual)}{m.delta != null ? ` (Δ ${m.delta})` : ''}</li>
                ))}
                {parityReport.mismatches.length > 10 && <li>… and {parityReport.mismatches.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="useCase" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger value="useCase" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <Database className="h-4 w-4 mr-2" />
            Use Case Data
          </TabsTrigger>
          <TabsTrigger value="fc" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <BarChart3 className="h-4 w-4 mr-2" />
            FC
          </TabsTrigger>
          <TabsTrigger value="cs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
            <Users className="h-4 w-4 mr-2" />
            CS
          </TabsTrigger>
        </TabsList>
        <TabsContent value="useCase" className="mt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">Year</th>
                    <th className="text-left p-2 font-medium">Month</th>
                    <th className="text-left p-2 font-medium">Use Case</th>
                    <th className="text-right p-2 font-medium">Spent</th>
                    <th className="text-right p-2 font-medium">Revenue</th>
                    <th className="text-right p-2 font-medium">ROAS</th>
                    <th className="text-right p-2 font-medium">Spent %</th>
                    <th className="text-right p-2 font-medium">Forecasted Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {useCaseRows.map((r) => (
                    <tr key={r.id} className="border-t border-border/50">
                      <td className="p-2">{r.row_index + 1}</td>
                      <td className="p-2">{r.year_num ?? '—'}</td>
                      <td className="p-2">{r.month_date ?? '—'}</td>
                      <td className="p-2 font-medium">{r.use_case}</td>
                      <td className="p-2 text-right">{r.results_spent != null ? r.results_spent.toLocaleString() : '—'}</td>
                      <td className="p-2 text-right">{r.graph_revenue != null ? r.graph_revenue.toLocaleString() : '—'}</td>
                      <td className="p-2 text-right">{r.roas != null ? r.roas.toFixed(2) : '—'}</td>
                      <td className="p-2 text-right">{r.spent_pct_total != null ? (r.spent_pct_total * 100).toFixed(1) + '%' : '—'}</td>
                      <td className="p-2 text-right">{r.forecasted_spent != null ? r.forecasted_spent.toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {useCaseRows.length === 0 && !loadingRuns && (
              <p className="p-8 text-center text-muted-foreground">No use case data. Upload a workbook with a &quot;Use Case Data&quot; sheet.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="fc" className="mt-4">
          {loadingCompute && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Computing FC…</p>
          )}
          {fc && !loadingCompute && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm">Month: {fc.monthLabel} · Total ads needed: <strong>{fc.totalAdsNeeded}</strong> · Production target: {fc.totalProductionTarget} · Forecasted: {fc.totalForecasted}</p>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <h3 className="p-2 font-semibold bg-muted/50">Asset Mix</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2">Bucket</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-right p-2">Production Target</th>
                      <th className="text-right p-2">Forecasted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fc.assetMix.map((row) => (
                      <tr key={row.bucket} className="border-t border-border/50">
                        <td className="p-2">{row.bucket}</td>
                        <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(0)}%</td>
                        <td className="p-2 text-right">{row.productionTarget}</td>
                        <td className="p-2 text-right">{row.forecasted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <h3 className="p-2 font-semibold bg-muted/50">Funnel</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2">Stage</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-right p-2">Production Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fc.funnel.map((row) => (
                      <tr key={row.stage} className="border-t border-border/50">
                        <td className="p-2">{row.stage}</td>
                        <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(0)}%</td>
                        <td className="p-2 text-right">{row.productionTarget}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <h3 className="p-2 font-semibold bg-muted/50">Asset Type</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-right p-2">Production Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fc.assetType.map((row) => (
                      <tr key={row.assetType} className="border-t border-border/50">
                        <td className="p-2">{row.assetType}</td>
                        <td className="p-2 text-right">{(row.pctAttribution * 100).toFixed(0)}%</td>
                        <td className="p-2 text-right">{row.productionTarget}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!fc && !loadingCompute && selectedRunId && selectedMonthKey && (
            <p className="text-sm text-muted-foreground">No FC data. Select a run and month.</p>
          )}
        </TabsContent>
        <TabsContent value="cs" className="mt-4">
          {loadingCompute && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Computing CS…</p>
          )}
          {cs && !loadingCompute && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-lg border border-border p-4 flex-1">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <p className="text-sm">Month: {cs.monthLabel} · Total assets (from detail rows): <strong>{cs.totalAssets}</strong></p>
                </div>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setPushModalOpen(true)}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Push to Briefings
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <h3 className="p-2 font-semibold bg-muted/50">Content Bucket</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2">Bucket</th>
                      <th className="text-right p-2">Production (UGC excl.)</th>
                      <th className="text-right p-2">Forecasted</th>
                      <th className="text-right p-2">CS Sheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.contentBucketSummary.map((row) => (
                      <tr key={row.bucket} className="border-t border-border/50">
                        <td className="p-2">{row.bucket}</td>
                        <td className="p-2 text-right">{row.productionTargetUgcExcluded}</td>
                        <td className="p-2 text-right">{row.forecastedUgcExcluded}</td>
                        <td className="p-2 text-right">{row.csSheet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <h3 className="p-2 font-semibold bg-muted/50">Studio / Agency</h3>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-2">Studio / Agency</th>
                      <th className="text-right p-2"># Assets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.studioAgencyTable.map((row) => (
                      <tr key={row.studioAgency} className="border-t border-border/50">
                        <td className="p-2">{row.studioAgency}</td>
                        <td className="p-2 text-right">{row.numAssets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!cs && !loadingCompute && selectedRunId && selectedMonthKey && (
            <p className="text-sm text-muted-foreground">No CS data. Select a run and month.</p>
          )}
        </TabsContent>
      </Tabs>

      {pushModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-lg font-semibold">Push to Briefings</h2>
              <button type="button" onClick={() => { setPushModalOpen(false); setPushError(null); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted/50" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-sm text-muted-foreground">Create briefing assignments from the current CS output and add them to a sprint batch.</p>
              <div>
                <label className="text-sm font-medium block mb-1">Sprint</label>
                <select
                  value={pushSprintId ?? ''}
                  onChange={(e) => {
                    setPushSprintId(e.target.value || null)
                    const s = sprints.find((x) => x.id === e.target.value)
                    if (s?.batches?.length) setPushBatchKey(s.batches[0].batch_key)
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select sprint</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Batch</label>
                <select
                  value={pushBatchKey ?? ''}
                  onChange={(e) => setPushBatchKey(e.target.value || null)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select batch</option>
                  {sprints.find((s) => s.id === pushSprintId)?.batches?.map((b) => (
                    <option key={b.batch_key} value={b.batch_key}>{b.batch_label}</option>
                  )) ?? []}
                </select>
              </div>
              {cs && pushBatchKey && (
                <p className="text-xs text-muted-foreground">
                  Preview: {csOutputToMinimalAssignments(cs, cs.monthLabel).length} assignment(s) will be created for this batch (existing assignments for the batch will be replaced).
                </p>
              )}
              {pushError && <p className="text-sm text-destructive">{pushError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <Button variant="outline" onClick={() => { setPushModalOpen(false); setPushError(null); }}>Cancel</Button>
              <Button onClick={pushAssignments} disabled={!pushSprintId || !pushBatchKey || pushing}>
                {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">Push</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
