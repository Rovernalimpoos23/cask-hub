'use client'
// src/app/(app)/actions/page.tsx

import { useState } from 'react'
import { MEETINGS } from '@/lib/seed-data'
import { TopBar, ActionItemRow, SectionLabel } from '@/components/ui'
import type { ActionItem } from '@/types'

const OWNER_FILTERS = ['All', 'Calin', 'Kai', 'Chad', 'Rovern', 'All Leaders', 'All VPs']

export default function ActionsPage() {
  const allActions: ActionItem[] = MEETINGS.flatMap(m => m.action_items)

  const [ownerFilter, setOwnerFilter] = useState('All')
  const [items, setItems] = useState(allActions)

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
  }

  return (
    <>
      <TopBar title="Action Items" subtitle="ActionCOACH">
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--red-soft)',
            color: 'var(--red)',
            border: '1px solid var(--red-border)',
          }}
        >
          {openItems.length} Open
        </span>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--green-bg)',
            color: 'var(--green)',
            border: '1px solid #bbf7d0',
          }}
        >
          {completedItems.length} Done
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
            All commitments from ActionCOACH sessions — Feb through Apr 2026.
          </p>
        </div>

        {/* Owner filter */}
        <div
          className="flex gap-1.5 mb-6 pb-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
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

        {/* Open */}
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

        {/* Completed */}
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
          <div
            className="text-center py-12 text-[13px]"
            style={{ color: 'var(--text3)' }}
          >
            No action items for this owner filter.
          </div>
        )}
      </div>
    </>
  )
}
