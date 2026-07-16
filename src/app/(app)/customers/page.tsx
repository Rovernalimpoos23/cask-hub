'use client'
// src/app/(app)/customers/page.tsx

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ArtifactContent } from '@/components/ai-panel/artifacts'

type Happiness = 'green' | 'yellow' | 'red'

interface Client {
  id: string
  name: string
  project_type: string
  project_value: number
  location: string
  happiness: Happiness
  meetings_completed: number
  total_meetings: number
  owner: string
  meetingsCompleted: number
  emailsSent: number
}


const HAPPINESS_CONFIG = {
  green: {
    pill: { background: 'var(--green-bg)', color: '#166534' },
    label: 'Happy',
    accent: '#16a34a',
  },
  yellow: {
    pill: { background: 'var(--amber-bg)', color: '#92400E' },
    label: 'At Risk',
    accent: '#d97706',
  },
  red: {
    pill: { background: 'var(--red-soft)', color: '#9B1C0E' },
    label: 'Needs Attention',
    accent: '#dc2626',
  },
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US')
}

function ClientCard({ client, onRequestDelete }: { client: Client; onRequestDelete: (client: Client) => void }) {
  const [hovered, setHovered] = useState(false)
  const config = HAPPINESS_CONFIG[client.happiness]
  const pct = Math.round((client.meetingsCompleted / 33) * 100)

  return (
    <Link
      href={`/customers/${client.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="no-underline block"
      style={{
        background: hovered ? 'var(--card-hover, rgba(0,0,0,0.02))' : 'var(--card, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderLeft: `3px solid ${config.accent}`,
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'background 160ms ease, box-shadow 160ms ease',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#2d2d2d',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}
      >
        {getInitials(client.name)}
      </div>

      {/* Name + project */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--foreground, #111)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {client.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted, #6b7280)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {client.project_type} · {client.location}
        </div>
      </div>

      {/* Happiness pill */}
      <div
        style={{
          ...config.pill,
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {config.label}
      </div>

      {/* Progress */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted, #6b7280)', marginBottom: 5 }}>
          {client.meetingsCompleted} of 33 steps
          {client.emailsSent > 0 && <span style={{ color: 'var(--muted, #6b7280)' }}> · {client.emailsSent} emails sent</span>}
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 4,
            background: 'var(--border, #e5e7eb)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 4,
              background: config.accent,
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Project value */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--foreground, #111)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 80,
          textAlign: 'right',
        }}
      >
        {formatCurrency(client.project_value)}
      </div>

      {/* Delete button — subtle, hover-revealed, sits next to the arrow.
          Tabler icons are NOT loaded in this project, so a small red "Delete"
          text label is used instead of <i className="ti ti-trash" />.
          stopPropagation + preventDefault keep the card's Link from navigating. */}
      <span
        role="button"
        tabIndex={0}
        title={`Delete ${client.name}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRequestDelete(client)
        }}
        style={{
          fontSize: 11,
          color: '#ef4444',
          cursor: 'pointer',
          flexShrink: 0,
          padding: '2px 4px',
          lineHeight: 1,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 160ms ease',
        }}
      >
        Delete
      </span>

      {/* Arrow */}
      <div
        style={{
          color: 'var(--muted, #9ca3af)',
          flexShrink: 0,
          fontSize: 16,
          marginLeft: 2,
          transition: 'transform 160ms ease',
          transform: hovered ? 'translateX(2px)' : 'none',
        }}
      >
        →
      </div>
    </Link>
  )
}

// ── Floating Customer Journey AI — palette + chat config ─────────────
const AI_ACCENT = '#c8311a' // CASK red

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const AI_D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: AI_ACCENT,
}

const AI_GREETING =
  "Customer Journey AI online. I have context on all active clients, their projects, and where they are in the customer journey. Ask about clients, projects, or journey phases."

const AI_QUICK_PROMPTS = ['Clients by phase', 'At-risk clients', 'Project status']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Customer Journey AI button + chat drawer ────────────────

function FloatingCustomerJourneyAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

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
        .eq('page_context', '/customers')
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
      .insert({ user_email: userEmailRef.current, page_context: '/customers', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/customers')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

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
          pageContext: '/customers',
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
        @keyframes customerJourneySlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Active Clients */}
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
          background: 'var(--fable-red)',
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
        Customer Journey AI
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
            background: AI_D.bg,
            color: AI_D.text,
            border: `1px solid ${AI_D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'customerJourneySlideUp 220ms ease',
          }}
        >
          {/* Header — always dark (fixed title bar), independent of theme.
              #1A1918 stays dark in both modes; var(--charcoal) would invert to a
              light colour in dark mode. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: '#1A1918',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: AI_D.accent,
                  boxShadow: `0 0 8px ${AI_D.accent}`,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#ECEBE8',
                }}
              >
                Customer Journey AI
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
                  borderBottom: i < messages.length - 1 ? `1px solid ${AI_D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? AI_D.text3 : AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'Customer Journey AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? AI_D.text2 : AI_D.text,
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
                    color: AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  Customer Journey AI
                </div>
                <div style={{ fontSize: 12.5, color: AI_D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {AI_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: AI_D.surface,
                    border: `1px solid ${AI_D.border}`,
                    color: AI_D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${AI_D.accent}66`
                    e.currentTarget.style.color = AI_D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = AI_D.border
                    e.currentTarget.style.color = AI_D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${AI_D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${AI_D.border}`,
                background: AI_D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about clients, projects, journey phases..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: AI_D.text,
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
                  background: input.trim() && !thinking ? AI_D.accent : AI_D.surface,
                  color: input.trim() && !thinking ? '#fff' : AI_D.text3,
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

export default function ActiveClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  // Delete-flow state (additive — does not affect existing load/render logic).
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Delete a client and all of its dependent rows. Child tables are removed
  // first, then the clients row last, so foreign-key constraints stay satisfied.
  async function handleConfirmDelete() {
    if (!pendingDelete || deleting) return
    const id = pendingDelete.id
    setDeleting(true)
    const supabase = createClient()
    const childTables = [
      'journey_checklists',
      'workflow_step_completions',
      'journey_step_start',
      'client_agenda_header',
      'client_standing_agenda',
      'client_meetings',
      'client_files',
    ]
    try {
      for (const table of childTables) {
        const { error } = await supabase.from(table).delete().eq('client_id', id)
        if (error) throw error
      }
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error

      // Remove from local state immediately — no page reload.
      setClients(prev => prev.filter(c => c.id !== id))
      setPendingDelete(null)
      setToast('Client deleted successfully')
    } catch (err) {
      // Deletion failed (e.g. permissions/FK). Keep the client and surface it.
      console.error('[customers] delete failed:', err)
      setToast('Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()

        const [{ data: clientRows }, { data: meetingRows }, { data: stepRows }, { data: emailRows }] = await Promise.all([
          supabase.from('clients').select('*').order('name'),
          supabase.from('client_meetings').select('client_id').eq('completed', true),
          supabase.from('workflow_step_completions').select('client_id'),
          supabase.from('client_email_drafts').select('client_id').eq('status', 'sent'),
        ])

        const meetingMap: Record<string, number> = {}
        for (const row of meetingRows ?? []) {
          meetingMap[row.client_id] = (meetingMap[row.client_id] ?? 0) + 1
        }
        for (const row of stepRows ?? []) {
          meetingMap[row.client_id] = (meetingMap[row.client_id] ?? 0) + 1
        }
        const emailMap: Record<string, number> = {}
        for (const row of emailRows ?? []) {
          emailMap[row.client_id] = (emailMap[row.client_id] ?? 0) + 1
        }

        const enriched = (clientRows ?? []).map(c => ({
          ...c,
          meetingsCompleted: meetingMap[c.id] ?? 0,
          emailsSent: emailMap[c.id] ?? 0,
        }))

        setClients(enriched as Client[])
      } catch {
        setClients([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '40px 32px 60px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div>
          <h1
            className="font-serif"
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: 'var(--foreground, #111)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Active Clients
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--muted, #6b7280)',
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            All active CASK Construction client projects
          </p>
        </div>

        <Link
          href="/customers/new"
          className="no-underline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: 'var(--red, #c8311a)',
            padding: '9px 16px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginTop: 4,
          }}
        >
          + New Client
        </Link>
      </div>

      {/* Client list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 76,
                borderRadius: 10,
                background: 'var(--border, #e5e7eb)',
                opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--text3, #a8a29e)',
            fontSize: 14,
          }}
        >
          No active clients yet. Add your first client to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} onRequestDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {/* Floating Customer Journey AI button + chat drawer — bottom-right, this page only */}
      <FloatingCustomerJourneyAI />

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div
          onClick={() => { if (!deleting) setPendingDelete(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 28,
              maxWidth: 420,
              width: '100%',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Delete Client
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
              Are you sure you want to delete{' '}
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{pendingDelete.name}</span>? This
              cannot be undone. All client data including meeting recaps, emails, agenda, and journey
              steps will be permanently deleted.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text2)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success / failure toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'var(--charcoal)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
