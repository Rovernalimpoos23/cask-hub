'use client'
// src/app/(app)/presidents-workflow/big-vision/charters/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function ChartersPage() {
  return (
    <VisionSubPageShell
      title="Division Charters & Org Structure"
      subtitle="ADU Division · New Build Division · Org Chart · Planning Agenda"
    >
      {/* division_charters content is split on "---" into 4 sub-headed sections. */}
      <VisionContent horizon="division_charters" />
    </VisionSubPageShell>
  )
}
