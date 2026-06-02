'use client'
// src/components/ai-panel/AIPanel.tsx

import { useState, useRef, useEffect } from 'react'
import mammoth from 'mammoth'
import type { AIMessage } from '@/types'
import { createClient } from '@/lib/supabase'

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  Calin:   ['My open actions', 'Last leadership meeting', 'May 28th agenda', 'Design Center update'],
  Kai:     ["Calin's action items", 'Prep for May 28', 'Last meeting summary', 'Due today'],
  Rovern:  ['All sessions', 'Open action items', 'Generate agenda', 'Latest session'],
  default: ['Last meeting summary', 'Open action items', 'May 28th agenda', 'Design Center update'],
}

function SoundWave() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 12,
        marginLeft: 5,
        verticalAlign: 'middle',
      }}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 2,
            borderRadius: 2,
            background: '#10b981',
            animation: `soundBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes soundBar {
          from { height: 3px; opacity: 0.5; }
          to   { height: 11px; opacity: 1; }
        }
      `}</style>
    </span>
  )
}

// ── Download detection ───────────────────────────────────────────────

type DownloadOption = { label: string; filename: string; content: string; mimeType: string }

function detectDownloads(content: string): DownloadOption[] {
  const opts: DownloadOption[] = []

  const csvMatch = content.match(/```csv\r?\n([\s\S]*?)```/)
  if (csvMatch) {
    opts.push({ label: '⬇ Download CSV', filename: 'cask-export.csv', content: csvMatch[1].trim(), mimeType: 'text/csv' })
  }

  const jsonMatch = content.match(/```json\r?\n([\s\S]*?)```/)
  if (jsonMatch) {
    opts.push({ label: '⬇ Download JSON', filename: 'cask-export.json', content: jsonMatch[1].trim(), mimeType: 'application/json' })
  }

  const textMatch = content.match(/```text\r?\n([\s\S]*?)```/)
  if (textMatch) {
    opts.push({ label: '⬇ Download TXT', filename: 'cask-export.txt', content: textMatch[1].trim(), mimeType: 'text/plain' })
  }

  // Markdown table — at least a header row + separator row + one data row
  const lines = content.split('\n')
  const tableLines = lines.filter(l => /^\|.+\|$/.test(l.trim()))
  if (!csvMatch && tableLines.length >= 3) {
    const csvRows = tableLines
      .filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()))
      .map(l =>
        l.trim().slice(1, -1).split('|').map(cell => {
          const v = cell.trim()
          return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
        }).join(',')
      )
    if (csvRows.length >= 1) {
      opts.push({ label: '⬇ Download Excel', filename: 'cask-export.csv', content: csvRows.join('\n'), mimeType: 'text/csv' })
    }
  }

  return opts
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AIPanel() {
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [userName, setUserName] = useState('there')
  const [userRole, setUserRole] = useState('')
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'assistant', content: 'Good morning. Loading session data...' },
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

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // FIX 1: Keep a ref so speakText always reads the CURRENT voiceEnabled,
  // regardless of which render closure captured it.
  const voiceEnabledRef = useRef(false)
  // Keep email in a ref so saveMessage/clearHistory closures always read the latest value
  const userEmailRef = useRef('')

  // Fetch session count + user name, then set personalised greeting
  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const [{ count }, { count: calCount }, { data: { user } }] = await Promise.all([
        supabase.from('meetings').select('*', { count: 'exact', head: true }),
        supabase.from('calendar_events').select('*', { count: 'exact', head: true }).gte('start_time', new Date().toISOString()),
        supabase.auth.getUser(),
      ])

      let firstName = 'there'
      let email = ''
      if (user?.email) {
        email = user.email
        setUserEmail(email)
        userEmailRef.current = email
        const { data } = await supabase
          .from('users')
          .select('name, role')
          .eq('email', user.email)
          .single()
        if (data?.name) firstName = data.name.split(' ')[0]
        if (data?.role) setUserRole(data.role)
      }

      setSessionCount(count)
      setUserName(firstName)

      // Load persisted chat history for this user + page
      if (email) {
        const { data: history } = await supabase
          .from('chat_history')
          .select('role, content')
          .eq('user_email', email)
          .eq('page_context', window.location.pathname)
          .order('created_at', { ascending: true })
          .limit(20)
        if (history && history.length > 0) {
          setMessages(history as AIMessage[])
          return
        }
      }

      const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
      const timeGreeting = (hour >= 5 && hour < 12) ? 'Good morning' : (hour >= 12 && hour < 17) ? 'Good afternoon' : 'Good evening'
      setMessages([
        {
          role: 'assistant',
          content: `${timeGreeting}, ${firstName}. I have full context on ${count ?? 0} sessions, ${calCount ?? 0} upcoming meetings, and all CASK data — clients, action items, and more. What would you like to know?`,
        },
      ])
    }

    init()
  }, [])

  // Restore voice preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cask-voice-enabled') === 'true'
    if (saved) {
      setVoiceEnabled(true)
      voiceEnabledRef.current = true
    }
  }, [])

  // Persist voice preference + keep ref in sync
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
    localStorage.setItem('cask-voice-enabled', voiceEnabled.toString())
  }, [voiceEnabled])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  function stopSpeech() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsSpeaking(false)
    setSpeakingIndex(null)
  }

  function toggleVoice() {
    const next = !voiceEnabledRef.current
    console.log('Voice toggled to:', next)
    voiceEnabledRef.current = next
    setVoiceEnabled(next)
    if (!next && audioRef.current) stopSpeech()
  }

  function clearFile() {
    setAttachedFile(null)
    setFileError(null)
  }

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: window.location.pathname, role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', window.location.pathname)
    const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours()
    const timeGreeting = (hour >= 5 && hour < 12) ? 'Good morning' : (hour >= 12 && hour < 17) ? 'Good afternoon' : 'Good evening'
    setMessages([{ role: 'assistant', content: `${timeGreeting}, ${userName}. Chat history cleared. What would you like to know?` }])
  }

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
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.')
      setIsProcessingFile(false)
    }

    if (ext === 'txt') {
      reader.onload = () => {
        setAttachedFile({ name: file.name, data: reader.result as string, rawType: 'text', mimeType: 'text/plain' })
        setIsProcessingFile(false)
      }
      reader.readAsText(file)
    } else if (ext === 'docx') {
      reader.onload = async () => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: reader.result as ArrayBuffer })
          setAttachedFile({ name: file.name, data: result.value, rawType: 'text', mimeType: 'text/plain' })
        } catch {
          setFileError('Failed to extract text from Word document. Please try again.')
        }
        setIsProcessingFile(false)
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        const mimeType = ext === 'pdf' ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        setAttachedFile({ name: file.name, data: base64, rawType: ext === 'pdf' ? 'pdf' : 'binary', mimeType })
        setIsProcessingFile(false)
      }
      reader.readAsDataURL(file)
    }
  }

  async function speakText(text: string, msgIndex: number) {
    // FIX 1: Read from ref, not stale closure value
    console.log('speakText called, voiceEnabled:', voiceEnabledRef.current)
    if (!voiceEnabledRef.current) return

    stopSpeech()
    setIsSpeaking(true)
    setSpeakingIndex(msgIndex)

    try {
      console.log('Calling speak API with text length:', text.length)
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      console.log('Speak API response status:', res.status)

      if (!res.ok) throw new Error(`Speak API error: ${res.status}`)

      const blob = await res.blob()
      console.log('Audio blob size:', blob.size, 'bytes')

      if (blob.size === 0) throw new Error('Empty audio blob returned')

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        setSpeakingIndex(null)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }

      // FIX 3: Catch autoplay policy rejection explicitly
      audio.play().catch(e => {
        console.error('audio.play() failed — autoplay policy or format issue:', e)
        setIsSpeaking(false)
        setSpeakingIndex(null)
        URL.revokeObjectURL(url)
        audioRef.current = null
      })
    } catch (err) {
      console.error('speakText error:', err)
      setIsSpeaking(false)
      setSpeakingIndex(null)
    }
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg && !attachedFile) return
    setInput('')

    const fileToSend = attachedFile
    setAttachedFile(null)
    setFileError(null)

    const displayContent = fileToSend
      ? (msg ? `📄 ${fileToSend.name}\n\n${msg}` : `📄 ${fileToSend.name}`)
      : msg

    const userMsg: AIMessage = { role: 'user', content: displayContent }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    saveMessage('user', displayContent)
    setIsThinking(true)

    try {
      console.log('[CASK AI] Sending message to /api/chat', { userName, userRole })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          userName,
          userRole,
          pageContext: window.location.pathname,
          ...(fileToSend ? {
            fileName: fileToSend.name,
            fileData: fileToSend.data,
            fileType: fileToSend.rawType,
            fileMimeType: fileToSend.mimeType,
            userMessage: msg || 'Please analyze this file.',
          } : {}),
        }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '(no body)')
        console.error('[CASK AI] API returned', res.status, errBody)
        throw new Error(`API error ${res.status}: ${errBody}`)
      }

      const data = await res.json()
      console.log('[CASK AI] Response received:', data)
      const aiContent: string = data.content

      const newMessages: AIMessage[] = [...nextMessages, { role: 'assistant', content: aiContent }]
      setMessages(newMessages)
      saveMessage('assistant', aiContent)
      speakText(aiContent, newMessages.length - 1)

    } catch (err) {
      console.error('[CASK AI] sendMessage error:', err)
      const errorMsg = err instanceof Error ? `Error: ${err.message}` : 'Something went wrong. Please try again.'
      const newMessages: AIMessage[] = [...nextMessages, { role: 'assistant', content: errorMsg }]
      setMessages(newMessages)
    } finally {
      setIsThinking(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <aside
      className="flex flex-col overflow-hidden"
      style={{ background: 'var(--white)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-[18px] py-3.5 flex items-center gap-2.5"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, var(--white), var(--bg))',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-semibold tracking-[-0.2px]"
              style={{ color: 'var(--text)' }}
            >
              CASK Intelligence
            </span>
            <span
              className="text-[9px] font-semibold tracking-[0.5px] uppercase px-1.5 py-[2px] rounded-[3px]"
              style={{ color: 'rgba(255,255,255,0.7)', background: 'var(--charcoal)' }}
            >
              CLAUDE AI
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className="w-[7px] h-[7px] rounded-full status-blink"
              style={{ background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.4)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
              {sessionCount !== null ? `${sessionCount} sessions loaded` : 'Loading sessions...'}
            </span>
          </div>
        </div>

        {/* Voice controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {userEmail && (
            <button
              onClick={clearHistory}
              title="Clear chat history for this page"
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
                flexShrink: 0,
              }}
            >
              Clear
            </button>
          )}
          {isSpeaking && (
            <button
              onClick={stopSpeech}
              title="Stop speaking"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: '1px solid #10b981',
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease',
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="8" height="8" rx="1" />
              </svg>
            </button>
          )}

          <button
            onClick={toggleVoice}
            title={voiceEnabled ? 'Voice on — click to mute' : 'Voice off — click to enable'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px 3px 6px',
              borderRadius: 20,
              border: voiceEnabled ? '1px solid #10b981' : '1px solid var(--border)',
              background: voiceEnabled ? 'rgba(16,185,129,0.08)' : 'var(--surface2)',
              color: voiceEnabled ? '#10b981' : 'var(--text3)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: voiceEnabled ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {voiceEnabled ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            <span>{voiceEnabled ? 'Voice' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, i) => {
          const isCurrentlySpeaking = speakingIndex === i
          const downloads = msg.role === 'assistant' ? detectDownloads(msg.content) : []
          return (
            <div
              key={i}
              className={`flex flex-col gap-1.5 max-w-[88%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
            >
              <div
                className="text-[12px] leading-relaxed rounded-lg px-3 py-2.5 w-full"
                style={
                  msg.role === 'user'
                    ? {
                        background: 'var(--glass-msg-user)',
                        backdropFilter: 'var(--card-backdrop)',
                        WebkitBackdropFilter: 'var(--card-backdrop)',
                        color: 'rgba(255,255,255,0.9)',
                        borderRadius: '10px 10px 2px 10px',
                      }
                    : {
                        background: 'var(--glass-msg-assist)',
                        backdropFilter: 'var(--card-backdrop)',
                        WebkitBackdropFilter: 'var(--card-backdrop)',
                        color: 'var(--text2)',
                        border: `1px solid ${isCurrentlySpeaking ? '#10b981' : 'var(--border)'}`,
                        borderLeft: isCurrentlySpeaking ? '3px solid #10b981' : '1px solid var(--border)',
                        borderRadius: '2px 10px 10px 10px',
                        whiteSpace: 'pre-wrap',
                        transition: 'border-color 200ms ease',
                      }
                }
              >
                {msg.content}
                {isCurrentlySpeaking && <SoundWave />}
              </div>

              {downloads.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {downloads.map(opt => (
                    <button
                      key={opt.filename}
                      onClick={() => triggerDownload(opt.content, opt.filename, opt.mimeType)}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all duration-150"
                      style={{
                        background: 'rgba(109,40,217,0.08)',
                        border: '1px solid rgba(109,40,217,0.25)',
                        color: '#7c3aed',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
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
          <div
            className="self-start flex items-center gap-1.5 px-3 py-2.5 rounded-lg"
            style={{
              background: 'var(--glass-msg-assist)',
              backdropFilter: 'var(--card-backdrop)',
              WebkitBackdropFilter: 'var(--card-backdrop)',
              border: '1px solid var(--border)',
              borderRadius: '2px 10px 10px 10px',
            }}
          >
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {(SUGGESTED_QUESTIONS[userName] ?? SUGGESTED_QUESTIONS.default).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-all duration-150 hover:border-[var(--border2)]"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>

        {/* File attachment tag */}
        {(attachedFile || isProcessingFile) && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {isProcessingFile ? (
              <span
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}
              >
                Reading file…
              </span>
            ) : attachedFile && (
              <span
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full max-w-full"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}
              >
                <span className="truncate" style={{ maxWidth: 160 }}>📄 {attachedFile.name}</span>
                <button
                  onClick={clearFile}
                  className="shrink-0 leading-none"
                  style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1 }}
                  title="Remove file"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {/* File error */}
        {fileError && (
          <div
            className="text-[11px] px-2.5 py-1.5 rounded-md mb-1.5 leading-relaxed"
            style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
          >
            {fileError}
          </div>
        )}

        <div
          className="flex items-end gap-1.5 rounded-lg p-1"
          style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
        >
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isThinking || isProcessingFile}
            title="Attach a file (PDF, DOCX, XLSX, TXT — max 10 MB)"
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 mb-0.5"
            style={{
              background: 'transparent',
              color: attachedFile ? 'var(--charcoal)' : 'var(--text3)',
              border: 'none',
              cursor: isThinking || isProcessingFile ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about sessions, actions, agenda..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-[12px] px-2 py-1.5 outline-none leading-relaxed"
            style={{
              color: 'var(--text)',
              fontFamily: 'var(--font-geist), sans-serif',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !attachedFile) || isThinking || isProcessingFile}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 mb-0.5"
            style={{
              background: (input.trim() || attachedFile) && !isThinking && !isProcessingFile ? 'var(--charcoal)' : 'var(--border)',
              color: (input.trim() || attachedFile) && !isThinking && !isProcessingFile ? 'white' : 'var(--text3)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1L11 6L6 11M11 6H1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text3)' }}>
          Powered by Claude · CASK Hub AI
        </p>
      </div>
    </aside>
  )
}
