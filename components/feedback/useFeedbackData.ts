'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FeedbackExperimentRow } from '@/app/api/feedback/route'

export interface UseFeedbackDataResult {
  byAgency: Record<string, FeedbackExperimentRow[]>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const AGENCY_ORDER = ['Gain', 'Monks', 'Statiq', 'Goodo', 'Studio']

export function useFeedbackData(roundId: string | null, refreshTrigger?: number): UseFeedbackDataResult {
  const [byAgency, setByAgency] = useState<Record<string, FeedbackExperimentRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!roundId) {
      setByAgency({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/feedback?round_id=${encodeURIComponent(roundId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setByAgency(data.by_agency ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setByAgency({})
    } finally {
      setLoading(false)
    }
  }, [roundId])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshTrigger])

  return { byAgency, loading, error, refetch: fetchData }
}

export function getAgencyOrder(): string[] {
  return AGENCY_ORDER
}

export function getOrderedAgencies(byAgency: Record<string, FeedbackExperimentRow[]>): string[] {
  return AGENCY_ORDER.filter((a) => byAgency[a]?.length).concat(
    Object.keys(byAgency).filter((a) => !AGENCY_ORDER.includes(a))
  )
}
