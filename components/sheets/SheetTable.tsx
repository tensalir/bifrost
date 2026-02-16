'use client'

import { cn } from '@/lib/utils'

export interface SheetTableColumn {
  key: string
  label: string
  /** Width: CSS value or Tailwind min/max class; default proportional */
  width?: string
  className?: string
}

interface SheetTableProps {
  columns: SheetTableColumn[]
  children: React.ReactNode
  /** Wrapper class for the scroll container */
  className?: string
}

/**
 * Table scaffold with sticky header row and consistent column semantics.
 * Use with thead/colgroup for column widths; children render tbody content.
 */
export function SheetTable({ columns, children, className }: SheetTableProps) {
  return (
    <div className={cn('flex flex-col flex-1 min-h-0 overflow-auto', className)}>
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          {columns.map((col) => (
            <col
              key={col.key}
              style={col.width ? { width: col.width } : undefined}
            />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-card border-b border-border">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50 last:border-r-0',
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
