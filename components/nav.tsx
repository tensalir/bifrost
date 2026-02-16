'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Activity, FileText, Settings, FolderKanban, Plus, ScrollText, MessageSquare } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: Activity },
  { name: 'Jobs', href: '/admin/jobs', icon: FileText },
  { name: 'Queue', href: '/admin/queue', icon: Plus },
  { name: 'Routing', href: '/admin/routing', icon: FolderKanban },
  { name: 'Sheets', href: '/sheets', icon: MessageSquare, external: true },
  { name: 'Logs', href: '/admin/logs', icon: ScrollText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-card p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Heimdall</h1>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <ul className="space-y-2">
        {navigation.map((item) => {
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
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
