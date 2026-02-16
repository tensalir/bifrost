'use client'

import { cn } from '@/lib/utils'

interface SheetHeaderProps {
  /** Left side: back link, icon, title, optional metadata/selector */
  left: React.ReactNode
  /** Right side: action buttons (Import, Sync, etc.) */
  right?: React.ReactNode
  className?: string
}

/**
 * Consistent header for sheet UIs: border, card-style background, left/right slots.
 * Aligns with CommentHeader structure for parity across sheet types.
 */
export function SheetHeader({ left, right, className }: SheetHeaderProps) {
  return (
    <header
      className={cn(
        'flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm',
        className
      )}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4 min-h-[52px]">
        <div className="flex items-center gap-3 min-w-0 flex-1">{left}</div>
        {right != null && (
          <div className="flex items-center gap-2 flex-shrink-0">{right}</div>
        )}
      </div>
    </header>
  )
}
