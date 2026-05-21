// src/app/(app)/customers/page.tsx
import ModuleMeetingsList from '@/components/module-page/ModuleMeetingsList'

export default function ActiveClientsPage() {
  return (
    <ModuleMeetingsList
      topBarTitle="Active Clients"
      topBarSubtitle="Customer Journey"
      heading="Active Client Projects"
      module="Customer Journey — Active Clients"
    />
  )
}
