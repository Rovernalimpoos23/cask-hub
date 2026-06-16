'use client'
// src/app/(app)/presidents-workflow/big-vision/1yr/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function OneYearPlanPage() {
  return (
    <VisionSubPageShell title="1-Year Plan — 2025–2026" subtitle="Laying the Foundation">
      <VisionContent horizon="1yr" />
    </VisionSubPageShell>
  )
}
