'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { CommentSheet, type CommentSheetData } from '@/components/comments'

export default function CommentSheetPage() {
  const params = useParams()
  const fileKey = params.fileKey as string

  const [data, setData] = useState<CommentSheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/comments/sheet?fileKey=${encodeURIComponent(fileKey)}`)
        const result = await res.json()

        if (!res.ok) {
          setError(result.error || 'Failed to load comments')
          return
        }

        setData(result)
      } catch (err) {
        console.error('Failed to fetch comment sheet:', err)
        setError('Failed to load comment sheet')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fileKey])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-2xl bg-card border border-border">
            <span className="text-2xl font-bold tracking-tight select-none text-foreground">B</span>
          </div>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">
            Loading comments...
          </p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Fetching from Figma API
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-4">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-2xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold mb-2 text-foreground">Unable to Load</h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return <CommentSheet data={data} />
}
