'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FolderOpen,
  FileText,
  Pin,
  PinOff,
} from 'lucide-react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface FigmaFile {
  key: string
  name: string
  thumbnail_url?: string
  last_modified?: string
}

interface FigmaProjectWithFiles {
  id: string
  name: string
  files: FigmaFile[]
}

interface TeamData {
  id: string
  name: string
  projects: FigmaProjectWithFiles[]
}

/* -------------------------------------------------------------------------- */
/*  File Card                                                                 */
/* -------------------------------------------------------------------------- */

function FileCard({
  file,
  projectId,
  onClick,
}: {
  file: FigmaFile
  projectId: string
  onClick: () => void
}) {
  const modified = file.last_modified
    ? new Date(file.last_modified).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
    >
      <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
        {modified && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Edited {modified}</p>
        )}
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Project Card (shows thumbnail mosaic)                                     */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  onClick,
  isPinned,
  onTogglePin,
}: {
  project: FigmaProjectWithFiles
  onClick: () => void
  isPinned: boolean
  onTogglePin: (e: React.MouseEvent) => void
}) {
  const previewFiles = project.files.slice(0, 4)
  const fileCount = project.files.length

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
      <button onClick={onClick} className="w-full text-left">
        <div className="aspect-[3/2] bg-muted/20 relative overflow-hidden">
          {previewFiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-px h-full bg-border/30">
              {previewFiles.map((f) => (
                <div key={f.key} className="bg-muted/30 overflow-hidden">
                  {f.thumbnail_url ? (
                    <img
                      src={f.thumbnail_url}
                      alt={f.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
              ))}
              {previewFiles.length < 4 &&
                Array.from({ length: 4 - previewFiles.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-muted/10" />
                ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
            </div>
          )}
        </div>
        <div className="p-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
          <span className="shrink-0 ml-2 text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        </div>
      </button>
      {/* Pin toggle */}
      <button
        onClick={onTogglePin}
        className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
          isPinned
            ? 'bg-primary/20 text-primary opacity-100'
            : 'bg-background/60 backdrop-blur-sm text-muted-foreground opacity-0 group-hover:opacity-100'
        } hover:bg-primary/30 hover:text-primary`}
        title={isPinned ? 'Unpin project' : 'Pin project'}
      >
        {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main content (uses searchParams)                                          */
/* -------------------------------------------------------------------------- */

function SheetsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedProjectId = searchParams.get('project')

  const [teams, setTeams] = useState<TeamData[]>([])
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fallback URL input
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState('')

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamsRes, pinsRes] = await Promise.all([
        fetch('/api/figma/teams'),
        fetch('/api/pinned-projects'),
      ])
      if (teamsRes.ok) {
        const data = await teamsRes.json()
        setTeams(data.teams ?? [])
      } else {
        const data = await teamsRes.json()
        setError(data.error || 'Failed to load projects')
      }
      if (pinsRes.ok) {
        const data = await pinsRes.json()
        setPinnedIds(new Set(data.pinnedProjectIds ?? []))
      }
    } catch {
      setError('Failed to connect to Figma')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const PERFORMANCE_ADS_PROJECT_ID = '387033831'
  const allProjects = teams.flatMap((t) => t.projects)
  const pinnedProjects = allProjects.filter((p) => pinnedIds.has(p.id))
  const unpinnedProjects = allProjects
    .filter((p) => !pinnedIds.has(p.id))
    .sort((a, b) => {
      if (a.id === PERFORMANCE_ADS_PROJECT_ID) return -1
      if (b.id === PERFORMANCE_ADS_PROJECT_ID) return 1
      return 0
    })

  const selectedProject = selectedProjectId
    ? allProjects.find((p) => p.id === selectedProjectId)
    : null

  const togglePin = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isPinned = pinnedIds.has(projectId)

    // Optimistic update
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (isPinned) next.delete(projectId)
      else next.add(projectId)
      return next
    })

    try {
      await fetch('/api/pinned-projects', {
        method: isPinned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
    } catch {
      // Revert on failure
      setPinnedIds((prev) => {
        const next = new Set(prev)
        if (isPinned) next.add(projectId)
        else next.delete(projectId)
        return next
      })
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setUrlError('')
    const input = urlInput.trim()
    let fileKey = input
    const figmaMatch = input.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
    if (figmaMatch) fileKey = figmaMatch[1]
    if (!fileKey || fileKey.length < 10) {
      setUrlError('Please enter a valid Figma file URL or file key')
      return
    }
    router.push(`/sheets/${fileKey}`)
  }

  /* Loading state */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading Figma projects...</p>
        </div>
      </div>
    )
  }

  /* Error state */
  if (error && allProjects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-md mx-4 text-center">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Figma Comments</h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {error}. You can still paste a Figma URL directly.
          </p>
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://figma.com/design/PLM843cfIiwGNicVpk4Bh4/..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Load Comments <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    )
  }

  /* File grid for a selected project */
  if (selectedProject) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push('/sheets')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            All projects
          </button>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {selectedProject.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedProject.files.length} design {selectedProject.files.length === 1 ? 'file' : 'files'}
            </p>
          </div>
          {selectedProject.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files found in this project.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {selectedProject.files.map((file) => (
                <FileCard
                  key={file.key}
                  file={file}
                  projectId={selectedProject.id}
                  onClick={() => router.push(`/sheets/${file.key}?project=${selectedProject.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* Project grid (default view) */
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Figma Comments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a project to view and consolidate Figma comments.
          </p>
        </div>

        {/* Pinned projects */}
        {pinnedProjects.length > 0 && (
          <div className="mb-10">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
              <Pin className="h-3 w-3" />
              Pinned
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {pinnedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isPinned={true}
                  onTogglePin={(e) => togglePin(project.id, e)}
                  onClick={() => router.push(`/sheets?project=${project.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All projects */}
        {unpinnedProjects.length > 0 && (
          <div className="mb-12">
            {pinnedProjects.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                All projects
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {unpinnedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isPinned={false}
                  onTogglePin={(e) => togglePin(project.id, e)}
                  onClick={() => router.push(`/sheets?project=${project.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Fallback: paste URL */}
        <div className="max-w-md mx-auto">
          <div className="border-t border-border pt-8">
            <p className="text-xs text-muted-foreground/60 text-center mb-3">
              Or paste a Figma file URL directly
            </p>
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://figma.com/design/..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
              <button
                type="submit"
                className="shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {urlError && <p className="text-xs text-destructive mt-1">{urlError}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page wrapper (Suspense for useSearchParams)                               */
/* -------------------------------------------------------------------------- */

export default function SheetsIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <SheetsContent />
    </Suspense>
  )
}
