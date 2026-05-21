// src/app/(app)/president/coaching/page.tsx
import ModuleMeetingsList from '@/components/module-page/ModuleMeetingsList'

export default function CoachingSessionsPage() {
  return (
    <ModuleMeetingsList
      topBarTitle="Coaching Sessions"
      topBarSubtitle="President Workflow"
      heading="Coaching Intelligence"
      module="President Workflow — Coaching Sessions"
    />
  )
}
