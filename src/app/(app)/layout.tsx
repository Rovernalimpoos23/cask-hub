'use client'
// src/app/(app)/layout.tsx
import Sidebar from '@/components/sidebar/Sidebar'
import AddMeetingModal from '@/components/add-meeting-modal/AddMeetingModal'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell app-shell--no-panel">
      <Sidebar />
      <main id="main-content" className="flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
      <AddMeetingModal />
    </div>
  )
}
