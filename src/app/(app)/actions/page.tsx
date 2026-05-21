'use client'
// src/app/(app)/actions/page.tsx

import { useState, useEffect } from 'react'
import { TopBar, ActionItemRow, SectionLabel } from '@/components/ui'
import { fetchAllMeetings, updateActionItemDone } from '@/lib/meetings-client'
import type { ActionItem, Meeting } from '@/types'

const OWNER_FILTERS = ['All', 'Calin', 'Kai', 'Chad', 'Rovern', 'All Leaders', 'All VPs']

// Extend ActionItem locally to track which meeting it belongs to
type RichActionItem = ActionItem & { meeting_id: string }

export default function ActionsPage() {
  const [items, setItems] = useState<RichActionItem[]>([])
  const [meetingsMap, setMeetingsMap] = useState<Record<string, Meeting>>({})
  const [loading, setLoading] = useState(true)
  const [ownerFilter, setOwnerFilter] = useState('All')

  useEffect(() => {
    fetchAllMeetings().then(meetings => {
      const map: Record<string, Meeting> = {}
      const rich: RichActionItem[] = []
      for (const m of meetings) {
        map[m.id] = m
        for (const item of m.action_items) {
          rich.push({ ...item, meeting_id: m.id })
        }
      }
      setMeetingsMap(map)
      setItems(rich)
      setLoading(false)
    })
  }, [])

  const filtered = ownerFilter === 'All'
    ? items
    : items.filter(item =>
        item.owner.toLowerCase().includes(ownerFilter.toLowerCase())
      )

  const openItems = filtered.filter(a => !a.done).sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )
  const completedItems = filtered.filter(a => a.done)

  function handleToggle(id: string, done: boolean) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, done } : item))

    // Persist to Supabase: find the meeting and update its action_items JSONB
    const target = items.find(i => i.id === id)
    if (target) {
      const meeting = meetingsMap[target.meeting_id]
      if (meeting) {
        updateActionItemDone(target.meeting_id, id, done, meeting.action_items)
        // Update local map so subsequent toggles have fresh data
        setMeetingsMap(prev => ({
          ...prev,
          [target.meeting_id]: {
            ...prev[target.meeting_id],
            action_items: prev[target.meeting_id].action_items.map(i =>
              i.id === id ? { ...i, done } : i
            ),
          },
        }))
      }
    }
  }

  return (
    <>
      <TopBar title="Action Items" subtitle="ActionCOACH">
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
        >
          {loading ? '…' : openItems.length} Open
        </span>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid #bbf7d0' }}
        >
          {loading ? '…' : completedItems.length} Done
        </span>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-7 animate-page-in">
        <div className="mb-6">
          <h1
            className="font-serif text-[26px] font-normal tracking-[-0.5px] leading-[1.1]"
            style={{ color: 'var(--text)' }}
          >
            Action Items
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {loading ? 'Loading…' : 'All commitments from ActionCOACH sessions.'}
          </p>
        </div>

        {/* Owner filter */}
        <div className="flex gap-1.5 mb-6 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {OWNER_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setOwnerFilter(f)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-150"
              style={{
                background: ownerFilter === f ? 'var(--charcoal)' : 'none',
                color: ownerFilter === f ? 'white' : 'var(--text3)',
                border: ownerFilter === f ? '1px solid var(--charcoal)' : '1px solid var(--border)',
                fontFamily: 'var(--font-geist), sans-serif',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-[5px]">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-[6px] h-[56px] shimmer" style={{ border: '1px solid var(--border)' }} />
            ))}
          </div>
        ) : (
          <>
            {openItems.length > 0 && (
              <div className="mb-7">
                <SectionLabel>Open Items</SectionLabel>
                <div className="flex flex-col gap-[5px]">
                  {openItems.map(item => (
                    <ActionItemRow key={item.id} item={item} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}

            {completedItems.length > 0 && (
              <div>
                <SectionLabel>Completed</SectionLabel>
                <div className="flex flex-col gap-[5px]">
                  {completedItems.map(item => (
                    <ActionItemRow key={item.id} item={item} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}

            {openItems.length === 0 && completedItems.length === 0 && (
              <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text3)' }}>
                No action items for this owner filter.
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
