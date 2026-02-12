'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Activity, FileText, Settings, FolderKanban, Plus } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Jobs', href: '/jobs', icon: FileText },
  { name: 'Queue', href: '/queue', icon: Plus },
  { name: 'Routing', href: '/routing', icon: FolderKanban },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-card p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Bifrost</h1>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <ul className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.name}>
              <Link
                href={item.href}
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
