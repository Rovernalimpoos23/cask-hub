'use client'
// src/app/(app)/layout.tsx
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar/Sidebar'
import AIPanel from '@/components/ai-panel/AIPanel'
import AddMeetingModal from '@/components/add-meeting-modal/AddMeetingModal'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Command Center runs full-width with its own floating AI — hide the shared panel.
  const hideAIPanel = pathname === '/command-center'

  return (
    <div className={`app-shell${hideAIPanel ? ' app-shell--no-panel' : ''}`}>
      <Sidebar />
      <main id="main-content" className="flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
      {!hideAIPanel && <AIPanel />}
      <AddMeetingModal />
    </div>
  )
}
