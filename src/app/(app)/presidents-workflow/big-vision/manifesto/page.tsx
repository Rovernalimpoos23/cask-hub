'use client'
// src/app/(app)/presidents-workflow/big-vision/manifesto/page.tsx

import VisionSubPageShell from '../_components/VisionSubPageShell'
import VisionContent from '../_components/VisionContent'

export default function ManifestoPage() {
  return (
    <VisionSubPageShell
      title="CASK Manifesto"
      subtitle="Built on Purpose. Rooted in Community. Focused on People."
    >
      {/* Statement variant: larger body text + more generous line height */}
      <VisionContent horizon="manifesto" variant="statement" />
    </VisionSubPageShell>
  )
}
