'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, Lightbulb, BarChart3, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRODUCTS = [
  { id: 'quiet', label: 'Quiet', gradient: 'from-slate-100 to-gray-50', selectedGradient: 'from-slate-200 to-gray-100', borderColor: 'border-slate-300', selectedBorder: 'border-slate-400' },
  { id: 'engage', label: 'Engage', gradient: 'from-rose-50 to-pink-50', selectedGradient: 'from-rose-100 to-pink-100', borderColor: 'border-rose-200', selectedBorder: 'border-rose-400' },
  { id: 'experience', label: 'Experience', gradient: 'from-amber-50 to-yellow-50', selectedGradient: 'from-amber-100 to-yellow-100', borderColor: 'border-amber-200', selectedBorder: 'border-amber-400' },
  { id: 'dream', label: 'Dream', gradient: 'from-purple-50 to-violet-50', selectedGradient: 'from-purple-100 to-violet-100', borderColor: 'border-purple-200', selectedBorder: 'border-purple-400' },
] as const

const DATASOURCES = [
  { id: 'social media comments', label: 'Social Media Comments', icon: MessageSquare, color: 'blue' as const },
  { id: 'untapped use cases', label: 'Untapped Use Cases', icon: Lightbulb, color: 'purple' as const },
  { id: 'ad performance', label: 'Ad Performance', icon: BarChart3, color: 'green' as const },
]

const DATASOURCE_COLORS: Record<string, { selected: string; unselected: string }> = {
  blue: {
    selected: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    unselected: 'border-border hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30',
  },
  purple: {
    selected: 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400',
    unselected: 'border-border hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30',
  },
  green: {
    selected: 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400',
    unselected: 'border-border hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30',
  },
}

export interface BriefingGeneratorPanelProps {
  onGenerate?: (product: string, datasources: string[]) => void | Promise<void>
  defaultCollapsed?: boolean
}

export function BriefingGeneratorPanel({ onGenerate, defaultCollapsed = false }: BriefingGeneratorPanelProps) {
  const [product, setProduct] = useState('')
  const [selectedDatasources, setSelectedDatasources] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const toggleDatasource = (id: string) => {
    setSelectedDatasources((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product.trim() || selectedDatasources.length === 0) return
    setIsLoading(true)
    try {
      await onGenerate?.(product, selectedDatasources)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-medium text-foreground">Generate</span>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-0 space-y-4 border-t border-border pt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Product</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((prod) => {
                const isSelected = product === prod.id
                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setProduct(prod.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 bg-gradient-to-br disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelected ? `${prod.selectedGradient} ${prod.selectedBorder} shadow-sm` : `${prod.gradient} ${prod.borderColor} hover:shadow-sm`
                    )}
                  >
                    <span className={cn('text-xs font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>{prod.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-foreground" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Data sources
              {selectedDatasources.length > 0 && <span className="ml-2 text-primary">{selectedDatasources.length} selected</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {DATASOURCES.map((ds) => {
                const Icon = ds.icon
                const isSelected = selectedDatasources.includes(ds.id)
                const colors = DATASOURCE_COLORS[ds.color] ?? DATASOURCE_COLORS.blue
                return (
                  <button
                    key={ds.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => toggleDatasource(ds.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelected ? colors.selected : colors.unselected
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{ds.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !product || selectedDatasources.length === 0}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate angles'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
