// src/app/(app)/layout.tsx
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'
import AIPanel from '@/components/ai-panel/AIPanel'
import Loading from './loading'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="flex flex-col overflow-hidden bg-[var(--bg)]">
        <Suspense fallback={<Loading />}>
          {children}
        </Suspense>
      </main>
      <AIPanel />
    </div>
  )
}
