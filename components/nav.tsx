'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Network, Settings, Puzzle, MessageSquare, ClipboardList, ScrollText, LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-auth'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  external?: boolean
  /** When set, active when pathname matches and search param equals this value (e.g. 'stakeholder' for ?tab=stakeholder) */
  activeWhenSearch?: string
  /** When set, active when pathname matches and search param is not this value (e.g. Figma tab when not ?tab=stakeholder) */
  activeWhenNotSearch?: string
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
      { name: 'Figma Comments', href: '/sheets', icon: MessageSquare, activeWhenNotSearch: 'tab' },
      { name: 'Stakeholder Feedback', href: '/sheets?tab=stakeholder', icon: ClipboardList, activeWhenSearch: 'tab=stakeholder' },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Logs', href: '/admin/logs', icon: ScrollText },
    ],
  },
]

function NavContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="w-72 border-r bg-card p-5 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Heimdall</h1>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <div className="space-y-6 flex-1">
        {sections.map((section, sectionIdx) => (
          <div key={section.label}>
            {sectionIdx > 0 && <div className="mb-3 border-t border-border" />}
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.activeWhenSearch
                  ? pathname === '/sheets' && searchParams.get('tab') === 'stakeholder'
                  : item.activeWhenNotSearch
                    ? pathname === '/sheets' && searchParams.get('tab') !== 'stakeholder'
                    : item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname.startsWith(item.href.split('?')[0])
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

      {/* User footer */}
      {userEmail && (
        <div className="border-t border-border pt-4 mt-4">
          <p className="px-3 text-xs text-muted-foreground truncate mb-2" title={userEmail}>
            {userEmail}
          </p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}

function NavFallback() {
  return (
    <nav className="w-72 border-r bg-card p-5 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Heimdall</h1>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
      </div>
      <div className="flex-1 rounded-md bg-muted/50 animate-pulse" />
    </nav>
  )
}

export function Nav() {
  return (
    <Suspense fallback={<NavFallback />}>
      <NavContent />
    </Suspense>
  )
}
