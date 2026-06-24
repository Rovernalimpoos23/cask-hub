'use client'
// src/app/(app)/actions/page.tsx

import { useState, useEffect, useRef } from 'react'
import { TopBar, ActionItemRow, SectionLabel } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import type { ActionItem } from '@/types'
import { ArtifactContent } from '@/components/ai-panel/artifacts'

const OWNER_FILTERS = ['All', 'Calin', 'Kai', 'Chad', 'Rovern', 'All Leaders', 'All VPs']

// ── Floating Action Items AI — palette + chat config ─────────────────
const ACCENT = '#c8311a' // CASK red

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: ACCENT,
}

const AI_GREETING =
  "Action Items AI online. I have context on all tasks, owners, due dates, and completion status across your sessions. Ask about open items, who owns what, or what's overdue."

const QUICK_PROMPTS = ["What's overdue?", 'My open items', 'Tasks by owner']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Action Items AI button + chat drawer ────────────────────

function FloatingActionsAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      userEmailRef.current = user.email
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', user.email)
        .eq('page_context', '/actions')
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: '/actions', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/actions')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/actions',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <style>{`
        @keyframes actionsSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Action Items */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--charcoal)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>💬</span>
        Action Items AI
      </button>

      {/* Chat drawer — slides up from bottom-right */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 61,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 500,
            maxHeight: 'calc(100vh - 48px)',
            background: D.bg,
            color: D.text,
            border: `1px solid ${D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'actionsSlideUp 220ms ease',
          }}
        >
          {/* Dark header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: 'var(--charcoal)',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: D.accent,
                  boxShadow: `0 0 8px ${D.accent}`,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#fff',
                }}
              >
                Action Items AI
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            </span>
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? D.text3 : D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'Action Items AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? D.text2 : D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <ArtifactContent content={m.content} />
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ padding: '11px 0' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: D.accent,
                    marginBottom: 5,
                  }}
                >
                  Action Items AI
                </div>
                <div style={{ fontSize: 12.5, color: D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: D.surface,
                    border: `1px solid ${D.border}`,
                    color: D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${D.accent}66`
                    e.currentTarget.style.color = D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = D.border
                    e.currentTarget.style.color = D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${D.border}`,
                background: D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about tasks, owners, due dates..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: input.trim() && !thinking ? D.accent : D.surface,
                  color: input.trim() && !thinking ? '#fff' : D.text3,
                  border: 'none',
                  cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease',
                }}
                title="Send"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 1L11 6L6 11M11 6H1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
      .from('meetings')
      .select('id, action_items')
      .not('action_items', 'is', null)
      .neq('action_items', '[]')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as { id: string; action_items: ActionItem[] | null }[]
        // Flatten every meeting's action_items array into one list. The JSON items
        // have no id, so synthesize a stable one (meeting id + index) for React keys
        // and toggle lookups, and carry the source meeting_id for write-back.
        const flattened = rows.flatMap(m =>
          (m.action_items ?? []).map((a, i) => ({ ...a, id: `${m.id}:${i}`, meeting_id: m.id }))
        )
        setItems(flattened as ActionItem[])
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
    // Optimistic UI
    setItems(prev => prev.map(item => (item.id === id ? { ...item, done } : item)))

    const target = items.find(item => item.id === id)
    if (!target?.meeting_id) return

    const supabase = createClient()

    // Read the source meeting's current action_items array.
    const { data } = await supabase
      .from('meetings')
      .select('action_items')
      .eq('id', target.meeting_id)
      .single()
    const current = (data?.action_items ?? []) as ActionItem[]

    // Flip the matching item's done field (matched by task + owner), then save back.
    const updated = current.map(a =>
      a.task === target.task && a.owner === target.owner ? { ...a, done } : a
    )
    const { error } = await supabase
      .from('meetings')
      .update({ action_items: updated })
      .eq('id', target.meeting_id)
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

      {/* Floating Action Items AI button + chat drawer — bottom-right, this page only */}
      <FloatingActionsAI />
    </>
  )
}
