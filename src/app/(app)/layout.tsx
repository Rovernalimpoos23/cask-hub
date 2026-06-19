'use client'
// src/app/(app)/layout.tsx
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar/Sidebar'
import AIPanel from '@/components/ai-panel/AIPanel'
import AddMeetingModal from '@/components/add-meeting-modal/AddMeetingModal'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // These routes run full-width with their own floating AI — hide the shared panel.
  const FULL_WIDTH_ROUTES = ['/command-center', '/command-center/sales', '/command-center/operations', '/command-center/finance', '/command-center/hr', '/command-center/executive', '/sessions', '/generate', '/actions', '/president/overview', '/president/calendar', '/daily-meetings', '/customers', '/design-center', '/dashboard', '/presidents-workflow/big-vision', '/presidents-workflow/big-vision/1yr', '/presidents-workflow/big-vision/3yr', '/presidents-workflow/big-vision/5yr', '/presidents-workflow/big-vision/manifesto', '/presidents-workflow/big-vision/charters', '/presidents-workflow/big-vision/roadmap', '/presidents-workflow/big-vision/documents', '/presidents-workflow/big-vision/meeting-cadence', '/presidents-workflow/big-vision/the-big-vision', '/presidents-workflow/big-vision/department-alignment', '/presidents-workflow/big-vision/department-alignment/sales-marketing', '/presidents-workflow/big-vision/department-alignment/human-resources', '/presidents-workflow/big-vision/department-alignment/finance', '/presidents-workflow/big-vision/department-alignment/operations', '/presidents-workflow/big-vision/pit', '/presidents-workflow/big-vision/design-center']
  const hideAIPanel = FULL_WIDTH_ROUTES.includes(pathname) || /^\/customers\/[^/]+/.test(pathname) || /^\/sessions\/[^/]+/.test(pathname)

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
