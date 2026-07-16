'use client'
// src/components/ai-panel/AIPanel.tsx

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import mammoth from 'mammoth'
import type { AIMessage } from '@/types'
import { createClient } from '@/lib/supabase'
import { parseArtifacts, HtmlArtifact, ChartArtifact, CsvArtifact, triggerDownload } from './artifacts'

// ── Channel definitions ──────────────────────────────────────────────

interface Channel {
  key: string
  icon: string
  name: string
  subtitle: string
  placeholder: string
  greeting: (name: string, timeGreeting: string) => string
  buttons: string[]
}

const CHANNELS: Channel[] = [
  {
    key: '/dashboard',
    icon: '📊',
    name: 'Dashboard AI',
    subtitle: 'General AI',
    placeholder: 'Ask about sessions, calendar, action items...',
    greeting: (name, time) => `${time}, ${name}. I have full context on all CASK data. What would you like to know?`,
    buttons: ['Last meeting summary', 'Open action items', "Today's calendar", 'Design Center update'],
  },
  {
    key: '/command-center',
    icon: '🏛️',
    name: 'Command Center AI',
    subtitle: 'Departments & reports',
    placeholder: 'Ask about departments, reports, connections...',
    greeting: (name) => `Hi ${name}! I'm the CASK Operating System assistant. I have context on all 5 departments, their connection status, and the CASK Hub roadmap. What would you like to know?`,
    buttons: ['What needs connecting?', 'Department owners', 'Explain a report', "What's live now?"],
  },
  {
    key: '/command-center/sales',
    icon: '🎯',
    name: 'Sales AI',
    subtitle: 'Pipeline & revenue',
    placeholder: 'Ask about pipeline, forecasts, lead sources...',
    greeting: (name) => `Hi ${name}! I'm the Sales & Marketing assistant. I know the sales reports planned for CASK and what each will reveal once the CRM is connected. What would you like to know?`,
    buttons: ['Explain Pipeline Report', 'What is Win/Loss?', 'Planned reports', 'Why connect a CRM?'],
  },
  {
    key: '/command-center/operations',
    icon: '⚙️',
    name: 'Operations AI',
    subtitle: 'Projects & WIP',
    placeholder: 'Ask about WIP, project profitability, schedules...',
    greeting: (name) => `Hi ${name}! I'm the Operations assistant. I know the operations reports planned for CASK and what each will reveal once BuilderTrend is connected. What would you like to know?`,
    buttons: ['What is the WIP Report?', 'Explain PM Scorecards', 'Planned reports', 'Why connect BuilderTrend?'],
  },
  {
    key: '/command-center/finance',
    icon: '💰',
    name: 'Finance AI',
    subtitle: 'Cash flow & P&L',
    placeholder: 'Ask about cash flow, P&L, AR/AP aging...',
    greeting: (name) => `Hi ${name}! I'm the Finance assistant. I know the finance reports planned for CASK and what each will reveal once QuickBooks is connected. What would you like to know?`,
    buttons: ['Explain Cash Flow Forecast', 'What is AR Aging?', 'Planned reports', 'Why connect QuickBooks?'],
  },
  {
    key: '/command-center/hr',
    icon: '👥',
    name: 'HR AI',
    subtitle: 'Team & compliance',
    placeholder: 'Ask about hiring, training, retention...',
    greeting: (name) => `Hi ${name}! I'm the Human Resources assistant. I know the HR reports planned for CASK and what each will reveal once the HR System is connected. What would you like to know?`,
    buttons: ['Explain Hiring Pipeline', 'What is Retention Metrics?', 'Planned reports', 'Why connect the HR System?'],
  },
  {
    key: '/command-center/executive',
    icon: '🏛️',
    name: 'Executive AI',
    subtitle: 'Company overview',
    placeholder: 'Ask about the company vision, reports, departments...',
    greeting: (name) => `Hi ${name}! I'm the Executive Command Center assistant. 1 of 5 departments is connected so far — I can explain the full company vision and what each report will show as departments come online. What would you like to know?`,
    buttons: ['What is live now?', 'Departments connected', 'Reports coming', 'The full vision'],
  },
  {
    key: '/president/calendar',
    icon: '📅',
    name: 'Calendar AI',
    subtitle: 'Schedule & meetings',
    placeholder: "Ask about today's schedule, upcoming meetings...",
    greeting: (name) => `Hi ${name}! I know Calin's full calendar and upcoming meetings. What would you like to know?`,
    buttons: ["Today's meetings", 'This week', 'Next meeting', 'Free time today'],
  },
  {
    key: '/sessions',
    icon: '💬',
    name: 'Daily Meetings AI',
    subtitle: 'Team meeting summaries',
    placeholder: 'Ask about meeting summaries, decisions, action items...',
    greeting: (name) => `Hi ${name}! I know all recorded sessions, summaries, and action items. What would you like to know?`,
    buttons: ['Latest session', 'Open action items', 'Recent decisions', 'Generate agenda'],
  },
  {
    key: '/design-center',
    icon: '🏢',
    name: 'Design Center AI',
    subtitle: 'DC files & clients',
    placeholder: 'Ask about clients, designers, DC files...',
    greeting: (name) => `Hi ${name}! I'm your Design Center assistant. I know all DC files, referred clients, and designer partnerships. What would you like to know?`,
    buttons: ['Referred clients', "Ana's clients", 'Contact Made', 'Design Center files'],
  },
  {
    key: '/actions',
    icon: '✅',
    name: 'Action Items AI',
    subtitle: 'Tasks & owners',
    placeholder: 'Ask about open tasks, due dates, owners...',
    greeting: (name) => `Hi ${name}! I can help you track and manage action items. What would you like to know?`,
    buttons: ['My open items', 'Due this week', 'Overdue items', 'Completed items'],
  },
  {
    key: '/customers/templates',
    icon: '👥',
    name: 'Customer Journey AI',
    subtitle: 'Templates & phases',
    placeholder: 'Ask about client templates, phases, emails...',
    greeting: (name) => `Hi ${name}! I know all 10 phases of the customer journey. What would you like to know?`,
    buttons: ['Phase 1 steps', 'Pre-construction', 'Construction phases', 'Closeout steps'],
  },
  {
    key: '/president/overview',
    icon: '📋',
    name: 'President AI',
    subtitle: 'Meetings & agendas',
    placeholder: 'Ask about agendas, DISC profiles, PIT goals...',
    greeting: (name) => `Hi ${name}! I know all meeting agendas, DISC profiles, and PIT goals. What would you like to know?`,
    buttons: ['View agendas', 'DISC profiles', 'PIT goals', 'Weekly meetings'],
  },
]

function getChannelByKey(key: string): Channel {
  return CHANNELS.find(c => c.key === key) ?? CHANNELS[0]
}

function getChannelForPath(pathname: string): Channel {
  const sorted = [...CHANNELS].sort((a, b) => b.key.length - a.key.length)
  return sorted.find(c => pathname.startsWith(c.key)) ?? CHANNELS[0]
}

function timeGreeting(): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
  return hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening'
}

// ── Sound wave indicator ─────────────────────────────────────────────

function SoundWave() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12, marginLeft: 5, verticalAlign: 'middle' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ display: 'block', width: 2, borderRadius: 2, background: '#10b981', animation: `soundBar 0.8s ease-in-out ${i * 0.15}s infinite alternate` }} />
      ))}
      <style>{`@keyframes soundBar { from { height: 3px; opacity: 0.5; } to { height: 11px; opacity: 1; } }`}</style>
    </span>
  )
}

// ── Download detection ───────────────────────────────────────────────

type DownloadOption = { label: string; filename: string; content: string; mimeType: string }

function detectDownloads(content: string): DownloadOption[] {
  const opts: DownloadOption[] = []
  // ```csv blocks are rendered as a Data Table artifact (with its own
  // "Download as Excel" button), so they are intentionally not duplicated here.
  const csvMatch = content.match(/```csv\r?\n([\s\S]*?)```/)
  const jsonMatch = content.match(/```json\r?\n([\s\S]*?)```/)
  if (jsonMatch) opts.push({ label: '⬇ Download JSON', filename: 'cask-export.json', content: jsonMatch[1].trim(), mimeType: 'application/json' })
  const textMatch = content.match(/```text\r?\n([\s\S]*?)```/)
  if (textMatch) opts.push({ label: '⬇ Download TXT', filename: 'cask-export.txt', content: textMatch[1].trim(), mimeType: 'text/plain' })
  const lines = content.split('\n')
  const tableLines = lines.filter(l => /^\|.+\|$/.test(l.trim()))
  if (!csvMatch && tableLines.length >= 3) {
    const csvRows = tableLines
      .filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()))
      .map(l => l.trim().slice(1, -1).split('|').map(cell => { const v = cell.trim(); return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v }).join(','))
    if (csvRows.length >= 1) opts.push({ label: '⬇ Download Excel', filename: 'cask-export.csv', content: csvRows.join('\n'), mimeType: 'text/csv' })
  }
  return opts
}

// Artifact detection + rendering (parseArtifacts, HtmlArtifact, ChartArtifact,
// CsvArtifact, triggerDownload) live in ./artifacts — shared with the floating
// chat drawers. detectDownloads above remains AIPanel-specific.

// ── Main component ───────────────────────────────────────────────────

export default function AIPanel() {
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [userName, setUserName] = useState('there')
  const [userRole, setUserRole] = useState('')
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'assistant', content: 'Loading...' },
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [attachedFile, setAttachedFile] = useState<{ name: string; data: string; rawType: 'text' | 'pdf' | 'binary'; mimeType: string } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const pathname = usePathname()
  const [activeChannelKey, setActiveChannelKey] = useState(() => getChannelForPath(pathname).key)

  const activeChannelKeyRef = useRef(getChannelForPath(pathname).key)
  const hasInitializedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const voiceEnabledRef = useRef(false)
  const userEmailRef = useRef('')

  const activeChannel = getChannelByKey(activeChannelKey)

  // ── Initialise: fetch user, session count, load channel history ──

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const [{ count }, { data: { user } }] = await Promise.all([
        supabase.from('meetings').select('*', { count: 'exact', head: true }),
        supabase.auth.getUser(),
      ])

      let firstName = 'there'
      let email = ''
      if (user?.email) {
        email = user.email
        setUserEmail(email)
        userEmailRef.current = email
        const { data } = await supabase.from('users').select('name, role').eq('email', user.email).single()
        if (data?.name) firstName = data.name.split(' ')[0]
        if (data?.role) setUserRole(data.role)
      }

      setSessionCount(count)
      setUserName(firstName)

      if (email) {
        const { data: history } = await supabase
          .from('chat_history')
          .select('role, content')
          .eq('user_email', email)
          .eq('page_context', activeChannelKeyRef.current)
          .order('created_at', { ascending: true })
          .limit(20)
        if (history && history.length > 0) {
          setMessages(history as AIMessage[])
          hasInitializedRef.current = true
          return
        }
      }

      const tg = timeGreeting()
      const ch = getChannelByKey(activeChannelKeyRef.current)
      setMessages([{ role: 'assistant', content: ch.greeting(firstName, tg) }])
      hasInitializedRef.current = true
    }

    init()
  }, [])

  // ── Voice preference ─────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('cask-voice-enabled') === 'true'
    if (saved) { setVoiceEnabled(true); voiceEnabledRef.current = true }
  }, [])

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
    localStorage.setItem('cask-voice-enabled', voiceEnabled.toString())
  }, [voiceEnabled])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // ── Helpers ──────────────────────────────────────────────────────

  function stopSpeech() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setIsSpeaking(false); setSpeakingIndex(null)
  }

  function toggleVoice() {
    const next = !voiceEnabledRef.current
    voiceEnabledRef.current = next
    setVoiceEnabled(next)
    if (!next && audioRef.current) stopSpeech()
  }

  function clearFile() { setAttachedFile(null); setFileError(null) }

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: activeChannelKeyRef.current, role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', activeChannelKeyRef.current)
    const tg = timeGreeting()
    setMessages([{ role: 'assistant', content: `${tg}, ${userName}. Chat history cleared. What would you like to know?` }])
  }

  // ── Channel switching ─────────────────────────────────────────────

  async function switchChannel(key: string) {
    if (key === activeChannelKeyRef.current) return
    setActiveChannelKey(key)
    activeChannelKeyRef.current = key
    setInput('')
    setAttachedFile(null)
    setFileError(null)
    stopSpeech()

    if (userEmailRef.current) {
      const supabase = createClient()
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', userEmailRef.current)
        .eq('page_context', key)
        .order('created_at', { ascending: true })
        .limit(20)
      if (history && history.length > 0) {
        setMessages(history as AIMessage[])
        return
      }
    }

    const ch = getChannelByKey(key)
    const tg = timeGreeting()
    setMessages([{ role: 'assistant', content: ch.greeting(userName || 'there', tg) }])
  }

  // ── File handling ─────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setFileError(null)
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'docx', 'xlsx', 'txt'].includes(ext)) {
      setFileError('Unsupported file type. Attach a PDF, Word (.docx), Excel (.xlsx), or .txt file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`)
      return
    }
    setIsProcessingFile(true)
    const reader = new FileReader()
    reader.onerror = () => { setFileError('Failed to read file. Please try again.'); setIsProcessingFile(false) }
    if (ext === 'txt') {
      reader.onload = () => { setAttachedFile({ name: file.name, data: reader.result as string, rawType: 'text', mimeType: 'text/plain' }); setIsProcessingFile(false) }
      reader.readAsText(file)
    } else if (ext === 'docx') {
      reader.onload = async () => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: reader.result as ArrayBuffer })
          setAttachedFile({ name: file.name, data: result.value, rawType: 'text', mimeType: 'text/plain' })
        } catch { setFileError('Failed to extract text from Word document. Please try again.') }
        setIsProcessingFile(false)
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const mimeType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        setAttachedFile({ name: file.name, data: base64, rawType: ext === 'pdf' ? 'pdf' : 'binary', mimeType })
        setIsProcessingFile(false)
      }
      reader.readAsDataURL(file)
    }
  }

  // ── Voice playback ────────────────────────────────────────────────

  async function speakText(text: string, msgIndex: number) {
    if (!voiceEnabledRef.current) return
    stopSpeech()
    setIsSpeaking(true); setSpeakingIndex(msgIndex)
    try {
      const res = await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (!res.ok) throw new Error(`Speak API error: ${res.status}`)
      const blob = await res.blob()
      if (blob.size === 0) throw new Error('Empty audio blob returned')
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setIsSpeaking(false); setSpeakingIndex(null); URL.revokeObjectURL(url); audioRef.current = null }
      audio.play().catch(e => { console.error('audio.play() failed:', e); setIsSpeaking(false); setSpeakingIndex(null); URL.revokeObjectURL(url); audioRef.current = null })
    } catch (err) { console.error('speakText error:', err); setIsSpeaking(false); setSpeakingIndex(null) }
  }

  // ── Send message ──────────────────────────────────────────────────

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg && !attachedFile) return
    setInput('')
    const fileToSend = attachedFile
    setAttachedFile(null); setFileError(null)
    const displayContent = fileToSend ? (msg ? `📄 ${fileToSend.name}\n\n${msg}` : `📄 ${fileToSend.name}`) : msg
    const userMsg: AIMessage = { role: 'user', content: displayContent }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    saveMessage('user', displayContent)
    setIsThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          userName, userRole,
          pageContext: activeChannelKeyRef.current,
          ...(fileToSend ? { fileName: fileToSend.name, fileData: fileToSend.data, fileType: fileToSend.rawType, fileMimeType: fileToSend.mimeType, userMessage: msg || 'Please analyze this file.' } : {}),
        }),
      })
      if (!res.ok) { const errBody = await res.text().catch(() => '(no body)'); throw new Error(`API error ${res.status}: ${errBody}`) }
      const data = await res.json()
      const aiContent: string = data.content
      const newMessages: AIMessage[] = [...nextMessages, { role: 'assistant', content: aiContent }]
      setMessages(newMessages)
      saveMessage('assistant', aiContent)
      speakText(aiContent, newMessages.length - 1)
    } catch (err) {
      const errorMsg = err instanceof Error ? `Error: ${err.message}` : 'Something went wrong. Please try again.'
      setMessages([...nextMessages, { role: 'assistant', content: errorMsg }])
    } finally { setIsThinking(false) }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <aside style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>

      {/* ── Channel list (left) ── */}
      <div style={{
        width: 160, minWidth: 160, flexShrink: 0,
        background: 'var(--surface2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--font-geist), sans-serif' }}>
            AI Channels
          </div>
        </div>

        {/* Channel items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 7px' }}>
          {CHANNELS.map(ch => {
            const isActive = activeChannelKey === ch.key
            return (
              <button
                key={ch.key}
                onClick={() => switchChannel(ch.key)}
                style={{
                  width: '100%', display: 'block',
                  padding: '10px 10px 10px',
                  borderRadius: 8,
                  border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  background: isActive ? 'var(--surface)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 120ms ease',
                  marginBottom: 2,
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  borderLeft: isActive ? '3px solid var(--red)' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{ch.icon}</span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--text)' : 'var(--text2)',
                    lineHeight: 1.2,
                    fontFamily: 'var(--font-geist), sans-serif',
                    wordBreak: 'break-word',
                  }}>
                    {ch.name}
                  </span>
                </div>
                <div style={{
                  fontSize: 9.5, paddingLeft: 23,
                  color: 'var(--text3)',
                  fontFamily: 'var(--font-geist), sans-serif',
                  lineHeight: 1.3,
                }}>
                  {ch.subtitle}
                </div>
              </button>
            )
          })}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-geist), sans-serif', lineHeight: 1.5 }}>
            Powered by<br />Claude AI
          </div>
        </div>
      </div>

      {/* ── Chat area (right) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--white)' }}>

        {/* Chat header — intentionally ALWAYS dark (fixed "title bar"), regardless
            of the app theme. #1A1918 is the Hub's warm-charcoal dark surface; the
            header text/buttons below are hardcoded light-on-dark to match. The panel
            body + content below this header still follow the theme. */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          background: '#1A1918',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ECEBE8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontFamily: 'var(--font-geist), sans-serif' }}>
                {activeChannel.name}
              </span>
              <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 3, flexShrink: 0, fontFamily: 'var(--font-geist), sans-serif' }}>
                Active
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <div className="status-blink" style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px rgba(16,185,129,0.4)', flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-geist), sans-serif' }}>
                {sessionCount !== null ? `${sessionCount} sessions loaded` : 'Loading...'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {userEmail && (
              <button
                onClick={clearHistory}
                title="Clear chat history for this channel"
                style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}
              >
                Clear
              </button>
            )}
            {isSpeaking && (
              <button
                onClick={stopSpeech}
                title="Stop speaking"
                style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #10b981', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8" rx="1" /></svg>
              </button>
            )}
            <button
              onClick={toggleVoice}
              title={voiceEnabled ? 'Voice on — click to mute' : 'Voice off — click to enable'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px 2px 5px', borderRadius: 20, border: voiceEnabled ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)', background: voiceEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.1)', color: voiceEnabled ? '#10b981' : 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: voiceEnabled ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none', fontFamily: 'inherit' }}
            >
              {voiceEnabled ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span>{voiceEnabled ? 'Voice' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => {
            const isCurrentlySpeaking = speakingIndex === i
            const downloads = msg.role === 'assistant' ? detectDownloads(msg.content) : []
            const parts = msg.role === 'assistant' ? parseArtifacts(msg.content) : null
            const hasArtifact = !!parts && parts.some(p => p.kind !== 'text')

            const userStyle: React.CSSProperties = {
              fontSize: 12, lineHeight: 1.55, padding: '8px 10px',
              background: 'var(--glass-msg-user)',
              backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
              color: 'rgba(255,255,255,0.9)',
              borderRadius: '10px 10px 2px 10px',
              fontFamily: 'var(--font-geist), sans-serif',
            }
            const assistantStyle: React.CSSProperties = {
              fontSize: 12, lineHeight: 1.55, padding: '8px 10px',
              background: 'var(--glass-msg-assist)',
              backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
              color: 'var(--text2)',
              border: `1px solid ${isCurrentlySpeaking ? '#10b981' : 'var(--border)'}`,
              borderLeft: isCurrentlySpeaking ? '3px solid #10b981' : '1px solid var(--border)',
              borderRadius: '2px 10px 10px 10px',
              whiteSpace: 'pre-wrap',
              transition: 'border-color 200ms ease',
              fontFamily: 'var(--font-geist), sans-serif',
            }

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: hasArtifact ? '100%' : '92%', width: hasArtifact ? '100%' : undefined, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {!hasArtifact ? (
                  <div style={msg.role === 'user' ? userStyle : assistantStyle}>
                    {msg.content}
                    {isCurrentlySpeaking && <SoundWave />}
                  </div>
                ) : (
                  parts!.map((part, idx) => {
                    if (part.kind === 'text') return <div key={idx} style={assistantStyle}>{part.text}</div>
                    if (part.kind === 'html') return <HtmlArtifact key={idx} code={part.code} />
                    if (part.kind === 'chart') return <ChartArtifact key={idx} code={part.code} />
                    return <CsvArtifact key={idx} code={part.code} />
                  })
                )}
                {downloads.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {downloads.map(opt => (
                      <button
                        key={opt.filename}
                        onClick={() => triggerDownload(opt.content, opt.filename, opt.mimeType)}
                        style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.25)', color: '#7c3aed', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {isThinking && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', background: 'var(--glass-msg-assist)', backdropFilter: 'var(--card-backdrop)', border: '1px solid var(--border)', borderRadius: '2px 10px 10px 10px' }}>
              <div className="thinking-dot" /><div className="thinking-dot" /><div className="thinking-dot" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick action buttons */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {activeChannel.buttons.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                style={{ fontSize: 10, fontWeight: 500, padding: '5px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font-geist), sans-serif', transition: 'border-color 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>

          {/* File attachment */}
          {(attachedFile || isProcessingFile) && (
            <div style={{ marginBottom: 6 }}>
              {isProcessingFile ? (
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
                  Reading file…
                </span>
              ) : attachedFile && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', maxWidth: '100%' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>📄 {attachedFile.name}</span>
                  <button onClick={clearFile} style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Remove file">×</button>
                </span>
              )}
            </div>
          )}

          {/* File error */}
          {fileError && (
            <div style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, marginBottom: 6, lineHeight: 1.4, background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
              {fileError}
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, borderRadius: 8, padding: 4, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking || isProcessingFile}
              title="Attach a file (PDF, DOCX, XLSX, TXT — max 10 MB)"
              style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: attachedFile ? 'var(--charcoal)' : 'var(--text3)', border: 'none', cursor: isThinking || isProcessingFile ? 'not-allowed' : 'pointer', marginBottom: 1 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={activeChannel.placeholder}
              rows={1}
              style={{ flex: 1, resize: 'none', background: 'transparent', fontSize: 11, padding: '4px 4px', outline: 'none', lineHeight: 1.5, color: 'var(--text)', fontFamily: 'var(--font-geist), sans-serif', maxHeight: 72, overflowY: 'auto', border: 'none' }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !attachedFile) || isThinking || isProcessingFile}
              style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (input.trim() || attachedFile) && !isThinking && !isProcessingFile ? 'var(--charcoal)' : 'var(--border)', color: (input.trim() || attachedFile) && !isThinking && !isProcessingFile ? 'white' : 'var(--text3)', border: 'none', cursor: (!input.trim() && !attachedFile) || isThinking || isProcessingFile ? 'not-allowed' : 'pointer', marginBottom: 1, transition: 'background 150ms ease' }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1L11 6L6 11M11 6H1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.txt" style={{ display: 'none' }} onChange={handleFileSelect} />

          <p style={{ fontSize: 9, textAlign: 'center', marginTop: 5, color: 'var(--text3)', fontFamily: 'var(--font-geist), sans-serif' }}>
            Powered by Claude · CASK Hub AI
          </p>
        </div>
      </div>
    </aside>
  )
}
