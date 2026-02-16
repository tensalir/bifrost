'use client'

import { cn } from '@/lib/utils'

interface AgencySectionProps {
  /** Agency name (e.g. "Gain", "Monks") */
  title: string
  /** Optional count badge */
  count?: number
  children: React.ReactNode
  className?: string
}

/**
 * Compact section header for agency grouping in stakeholder sheets.
 * Renders a small header row plus children (experiment rows).
 */
export function AgencySection({ title, count, children, className }: AgencySectionProps) {
  return (
    <section className={cn('', className)}>
      <div className="flex-shrink-0 flex items-center justify-between py-2 px-3 bg-muted/30 border-y border-border/60">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {count != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {count} experiment{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
