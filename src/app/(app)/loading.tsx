// src/app/(app)/loading.tsx
// Next.js automatically uses this as the Suspense fallback during navigation

function SkeletonCard({ wide = false }: { wide?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div className="shimmer" style={{ width: wide ? '55%' : '45%', height: 14, borderRadius: 5 }} />
      <div className="shimmer" style={{ width: '80%', height: 11, borderRadius: 4 }} />
      <div className="shimmer" style={{ width: wide ? '65%' : '35%', height: 11, borderRadius: 4 }} />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* TopBar skeleton */}
      <div
        style={{
          height: 57,
          borderBottom: '1px solid var(--border)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="shimmer" style={{ width: 110, height: 14, borderRadius: 5 }} />
          <div className="shimmer" style={{ width: 70, height: 10, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="shimmer" style={{ width: 80, height: 24, borderRadius: 20 }} />
          <div className="shimmer" style={{ width: 64, height: 24, borderRadius: 20 }} />
        </div>
      </div>

      {/* Content skeleton */}
      <div style={{ flex: 1, padding: '28px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'hidden' }}>
        {/* Page heading */}
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="shimmer" style={{ width: 180, height: 22, borderRadius: 6 }} />
          <div className="shimmer" style={{ width: 240, height: 12, borderRadius: 4 }} />
        </div>
        {/* Cards */}
        <SkeletonCard wide />
        <SkeletonCard />
        <SkeletonCard wide />
      </div>
    </div>
  )
}
