'use client'
// src/app/(app)/presidents-workflow/big-vision/5yr/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function FiveYearPlanPage() {
  return (
    <VisionSubPageShell title="5-Year Plan — 2030" subtitle="Expansion & Platform Building">
      <VisionContent horizon="5yr" />
    </VisionSubPageShell>
  )
}
