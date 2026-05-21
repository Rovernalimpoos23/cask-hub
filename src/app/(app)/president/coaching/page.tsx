// src/app/(app)/president/coaching/page.tsx
import { TopBar } from '@/components/ui'

export default function CoachingSessionsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Coaching Sessions" subtitle="President Workflow" />

      <div className="flex-1 overflow-y-auto p-6">

        <h1
          className="font-serif text-[28px] font-normal tracking-[-0.01em] mb-6"
          style={{ color: 'var(--text)' }}
        >
          Coaching Intelligence
        </h1>

        <div
          className="rounded-xl p-6 mb-4 max-w-xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[20px] shrink-0"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              🎯
            </div>
            <span
              className="text-[11px] font-semibold tracking-[0.8px] uppercase px-2.5 py-1 rounded-full shrink-0"
              style={{
                color: '#92400e',
                background: 'var(--amber-bg)',
                border: '1px solid rgba(146,64,14,0.2)',
              }}
            >
              In Progress
            </span>
          </div>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text2)' }}>
            All coaching sessions connected to yearly, quarterly, and department goals. Coaching is the hub that connects to everything — PIT goals, Design Center, big vision, 10-year goal.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text3)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="4" x2="9" y2="9" />
            <line x1="15" y1="4" x2="15" y2="9" />
          </svg>
          Planned for May 22, 2026 session with Calin
        </div>

      </div>
    </div>
  )
}
