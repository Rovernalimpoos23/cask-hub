'use client'
// src/app/(app)/presidents-workflow/big-vision/pit/page.tsx
//
// "PIT" (Personal Improvement Targets) sub-page — Coming Soon placeholder.
// Wrapped in the shared Big Vision sub-page shell (back button + header +
// floating CASK Big Vision AI).

import VisionSubPageShell from '../_components/VisionSubPageShell'

export default function PitPage() {
  return (
    <VisionSubPageShell title="PIT" subtitle="Personal Improvement Targets">
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
