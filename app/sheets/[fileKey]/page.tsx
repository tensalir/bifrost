'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle, ChevronDown, ArrowLeft } from 'lucide-react'
import { CommentSheet, type CommentSheetData } from '@/components/comments'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface SiblingFile {
  key: string
  name: string
  thumbnail_url?: string
}

/* -------------------------------------------------------------------------- */
/*  File Switcher Dropdown                                                    */
/* -------------------------------------------------------------------------- */

function FileSwitcher({
  currentFileKey,
  projectId,
  fileName,
}: {
  currentFileKey: string
  projectId: string
  fileName?: string
}) {
  const router = useRouter()
  const [files, setFiles] = useState<SiblingFile[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchSiblings = useCallback(async () => {
    try {
      const res = await fetch(`/api/figma/projects/${projectId}/files`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files ?? [])
      }
    } catch {
      // Silently fail -- the dropdown is optional
    } finally {
      setLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    fetchSiblings()
  }, [fetchSiblings])

  const currentFile = files.find((f) => f.key === currentFileKey)
  const displayName = currentFile?.name ?? fileName ?? currentFileKey

  if (!loaded || files.length <= 1) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/sheets?project=${projectId}`)}
          className="shrink-0 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-foreground truncate">{displayName}</h1>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 relative">
      <button
        onClick={() => router.push(`/sheets?project=${projectId}`)}
        className="shrink-0 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors max-w-md"
      >
        <span className="truncate">{displayName}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-8 mt-1 z-50 w-80 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {files.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setOpen(false)
                  if (f.key !== currentFileKey) {
                    router.push(`/sheets/${f.key}?project=${projectId}`)
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  f.key === currentFileKey
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                {f.thumbnail_url ? (
                  <img
                    src={f.thumbnail_url}
                    alt=""
                    className="w-10 h-7 rounded object-cover shrink-0 border border-border/50"
                  />
                ) : (
                  <div className="w-10 h-7 rounded bg-muted/30 shrink-0" />
                )}
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sheet Page Content                                                        */
/* -------------------------------------------------------------------------- */

function SheetPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const fileKey = params.fileKey as string
  const projectId = searchParams.get('project')

  const [data, setData] = useState<CommentSheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)

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
            <span className="text-2xl font-bold tracking-tight select-none text-foreground">H</span>
          </div>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading comments...</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Fetching from Figma API</p>
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

  return (
    <div className="h-full flex flex-col">
      {/* File switcher bar (only when project context is available) */}
      {projectId && (
        <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2.5">
          <FileSwitcher
            currentFileKey={fileKey}
            projectId={projectId}
            fileName={data.fileName}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CommentSheet data={data} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page wrapper                                                              */
/* -------------------------------------------------------------------------- */

export default function CommentSheetPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      }
    >
      <SheetPageContent />
    </Suspense>
  )
}
