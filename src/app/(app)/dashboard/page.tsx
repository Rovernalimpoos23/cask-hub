// src/app/(app)/dashboard/page.tsx
import { getMeetings, getAllActionItems } from '@/lib/meetings'
import { MEETINGS } from '@/lib/seed-data'
import {
  TopBar,
  PillGreen,
  PillRed,
  StatCard,
  MeetingCard,
  ActionItemRow,
  SectionLabel,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Use seed data directly for reliability; swap to getMeetings() once Supabase is connected
  const meetings = [...MEETINGS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const allActions = meetings.flatMap(m => m.action_items)
  const openActions = allActions.filter(a => !a.done)
  const completedActions = allActions.filter(a => a.done)
  const recentMeetings = meetings.slice(0, 3)
  const recentOpenActions = openActions.slice(0, 3)
  const recentCompletedActions = completedActions.slice(0, 2)

  return (
    <>
      <TopBar title="Dashboard" subtitle="ActionCOACH Intelligence">
        <PillGreen>Claude AI Active</PillGreen>
        <PillRed>6 Sessions</PillRed>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        {/* Greeting */}
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            Good morning, Calin.
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            Here&apos;s your ActionCOACH intelligence overview — May 2026.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          <StatCard
            value={meetings.length}
            label="Total Sessions"
            hint="Feb – Apr 2026"
            variant="default"
            index={0}
          />
          <StatCard
            value={1}
            label="Upcoming Meeting"
            hint="May 28, 2026"
            variant="alert"
            index={1}
          />
          <StatCard
            value={openActions.length}
            label="Open Action Items"
            hint="Across all sessions"
            variant="default"
            index={2}
          />
          <StatCard
            value={completedActions.length}
            label="Completed"
            hint="All time"
            variant="success"
            index={3}
          />
        </div>

        {/* Recent Sessions */}
        <div className="mb-7">
          <SectionLabel action="View all →" href="/sessions">
            Recent Sessions
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {recentMeetings.map(m => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        </div>

        {/* Open Action Items */}
        <div>
          <SectionLabel action="View all →" href="/actions">
            Open Action Items
          </SectionLabel>
          <div className="flex flex-col gap-[5px]">
            {recentOpenActions.map(item => (
              <ActionItemRow key={item.id} item={item} />
            ))}
            {/* Show a couple completed items */}
            {recentCompletedActions.map(item => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
