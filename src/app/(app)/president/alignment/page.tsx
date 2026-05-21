// src/app/(app)/president/alignment/page.tsx
import ModuleMeetingsList from '@/components/module-page/ModuleMeetingsList'

export default function DepartmentAlignmentPage() {
  return (
    <ModuleMeetingsList
      topBarTitle="Department Alignment"
      topBarSubtitle="President Workflow"
      heading="Department Alignment Meetings"
      module="President Workflow — Department Alignment"
    />
  )
}
