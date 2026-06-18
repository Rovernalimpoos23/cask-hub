'use client'
// src/app/(app)/presidents-workflow/big-vision/design-center/page.tsx
//
// "Design Center" sub-page — Coming Soon placeholder. Wrapped in the shared Big
// Vision sub-page shell (back button + header + floating CASK Big Vision AI).

import VisionSubPageShell from '../_components/VisionSubPageShell'

export default function DesignCenterPage() {
  return (
    <VisionSubPageShell title="Design Center" subtitle="Design files · Client presentations">
      <div
        style={{
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--text3)' }}>Coming Soon</span>
      </div>
    </VisionSubPageShell>
  )
}
