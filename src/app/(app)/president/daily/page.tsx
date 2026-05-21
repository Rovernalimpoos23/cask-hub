// src/app/(app)/president/daily/page.tsx
import ModuleMeetingsList from '@/components/module-page/ModuleMeetingsList'

export default function DailyMeetingsPage() {
  return (
    <ModuleMeetingsList
      topBarTitle="Daily Meetings"
      topBarSubtitle="President Workflow"
      heading="Daily Meeting Recaps"
      module="President Workflow — Daily Meetings"
    />
  )
}
