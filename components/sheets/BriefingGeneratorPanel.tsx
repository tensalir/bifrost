'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Lightbulb, BarChart3, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRODUCTS = [
  { id: 'quiet', label: 'Quiet' },
  { id: 'engage', label: 'Engage' },
  { id: 'experience', label: 'Experience' },
  { id: 'dream', label: 'Dream' },
] as const

const DATASOURCES = [
  { id: 'social media comments', label: 'Social', icon: MessageSquare },
  { id: 'untapped use cases', label: 'Use cases', icon: Lightbulb },
  { id: 'ad performance', label: 'Ads', icon: BarChart3 },
] as const

export interface BriefingGeneratorPanelProps {
  onGenerate?: (product: string, datasources: string[]) => void | Promise<void>
}

export function BriefingGeneratorPanel({ onGenerate }: BriefingGeneratorPanelProps) {
  const [product, setProduct] = useState('')
  const [selectedDatasources, setSelectedDatasources] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const toggleDatasource = (id: string) => {
    setSelectedDatasources((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const handleGenerate = async () => {
    if (!product.trim() || selectedDatasources.length === 0) return
    setIsLoading(true)
    try {
      await onGenerate?.(product, selectedDatasources)
    } finally {
      setIsLoading(false)
    }
  }

  const canGenerate = product && selectedDatasources.length > 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Products – compact floating control group */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-2">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
          Product
        </span>
        <div className="flex items-center rounded-md bg-muted/40 p-0.5">
          {PRODUCTS.map((prod) => {
            const isSelected = product === prod.id
            return (
              <button
                key={prod.id}
                type="button"
                disabled={isLoading}
                onClick={() => setProduct(isSelected ? '' : prod.id)}
                aria-pressed={isSelected}
                aria-label={`Select product: ${prod.label}`}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {prod.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Data sources – compact floating control group */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-2">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
          Data sources
        </span>
        <div className="flex items-center gap-0.5 flex-wrap">
          {DATASOURCES.map((ds) => {
            const Icon = ds.icon
            const isSelected = selectedDatasources.includes(ds.id)
            return (
              <button
                key={ds.id}
                type="button"
                disabled={isLoading}
                onClick={() => toggleDatasource(ds.id)}
                aria-pressed={isSelected}
                aria-label={`Toggle data source: ${ds.label}`}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent'
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {ds.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Generate CTA */}
      <div className="flex items-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !canGenerate}
          aria-label="Generate angles"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            canGenerate
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-muted/50 text-muted-foreground/60 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
          )}
          Generate
        </button>
      </div>
    </div>
  )
}
