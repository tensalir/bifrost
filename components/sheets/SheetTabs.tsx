'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SheetTabItem {
  id: string
  label: string
  /** Optional badge (e.g. count) */
  badge?: string | number
}

interface SheetTabsProps {
  tabs: SheetTabItem[]
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
}

/**
 * Bottom tab bar for worksheet/round navigation. Matches CommentSheet page-tab pattern.
 * Sticky at bottom of sheet content area; horizontal scroll when many tabs.
 */
export function SheetTabs({ tabs, activeId, onSelect, className }: SheetTabsProps) {
  const tabBarRef = useRef<HTMLDivElement>(null)

  if (tabs.length === 0) return null

  return (
    <div
      className={cn(
        'flex-shrink-0 border-t border-border bg-card/40',
        className
      )}
    >
      <div
        ref={tabBarRef}
        className="flex overflow-x-auto scrollbar-thin px-2 gap-0"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                'flex-shrink-0 px-4 py-2 text-xs font-medium transition-all',
                'border-t-2 whitespace-nowrap',
                'hover:text-foreground hover:bg-muted/30',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate max-w-[200px]">{tab.label}</span>
                {tab.badge != null && (
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                    ({tab.badge})
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
