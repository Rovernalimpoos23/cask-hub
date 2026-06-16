'use client'
// src/app/(app)/presidents-workflow/big-vision/3yr/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function ThreeYearPlanPage() {
  return (
    <VisionSubPageShell title="3-Year Plan — 2028" subtitle="Dominating Locally & Productizing Knowledge">
      <VisionContent horizon="3yr" />
    </VisionSubPageShell>
  )
}
