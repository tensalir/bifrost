'use client'

import { cn } from '@/lib/utils'

/**
 * Page framing for all sheet types: full height, flex column, background.
 * Use as the root wrapper for CommentSheet, StakeholderSheet, etc.
 */
export function SheetShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'h-full flex flex-col bg-background text-foreground overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  )
}
