'use client'

import { BriefingAssistantSheet } from '@/components/sheets/BriefingAssistantSheet'
import { Nav } from '@/components/nav'

export default function BriefingAssistantPage() {
  return (
    <div className="h-full flex overflow-hidden bg-background">
      <Nav />
      <BriefingAssistantSheet />
    </div>
  )
}
