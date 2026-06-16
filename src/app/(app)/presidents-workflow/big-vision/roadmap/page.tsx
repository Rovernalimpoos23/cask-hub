'use client'
// src/app/(app)/presidents-workflow/big-vision/roadmap/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function RoadmapPage() {
  return (
    <VisionSubPageShell
      title="10-Year Strategic Roadmap"
      subtitle="A 10-Year Vision for Becoming the Blueprint for Builders Nationwide"
    >
      {/* The 10-year roadmap is stored under the 'org_chart' horizon. */}
      <VisionContent horizon="org_chart" />
    </VisionSubPageShell>
  )
}
