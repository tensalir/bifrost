import { Suspense } from 'react'
import { Nav } from '@/components/nav'
import { Loader2 } from 'lucide-react'

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
