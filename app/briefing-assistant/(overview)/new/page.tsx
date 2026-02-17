'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * New sprint flow: redirect to overview until the create-sprint form is built.
 */
export default function NewSprintPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/briefing-assistant')
  }, [router])
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}
