'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SummaryCellProps {
  experimentId: string
  cachedSummary: string | null
  onGenerated: () => void
  className?: string
}

export function SummaryCell({ experimentId, cachedSummary, onGenerated, className }: SummaryCellProps) {
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment_id: experimentId }),
      })
      if (res.ok) onGenerated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <td className={cn('align-top px-2 py-2 border-b border-border/50 min-w-[160px]', className)}>
      {cachedSummary ? (
        <div className="space-y-1">
          <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">{cachedSummary}</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="ml-1">Regenerate</span>
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span className="ml-1">Generate summary</span>
        </Button>
      )}
    </td>
  )
}
