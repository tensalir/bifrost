'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, ArrowRight } from 'lucide-react'

export default function SheetsIndexPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const input = url.trim()
    let fileKey = input

    const figmaMatch = input.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
    if (figmaMatch) {
      fileKey = figmaMatch[1]
    }

    if (!fileKey || fileKey.length < 10) {
      setError('Please enter a valid Figma file URL or file key')
      return
    }

    router.push(`/sheets/${fileKey}`)
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Comment Sheet
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            View and consolidate Figma file comments in a structured sheet.
            Paste a Figma file URL or file key below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://figma.com/design/PLM843cfIiwGNicVpk4Bh4/..."
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Load Comments
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
          Requires FIGMA_ACCESS_TOKEN with file_comments:read scope
        </p>
      </div>
    </div>
  )
}
