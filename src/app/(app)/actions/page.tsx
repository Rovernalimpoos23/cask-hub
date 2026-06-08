'use client'
// src/app/(app)/actions/page.tsx

import { useState, useEffect } from 'react'
import { TopBar, ActionItemRow, SectionLabel } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import type { ActionItem } from '@/types'

const OWNER_FILTERS = ['All', 'Calin', 'Kai', 'Chad', 'Rovern', 'All Leaders', 'All VPs']

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ownerFilter, setOwnerFilter] = useState('Mine')
  const [showAll, setShowAll] = useState(false)

  function isCoreOwner(owner: string) {
    const o = owner.toLowerCase().trim()
    return (
      o === 'calin' || o.startsWith('calin ') ||
      o === 'kai' || o.startsWith('kai ') ||
      o === 'rovern' || o.startsWith('rovern ')
    )
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('action_items')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as ActionItem[])
        setLoading(false)
      })
  }, [])

  const baseItems = showAll ? items : items.filter(a => isCoreOwner(a.owner))

  const filtered = ownerFilter === 'All' || ownerFilter === 'Mine'
    ? baseItems
    : baseItems.filter(item =>
        item.owner.toLowerCase().includes(ownerFilter.toLowerCase())
      )

  const openItems = filtered.filter(a => !a.done).sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )
  const completedItems = filtered.filter(a => a.done)

  async function handleToggle(id: string, done: boolean) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, done } : item))
    const supabase = createClient()
    const { error } = await supabase
      .from('action_items')
      .update({ done })
      .eq('id', id)
    if (error) console.error('[actions] toggle persist failed:', error)
  }

  return (
    <>
      <TopBar title="Action Items" subtitle="General Meetings">
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
            {loading ? 'Loading…' : showAll ? 'Showing all owners.' : 'Filtered to Calin, Kai & Rovern.'}
          </p>
        </div>

        {/* Owner filter */}
        <div className="flex items-center gap-1.5 mb-6 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex gap-1.5 flex-1 flex-wrap">
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
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-150 shrink-0"
            style={{
              background: showAll ? '#f59e0b' : 'none',
              color: showAll ? 'white' : 'var(--text3)',
              border: showAll ? '1px solid #f59e0b' : '1px solid var(--border)',
              fontFamily: 'var(--font-geist), sans-serif',
              cursor: 'pointer',
            }}
          >
            {showAll ? 'All Owners' : 'View All Owners'}
          </button>
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
