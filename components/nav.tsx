'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Network, Settings, Puzzle, MessageSquare, ScrollText } from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  external?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: 'Platform',
    items: [
      { name: 'Connections', href: '/admin', icon: Network },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    label: 'Tools',
    items: [
      { name: 'Heimdall Plugin', href: '/admin/plugin', icon: Puzzle },
      { name: 'Feedback Summarizer', href: '/sheets', icon: MessageSquare, external: true },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Logs', href: '/admin/logs', icon: ScrollText },
    ],
  },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-card p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Heimdall</h1>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <div className="space-y-6">
        {sections.map((section, sectionIdx) => (
          <div key={section.label}>
            {sectionIdx > 0 && <div className="mb-3 border-t border-border" />}
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
