'use client'
// src/app/(app)/customers/[id]/page.tsx

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

type Happiness = 'green' | 'yellow' | 'red'
type PriorityStatus = 'done' | 'in_progress' | 'unresolved'

interface Priority {
  text: string
  status: PriorityStatus
}

interface MeetingItem {
  id?: string
  number: number
  title: string
  completed: boolean
}

interface ClientData {
  id: string
  name: string
  initials: string
  project_type: string
  project_value: number
  location: string
  start_date: string
  happiness: Happiness
  meetings_completed: number
  total_meetings: number
  owner: string
  personality_tags: string[]
  communication_style: string
  key_interests: string
  ai_tip: string
  priorities: Priority[]
  meetings: MeetingItem[]
}


// ── Config ────────────────────────────────────────────────────────────────────

const HAPPINESS = {
  green: { bg: '#F0FDF4', color: '#166534', label: 'Happy', accent: '#16a34a' },
  yellow: { bg: '#FFFBEB', color: '#92400E', label: 'At Risk', accent: '#d97706' },
  red: { bg: '#FDF2F0', color: '#9B1C0E', label: 'Needs Attention', accent: '#dc2626' },
}

const PRIORITY_CONFIG: Record<PriorityStatus, { dot: string; color: string; strike: boolean }> = {
  done: { dot: '#16a34a', color: '#16a34a', strike: true },
  in_progress: { dot: '#d97706', color: '#d97706', strike: false },
  unresolved: { dot: '#dc2626', color: '#dc2626', strike: false },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return '$' + v.toLocaleString('en-US')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/customers"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px] no-underline transition-colors duration-150 hover:text-[var(--text)]"
      style={{ color: 'var(--text3)' }}
    >
      ← Active Clients
    </Link>
  )
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ fontSize: 14, opacity: 0.6 }}>{icon}</span>
      <span
        className="text-[11px] font-semibold tracking-[1.2px] uppercase"
        style={{ color: 'var(--text3)' }}
      >
        {children}
      </span>
    </div>
  )
}

function IntelligencePanel({ client, messages, onSend }: {
  client: ClientData
  messages: { role: 'user' | 'assistant'; content: string }[]
  onSend: (msg: string) => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    await onSend(text)
    setSending(false)
  }

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--charcoal)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-[7px] h-[7px] rounded-full"
            style={{ background: 'var(--red, #c8311a)', boxShadow: '0 0 6px rgba(200,49,26,0.6)' }}
          />
          <span
            className="text-[12px] font-semibold tracking-[0.8px] uppercase"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            CASK Intelligence — {client.name} context
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="px-5 py-4 flex flex-col gap-3" style={{ minHeight: 120 }}>
        {/* Initial AI tip as assistant bubble */}
        <div className="flex justify-start">
          <div
            className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: '2px 10px 10px 10px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {client.ai_tip}
          </div>
        </div>

        {/* Conversation messages */}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div
                className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%]"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.9)',
                  borderRadius: '10px 10px 2px 10px',
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div
                className="text-[12px] leading-relaxed px-3.5 py-2.5 max-w-[88%]"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.8)',
                  borderRadius: '2px 10px 10px 10px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {m.content}
              </div>
            </div>
          )
        )}

        {sending && (
          <div className="flex justify-start">
            <div
              className="text-[11px] px-3.5 py-2.5"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
                borderRadius: '2px 10px 10px 10px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-5 pb-4"
      >
        <div
          className="flex items-center gap-2 rounded-[8px] px-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Ask about ${client.name}…`}
            disabled={sending}
            tabIndex={-1}
            className="flex-1 bg-transparent border-none outline-none py-2.5 text-[12px]"
            style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
            style={{
              background: 'var(--red, #c8311a)',
              color: '#fff',
              opacity: !input.trim() || sending ? 0.4 : 1,
              border: 'none',
              cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [client, setClient] = useState<ClientData | null | 'loading'>('loading')
  const [localMeetings, setLocalMeetings] = useState<MeetingItem[]>([])
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    const parent = document.querySelector('main')
    if (parent) parent.scrollTop = 0
    const scrollContainers = document.querySelectorAll('.overflow-y-auto')
    scrollContainers.forEach(el => { (el as HTMLElement).scrollTop = 0 })
  }, [])

  useEffect(() => {
    async function fetchClient() {
      const supabase = createClient()

      const { data: row, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !row) {
        setClient(null)
        return
      }

      const [{ data: priorityRows }, { data: meetingRows }] = await Promise.all([
        supabase.from('client_priorities').select('*').eq('client_id', params.id),
        supabase.from('client_meetings').select('*').eq('client_id', params.id).order('number', { ascending: true }),
      ])

      const priorities: Priority[] = (priorityRows ?? []).map((p: Record<string, string>) => ({
        text: p.text,
        status: (p.status as PriorityStatus) ?? 'unresolved',
      }))

      const meetings: MeetingItem[] = (meetingRows ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        number: (m.number as number) ?? 0,
        title: m.title as string,
        completed: Boolean(m.completed),
      }))

      const completedCount = meetings.filter(m => m.completed).length

      const happiness: Happiness =
        row.happiness === 'yellow' || row.happiness === 'red' ? row.happiness : 'green'

      setClient({
        id: row.id,
        name: row.name,
        initials: getInitials(row.name),
        project_type: row.project_type ?? '',
        project_value: row.project_value ?? 0,
        location: row.location ?? '',
        start_date: row.start_date ?? '',
        happiness,
        meetings_completed: completedCount,
        total_meetings: row.total_meetings ?? 40,
        owner: row.owner ?? '',
        personality_tags: Array.isArray(row.personality_tags) ? row.personality_tags : [],
        communication_style: row.communication_style ?? 'No communication style added yet.',
        key_interests: row.key_interests ?? 'No interests added yet.',
        ai_tip: row.ai_tip ?? 'Add personality details to get AI communication tips.',
        priorities,
        meetings,
      })
    }

    fetchClient()
  }, [params.id])

  // Sync localMeetings when client data loads
  useEffect(() => {
    if (client && client !== 'loading') {
      setLocalMeetings(client.meetings)
    }
  }, [client])

  async function toggleMeeting(index: number) {
    const meeting = localMeetings[index]
    const updated = localMeetings.map((m, i) =>
      i === index ? { ...m, completed: !m.completed } : m
    )
    setLocalMeetings(updated)

    const supabase = createClient()
    if (meeting.id) {
      await supabase
        .from('client_meetings')
        .update({ completed: !meeting.completed })
        .eq('id', meeting.id)
    }

    const completedCount = updated.filter(m => m.completed).length
    await supabase
      .from('clients')
      .update({ meetings_completed: completedCount })
      .eq('id', params.id)
  }

  async function handleChatSend(userMsg: string) {
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMsg }]
    setChatMessages(newMessages)

    try {
      const clientSystemMsg = client && client !== 'loading'
        ? {
            role: 'system' as const,
            content: `You are CASK Hub AI helping the CASK Construction sales team.
You have full context on this client:

CLIENT PROFILE:
Name: ${client.name}
Project: ${client.project_type}
Value: $${client.project_value}
Location: ${client.location}
Happiness: ${client.happiness}
Owner: ${client.owner}

PERSONALITY:
Tags: ${client.personality_tags?.join(', ') || 'None added'}
Communication style: ${client.communication_style}
Key interests: ${client.key_interests}

KEY PRIORITIES:
${client.priorities.map(p => `- ${p.text}: ${p.status}`).join('\n') || 'None added'}

MEETING PROGRESS:
${client.meetings.map(m => `- Meeting ${m.number}: ${m.title} — ${m.completed ? 'DONE' : 'PENDING'}`).join('\n') || 'No meetings yet'}

Use this information to give specific, actionable advice about how to work with ${client.name.split(' ')[0]}. Always refer to the client by their first name. Be concise and practical.`,
          }
        : null

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...(clientSystemMsg ? [clientSystemMsg] : []),
            ...newMessages,
          ],
        }),
      })

      if (!res.ok) throw new Error('Chat failed')

      const data = await res.json()
      const reply =
        typeof data === 'string'
          ? data
          : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? 'No response.'

      setChatMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Unable to get a response right now. Please try again.' }])
    }
  }

  if (client === 'loading') {
    return (
      <>
        <TopBar title="Loading…" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <div className="rounded-[10px] h-[148px] shimmer mb-3.5" style={{ border: '1px solid var(--border)' }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg h-[200px] shimmer" style={{ border: '1px solid var(--border)' }} />
            <div className="rounded-lg h-[200px] shimmer" style={{ border: '1px solid var(--border)' }} />
          </div>
        </div>
      </>
    )
  }

  if (!client) {
    return (
      <>
        <TopBar title="Client Not Found" subtitle="Customer Journey" />
        <div className="flex-1 overflow-y-auto p-7">
          <BackLink />
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Client not found.</p>
        </div>
      </>
    )
  }

  const happiness = HAPPINESS[client.happiness]
  const pct = Math.round((client.meetings_completed / client.total_meetings) * 100)

  return (
    <>
      <TopBar title={client.name} subtitle="Customer Journey" />

      <div ref={containerRef} className="flex-1 overflow-y-auto p-7 animate-page-in" style={{ scrollbarGutter: 'stable' }}>
        <BackLink />

        {/* ── Hero Card ─────────────────────────────────────────────────── */}
        <div
          className="rounded-[10px] p-7 mb-3.5 relative overflow-hidden"
          style={{ background: 'var(--charcoal)' }}
        >
          {/* Decorative gradient */}
          <div
            className="absolute bottom-0 right-0 w-[260px] h-[260px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 80% 80%, rgba(255,255,255,0.03) 0%, transparent 60%)',
            }}
          />

          {/* Project value — top right */}
          <div
            className="absolute top-7 right-7 text-right"
          >
            <div
              className="text-[11px] font-medium tracking-[0.8px] uppercase mb-0.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Project Value
            </div>
            <div
              className="text-[22px] font-semibold tracking-[-0.5px]"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              {formatCurrency(client.project_value)}
            </div>
          </div>

          {/* Avatar + Name */}
          <div className="flex items-center gap-5 mb-5">
            <div
              className="flex items-center justify-center rounded-full text-white font-bold tracking-[0.5px] shrink-0"
              style={{
                width: 64,
                height: 64,
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.12)',
                fontSize: 20,
              }}
            >
              {client.initials}
            </div>
            <div>
              <div
                className="text-[9px] font-medium tracking-[1.8px] uppercase mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Customer Journey · CASK Construction
              </div>
              <h1
                className="font-serif text-[26px] text-white leading-[1.15] tracking-[-0.3px]"
                style={{ margin: 0 }}
              >
                {client.name}
              </h1>
            </div>
          </div>

          {/* Pills row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Project type */}
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {client.project_type}
            </span>
            {/* Location */}
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              📍 {client.location}
            </span>
            {/* Start date */}
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Started {client.start_date}
            </span>
            {/* Owner */}
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-full"
              style={{
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Owner: {client.owner}
            </span>
            {/* Happiness */}
            <span
              className="text-[11px] font-semibold px-3 py-1 rounded-full"
              style={{ background: happiness.bg, color: happiness.color }}
            >
              {happiness.label}
            </span>
          </div>
        </div>

        {/* ── Two-column grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-3">

          {/* Card 1 — Personality & Communication */}
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <SectionLabel icon="👤">Personality & Communication</SectionLabel>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {client.personality_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'var(--surface2, #f5f5f5)',
                    color: 'var(--text2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Communication style */}
            <div className="mb-3">
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1"
                style={{ color: 'var(--text3)' }}
              >
                Communication Style
              </div>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.communication_style}
              </p>
            </div>

            {/* Key interests */}
            <div className="mb-4">
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1"
                style={{ color: 'var(--text3)' }}
              >
                Key Interests
              </div>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.key_interests}
              </p>
            </div>

            {/* AI Tip */}
            <div
              className="rounded-[8px] p-3.5"
              style={{
                background: 'var(--red-soft, #fdf2f0)',
                borderLeft: '3px solid var(--red, #c8311a)',
              }}
            >
              <div
                className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-1.5"
                style={{ color: 'var(--red, #c8311a)', opacity: 0.8 }}
              >
                How to communicate with {client.name.split(' ')[0]}
              </div>
              <p
                className="text-[12px] leading-relaxed m-0"
                style={{ color: 'var(--text2)' }}
              >
                {client.ai_tip}
              </p>
            </div>
          </div>

          {/* Card 2 — Key Priorities */}
          <div
            className="rounded-lg p-5"
            style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
          >
            <SectionLabel icon="🚩">Key Priorities</SectionLabel>

            <div className="flex flex-col gap-2.5">
              {client.priorities.map((p, i) => {
                const cfg = PRIORITY_CONFIG[p.status]
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    {/* Dot */}
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 8, height: 8, background: cfg.dot }}
                    />
                    {/* Text */}
                    <span
                      className="text-[13px] font-medium"
                      style={{
                        color: cfg.color,
                        textDecoration: cfg.strike ? 'line-through' : 'none',
                        opacity: cfg.strike ? 0.65 : 1,
                      }}
                    >
                      {p.text}
                    </span>
                    {/* Status label */}
                    <span
                      className="ml-auto text-[10px] font-semibold tracking-[0.4px] shrink-0"
                      style={{ color: cfg.color, opacity: 0.7 }}
                    >
                      {p.status === 'done' ? 'Done' : p.status === 'in_progress' ? 'In Progress' : 'Unresolved'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Meeting Journey ───────────────────────────────────────────── */}
        <div
          className="rounded-lg p-5 mb-3"
          style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
        >
          <SectionLabel icon="📋">Meeting Journey</SectionLabel>

          {/* Progress summary + bar */}
          {(() => {
            const completedCount = localMeetings.filter(m => m.completed).length
            const livePct = client.total_meetings > 0
              ? Math.round((completedCount / client.total_meetings) * 100)
              : 0
            return (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                    {completedCount} of {client.total_meetings} meetings completed
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: happiness.accent }}>
                    {livePct}%
                  </span>
                </div>
                <div
                  className="h-[5px] rounded-full overflow-hidden"
                  style={{ background: 'var(--border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${livePct}%`,
                      background: happiness.accent,
                      transition: 'width 400ms ease',
                    }}
                  />
                </div>
              </div>
            )
          })()}

          {/* Meeting list */}
          <div className="flex flex-col gap-0">
            {localMeetings.map((m, i) => (
              <div
                key={m.number}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Number */}
                <div
                  className="text-[11px] font-semibold w-6 text-center shrink-0"
                  style={{ color: 'var(--text3)' }}
                >
                  {m.number}
                </div>

                {/* Title */}
                <span
                  className="flex-1 text-[13px]"
                  style={{
                    color: m.completed ? 'var(--text3)' : 'var(--text)',
                    textDecoration: m.completed ? 'line-through' : 'none',
                    fontWeight: m.completed ? 400 : 500,
                    transition: 'color 150ms ease',
                  }}
                >
                  {m.title}
                </span>

                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleMeeting(i)}
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: m.completed ? '#F0FDF4' : 'var(--surface2, #f5f5f5)',
                    border: `1.5px solid ${m.completed ? '#16a34a' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'background 150ms ease, border-color 150ms ease, transform 150ms ease',
                    transform: 'scale(1)',
                    padding: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.15)' }}
                >
                  {m.completed && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── CASK Intelligence ─────────────────────────────────────────── */}
        <IntelligencePanel
          client={client}
          messages={chatMessages}
          onSend={handleChatSend}
        />
      </div>
    </>
  )
}
