'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Temporary shim: Stakeholder Feedback has moved to /sheets/stakeholder.
 * Redirect so old links and bookmarks still work during migration.
 */
export default function FeedbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const round = searchParams.get('round')
    const target = round
      ? `/sheets/stakeholder?round=${encodeURIComponent(round)}`
      : '/sheets/stakeholder'
    router.replace(target)
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}
