// src/app/(app)/layout.tsx
import Sidebar from '@/components/sidebar/Sidebar'
import AIPanel from '@/components/ai-panel/AIPanel'
import AddMeetingModal from '@/components/add-meeting-modal/AddMeetingModal'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="flex flex-col overflow-hidden bg-[var(--bg)]">
        {children}
      </main>
      <AIPanel />
      <AddMeetingModal />
    </div>
  )
}
