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
    <div className="flex items-center gap-0.5">
      {/* Product segmented control */}
      <div className="flex items-center rounded-md bg-muted/40 p-0.5">
        {PRODUCTS.map((prod) => {
          const isSelected = product === prod.id
          return (
            <button
              key={prod.id}
              type="button"
              disabled={isLoading}
              onClick={() => setProduct(isSelected ? '' : prod.id)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition-all disabled:opacity-50',
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

      {/* Divider */}
      <div className="w-px h-5 bg-border/60 mx-2" />

      {/* Data source toggles */}
      <div className="flex items-center gap-0.5">
        {DATASOURCES.map((ds) => {
          const Icon = ds.icon
          const isSelected = selectedDatasources.includes(ds.id)
          return (
            <button
              key={ds.id}
              type="button"
              disabled={isLoading}
              onClick={() => toggleDatasource(ds.id)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all disabled:opacity-50',
                isSelected
                  ? 'bg-muted/60 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Icon className="h-3 w-3" />
              {ds.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border/60 mx-2" />

      {/* Generate */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading || !canGenerate}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all',
          canGenerate
            ? 'text-primary hover:bg-primary/10'
            : 'text-muted-foreground/40 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Generate
      </button>
    </div>
  )
}
