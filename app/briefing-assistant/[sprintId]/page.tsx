'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BriefingAssistantSheet } from '@/components/sheets/BriefingAssistantSheet'
import { Loader2 } from 'lucide-react'
import type { SprintBatch } from '@/components/sheets/BriefingAssistantSheet'

interface SprintData {
  id: string
  name: string
  created_at: string
  updated_at: string
  batches: Array<{
    batch_key: string
    batch_label: string
    batch_type?: string
    monday_board_id: string | null
    figma_file_key: string | null
  }>
  assignments?: Array<{
    id: string
    batchKey: string
    briefName: string
    productOrUseCase: string
    agencyRef: string
    assetCount: number
    format: string
    funnel: string
    contentBucket: string
    mondayItemId?: string
    figmaPageUrl?: string
    status: string
    source?: string
    targetBoardId?: string | null
  }>
}

export default function BriefingSprintPage() {
  const params = useParams()
  const sprintId = params.sprintId as string
  const [sprintData, setSprintData] = useState<SprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSprint = useCallback(async () => {
    if (!sprintId || sprintId === 'new') return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/briefing-assistant/sprints/${sprintId}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load sprint')
        setSprintData(null)
        return
      }
      setSprintData(data.sprint ?? null)
    } catch {
      setError('Request failed')
      setSprintData(null)
    } finally {
      setLoading(false)
    }
  }, [sprintId])

  useEffect(() => {
    fetchSprint()
  }, [fetchSprint])

  if (!sprintId || sprintId === 'new') {
    return null
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !sprintData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-destructive">{error ?? 'Sprint not found'}</p>
      </div>
    )
  }

  const sheetBatches: SprintBatch[] = (sprintData.batches ?? []).map((b) => ({
    batch_key: b.batch_key,
    batch_label: b.batch_label,
    batch_type: b.batch_type,
    monday_board_id: b.monday_board_id ?? null,
    figma_file_key: b.figma_file_key ?? null,
  }))

  return (
    <BriefingAssistantSheet
      sprintId={sprintId}
      sprintData={{
        name: sprintData.name,
        batches: sheetBatches,
      }}
      initialAssignments={sprintData.assignments}
      onSprintUpdated={fetchSprint}
    />
  )
}
