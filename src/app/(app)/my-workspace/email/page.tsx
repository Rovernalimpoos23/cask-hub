'use client'

// My Emails — the signed-in user's own Outlook mailbox, powered by Microsoft
// Graph via the /api/email/* routes (inbox / [id] / [id]/read / [id]/reply).
// Distinct from the client-email-drafts flow; this page is scoped to whoever is
// logged in and their connected Microsoft account.
//
// ── Implementation notes (why this deviates from the brief in a few spots) ──
// 1. ICONS: the brief asks for Tabler `ti-*` classes, but this project does NOT
//    load the Tabler icon font (no @tabler dependency, no webfont <link>, and the
//    customers page explicitly avoids `ti` classes). To stay self-contained and
//    match the rest of the codebase (the calendar page uses inline SVGs), each
//    requested `ti-*` glyph is implemented as a small inline SVG below. This
//    keeps the page working with zero new dependencies and is theme-safe via
//    `currentColor`.
// 2. AI BAR: the brief asks the client to POST directly to the Anthropic
//    /v1/messages API. Doing that from the browser would expose ANTHROPIC_API_KEY
//    and is CORS-blocked; it also violates the project rule "All Claude API calls
//    go through /api/ routes, never from the client." Since the safety rules for
//    this task allow creating ONLY this page (no new API routes), the AI actions
//    are routed through the EXISTING server-side /api/chat endpoint, which keeps
//    the key server-side. The spec's system-prompt intent + email content are
//    passed in the user message. TODO(next PR): add a dedicated
//    /api/email/ai route using claude-opus-4-8 with the exact system prompts.
// 3. AI PILL COLORS: the brief references var(--bg-pro)/var(--text-pro), which are
//    not defined in globals.css (not in the allowed theme set). The pills use the
//    allowed --surface2/--text2/--border instead.
// 4. FLAG button: the /api/email/[id]/read route only accepts { isRead }; it has
//    no flag support, and the safety rules forbid modifying existing routes. Flag
//    therefore shows a "Coming soon" toast (see handleFlag). Same for Forward and
//    Archive (not functional yet), and Compose Send (route not built yet).
//
// Theming: uses ONLY the existing CSS variables via Tailwind arbitrary-value
// classes so the app's .dark theme overrides apply automatically. No inline
// styles.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'

const ET = 'America/New_York'

// ── Graph message shapes ─────────────────────────────────────────────
interface EmailAddress {
  name?: string
  address?: string
}
interface Recipient {
  emailAddress?: EmailAddress
}
interface MessageFlag {
  flagStatus?: string
}
interface MessageBody {
  contentType?: string
  content?: string
}
interface Attachment {
  id?: string
  name?: string
  size?: number
  contentType?: string
}
interface EmailMessage {
  id: string
  subject?: string
  from?: Recipient
  toRecipients?: Recipient[]
  ccRecipients?: Recipient[]
  receivedDateTime?: string
  bodyPreview?: string
  body?: MessageBody
  isRead?: boolean
  hasAttachments?: boolean
  flag?: MessageFlag
  importance?: string
  attachments?: Attachment[]
  inlineAttachments?: Array<{
    contentId: string
    contentType: string
    contentBytes: string
    name: string
  }>
}
interface InboxResponse {
  messages?: EmailMessage[]
  totalCount?: number
  hasMore?: boolean
  error?: string
}

type FolderKey = 'inbox' | 'sent' | 'flagged' | 'drafts' | 'archive' | 'trash'
type AiKind = 'summarize' | 'draft' | 'extract'

// ── Inline SVG icons (stand in for the requested Tabler ti-* glyphs) ──
type IconProps = { size?: number; className?: string }
const svgBase = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
})

function InboxIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M4 13h4l1.5 3h5L16 13h4" />
      <path d="M4 13V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" />
      <path d="M4 13v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}
function SendIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M10 14l11-11" />
      <path d="M21 3 14.5 21 10 14 3 9.5 21 3z" />
    </svg>
  )
}
function FlagIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M5 21V4a1 1 0 0 1 1-1h12l-2 4 2 4H6" />
    </svg>
  )
}
function FileTextIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}
function ArchiveIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </svg>
  )
}
function TrashIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  )
}
function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function MailIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}
function ReplyIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v3" />
    </svg>
  )
}
function ForwardIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0-5 5v3" />
    </svg>
  )
}
function SparklesIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
    </svg>
  )
}
function PencilIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  )
}
function ListCheckIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M11 6h9M11 12h9M11 18h9" />
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
    </svg>
  )
}
function PaperclipIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M21 8.5 12.5 17a4 4 0 0 1-5.7-5.7l8-8a2.6 2.6 0 0 1 3.7 3.7l-8 8a1.2 1.2 0 0 1-1.7-1.7l7.3-7.3" />
    </svg>
  )
}
function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function Spinner({ size = 14, className }: IconProps) {
  return (
    <svg
      className={`animate-spin ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// ── Folder config (order + icon + label) ─────────────────────────────
const FOLDERS: { key: FolderKey; label: string; Icon: (p: IconProps) => JSX.Element }[] = [
  { key: 'inbox', label: 'Inbox', Icon: InboxIcon },
  { key: 'sent', label: 'Sent', Icon: SendIcon },
  { key: 'flagged', label: 'Flagged', Icon: FlagIcon },
  { key: 'drafts', label: 'Drafts', Icon: FileTextIcon },
  { key: 'archive', label: 'Archive', Icon: ArchiveIcon },
  { key: 'trash', label: 'Trash', Icon: TrashIcon },
]
const FOLDER_LABEL: Record<FolderKey, string> = {
  inbox: 'Inbox',
  sent: 'Sent',
  flagged: 'Flagged',
  drafts: 'Drafts',
  archive: 'Archive',
  trash: 'Trash',
}

// ── Helpers ──────────────────────────────────────────────────────────
// ET calendar-date string (YYYY-MM-DD).
function etDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: ET })
}

// Today → "9:43 AM", within the last week → "Tue", older → "Jul 7". All ET.
function formatMsgTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const todayStr = etDateStr(now)
  const dStr = etDateStr(d)
  if (dStr === todayStr) {
    return d.toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit', hour12: true })
  }
  // Whole-day difference (both anchored to UTC-midnight of their ET date string).
  const diffDays = Math.round((Date.parse(todayStr) - Date.parse(dStr)) / 86_400_000)
  if (diffDays >= 1 && diffDays < 7) {
    return d.toLocaleDateString('en-US', { timeZone: ET, weekday: 'short' })
  }
  return d.toLocaleDateString('en-US', { timeZone: ET, month: 'short', day: 'numeric' })
}

// Full ET timestamp for the reading pane header.
function formatFullTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    timeZone: ET,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Initials from a display name (first letter of first + last), falling back to
// the email address, then "?".
function initials(name?: string, address?: string): string {
  const src = (name || address || '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function senderName(m: EmailMessage): string {
  return m.from?.emailAddress?.name || m.from?.emailAddress?.address || '(Unknown sender)'
}

// Human-readable attachment size.
function fmtSize(n?: number): string {
  if (!n || n <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// Rough HTML→text for feeding email bodies to the AI (keeps the payload small).
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Plain-text form of a message body (for AI input).
function messageText(m: EmailMessage): string {
  const body = m.body
  if (body?.content) {
    return body.contentType?.toLowerCase() === 'html' ? htmlToText(body.content) : body.content
  }
  return m.bodyPreview ?? ''
}

// Base style injected into the email iframe's <head>. Kept minimal: it does NOT
// set body background or color, so the email renders with its own colors (most
// HTML emails are designed for a white background — that's correct and expected).
// Only images are constrained to the container width and links get an accent.
// Scripts remain blocked by the sandbox.
const EMAIL_BASE_STYLE = `<style>
  body { margin: 0; padding: 8px; }
  img { max-width: 100% !important; height: auto !important; }
  a { color: #F0565E; }
</style>`

// Replace cid: references in the HTML with base64 data: URIs from the message's
// inline attachments, so inline images (embedded by Outlook as attachments and
// referenced via cid:) render in the sandboxed iframe.
function resolveCidImages(
  html: string,
  inlineAttachments: Array<{
    contentId: string
    contentType: string
    contentBytes: string
  }>
): string {
  let resolved = html
  for (const att of inlineAttachments) {
    if (!att.contentId || !att.contentBytes) continue
    const cid = att.contentId.replace(/[<>]/g, '').trim()
    const dataUri = `data:${att.contentType};base64,${att.contentBytes}`
    resolved = resolved.replace(new RegExp(`cid:${cid}`, 'gi'), dataUri)
  }
  return resolved
}

// Build the iframe srcDoc for an HTML email, injecting EMAIL_BASE_STYLE inside
// <head>. If the email markup already has a <head>, the style is inserted right
// after it; otherwise the content is wrapped in a minimal document.
function buildEmailSrcDoc(
  html: string,
  inlineAttachments: Array<{
    contentId: string
    contentType: string
    contentBytes: string
  }> = []
): string {
  // Resolve cid: inline images to data: URIs BEFORE sanitization so the
  // resulting <img src="data:..."> survives DOMPurify (which allows data: URIs
  // on img). Sanitizing first would leave dead cid: srcs.
  const resolvedHtml = resolveCidImages(html ?? '', inlineAttachments ?? [])

  // Sanitize HTML email content to prevent XSS.
  // Scripts and event handlers are stripped.
  // Safe for multi-user rollout.
  const cleanHtml = DOMPurify.sanitize(resolvedHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img', 'div', 'span', 'hr', 'figure',
      'figcaption', 'section', 'article', 'header',
      'footer', 'nav', 'aside', 'main',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style',
      'class', 'id', 'width', 'height',
      'target', 'rel', 'colspan', 'rowspan',
      'cellpadding', 'cellspacing', 'border',
      'align', 'valign', 'bgcolor',
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'javascript'],
  })

  // Inject the base style into <head>. Sanitization strips <head>/<body> (not in
  // ALLOWED_TAGS), so cleanHtml is a body-level fragment — the wrapper branch
  // below applies, placing EMAIL_BASE_STYLE in the head. The <head> branch is
  // kept defensively in case a future config allows those structural tags.
  const content = cleanHtml
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, match => `${match}${EMAIL_BASE_STYLE}`)
  }
  return `<!doctype html><html><head><meta charset="utf-8">${EMAIL_BASE_STYLE}</head><body>${content}</body></html>`
}

// ── Compose modal ────────────────────────────────────────────────────
const CASK_TEAM: { name: string; email: string }[] = [
  { name: 'Calin Noonan', email: 'c.noonan@caskconstruction.com' },
  { name: 'Kai Mapoy', email: 'k.mapoy@caskconstruction.com' },
  { name: 'Rovern Alimpoos', email: 'r.alimpoos@caskconstruction.com' },
  { name: 'Jeff Azcona', email: 'j.azcona@caskconstruction.com' },
  { name: 'Matteo Carpani', email: 'm.carpani@caskconstruction.com' },
  { name: 'Chad Holman', email: 'c.holman@caskconstruction.com' },
  { name: 'Lamont Gilyot', email: 'l.gilyot@caskconstruction.com' },
  { name: 'Kaitlyn Grunenberg', email: 'k.grunenberg@caskconstruction.com' },
]

// A single recipient row (To / Cc / Bcc) with CASK-team autocomplete. The
// dropdown filters CASK_TEAM by name/email substring, supports arrow-key + Enter
// selection, and closes on blur or Escape. Selecting replaces the whole field
// value with the chosen email (per spec).
function RecipientInput({
  label,
  value,
  onChange,
  placeholder,
  right,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  right?: JSX.Element
}) {
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const q = value.trim().toLowerCase()
  const matches =
    q.length >= 1
      ? CASK_TEAM.filter(
          m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        ).slice(0, 5)
      : []
  const showDropdown = focused && matches.length > 0

  function select(email: string) {
    onChange(email)
    setFocused(false)
    setHighlight(0)
  }

  return (
    <div className="relative flex items-center gap-2 border-b-[0.5px] border-[var(--border)] px-4 py-2">
      <label className="w-8 flex-shrink-0 text-xs uppercase tracking-wide text-[var(--text3)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setHighlight(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          if (!showDropdown) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight(h => Math.min(h + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            select(matches[highlight]?.email ?? value)
          } else if (e.key === 'Escape') {
            setFocused(false)
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
      />
      {right}
      {showDropdown && (
        <div className="absolute left-4 right-4 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {matches.map((m, i) => (
            <button
              key={m.email}
              type="button"
              // onMouseDown (not onClick) so selection fires before the input's blur.
              onMouseDown={e => {
                e.preventDefault()
                select(m.email)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-[var(--surface2)] ${
                i === highlight ? 'bg-[var(--surface2)]' : ''
              }`}
            >
              <span className="text-sm text-[var(--text)]">{m.name}</span>
              <span className="text-xs text-[var(--text3)]">{m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Fully working compose modal. All field/UI state lives here; the modal is
// conditionally rendered ({composeOpen && <ComposeModal/>}), so closing it
// (onClose) unmounts the component and resets every field to its default.
function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [aiDraftError, setAiDraftError] = useState('')

  const canSend =
    to.trim() !== '' && subject.trim() !== '' && body.trim() !== '' && !loading

  // Recipients are entered as comma/semicolon-separated lists.
  function parseEmails(s: string): string[] {
    return s
      .split(/[,;]/)
      .map(x => x.trim())
      .filter(Boolean)
  }

  async function handleSend() {
    if (!canSend) return
    setLoading(true)
    setError('')
    const toArray = parseEmails(to)
    const ccArray = showCc ? parseEmails(cc) : []
    const bccArray = showBcc ? parseEmails(bcc) : []
    try {
      const res = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toArray,
          subject,
          body,
          ...(ccArray.length > 0 ? { cc: ccArray } : {}),
          ...(bccArray.length > 0 ? { bcc: bccArray } : {}),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
      }
      if (!res.ok || !json.success) {
        setError('Failed to send. Try again.')
        setLoading(false)
        return
      }
      setSent(true)
      // Show the "Email sent!" confirmation briefly, then close (unmount resets state).
      setTimeout(() => onClose(), 2000)
    } catch {
      setError('Failed to send. Try again.')
      setLoading(false)
    }
  }

  // Draft the email body from a short prompt. Reuses the existing 'draft_reply'
  // action (no API-route change): its system prompt composes new bodies fine,
  // with the user's prompt passed as the "email" for the assistant to respond to.
  async function draftWithAI() {
    if (!aiPrompt.trim() || aiDraftLoading) return
    setAiDraftLoading(true)
    setAiDraftError('')
    try {
      const res = await fetch('/api/email/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_reply',
          subject: subject || 'New email',
          body: aiPrompt,
          senderName: 'CASK Construction Team',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        result?: string
        error?: string
      }
      if (data.result) {
        setBody(data.result)
        setAiPrompt('')
      } else {
        setAiDraftError('AI unavailable, try again.')
      }
    } catch {
      setAiDraftError('AI unavailable, try again.')
    } finally {
      setAiDraftLoading(false)
    }
  }

  // Shared modal content (header, fields, message, AI, footer). Wrapped below by
  // either the full-screen shell (expanded) or a centered backdrop (docked).
  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b-[0.5px] border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
        <span className="font-medium text-[var(--text)]">New Message</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Shrink' : 'Expand'}
            title={expanded ? 'Shrink' : 'Expand'}
            className="rounded-md p-1 text-[var(--text2)] transition-colors hover:text-[var(--text)]"
          >
            <span aria-hidden className="text-sm leading-none">
              {expanded ? '⤡' : '⤢'}
            </span>
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--text3)] transition-colors hover:text-[var(--text)]"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* To */}
      <RecipientInput
        label="To"
        value={to}
        onChange={setTo}
        placeholder="name@company.com"
        right={
          <div className="flex flex-shrink-0 items-center gap-2">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-xs text-[var(--text3)] transition-colors hover:text-[var(--text2)]"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="text-xs text-[var(--text3)] transition-colors hover:text-[var(--text2)]"
              >
                Bcc
              </button>
            )}
          </div>
        }
      />

      {/* Cc */}
      {showCc && (
        <RecipientInput
          label="Cc"
          value={cc}
          onChange={setCc}
          placeholder="name@company.com"
        />
      )}

      {/* Bcc */}
      {showBcc && (
        <RecipientInput
          label="Bcc"
          value={bcc}
          onChange={setBcc}
          placeholder="name@company.com"
        />
      )}

      {/* Subject */}
      <div className="flex items-center gap-2 border-b-[0.5px] border-[var(--border)] px-4 py-2">
        <label className="w-16 flex-shrink-0 text-xs uppercase tracking-wide text-[var(--text3)]">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
        />
      </div>

      {/* Message */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your message..."
        className="min-h-[200px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-[1.7] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
      />

      {/* Draft with AI */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--text3)]">
          <SparklesIcon size={13} />
          Draft with AI
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && aiPrompt.trim() !== '' && !aiDraftLoading) {
                e.preventDefault()
                draftWithAI()
              }
            }}
            disabled={aiDraftLoading}
            placeholder="e.g. Write a follow-up to Lamont about KPIs, or thank Kai for organizing the meeting..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={draftWithAI}
            disabled={aiPrompt.trim() === '' || aiDraftLoading}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiDraftLoading ? 'Drafting...' : 'Draft →'}
          </button>
        </div>
        {aiDraftError && (
          <div className="mt-2 text-xs text-[var(--red)]">{aiDraftError}</div>
        )}
        <div className="mt-1.5 text-xs text-[var(--text3)]">
          AI will write the email body. You can edit before sending.
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t-[0.5px] border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
        <div className="flex items-center gap-3">
          {sent && <span className="text-sm text-[var(--green)]">Email sent!</span>}
          {error && <span className="text-sm text-[var(--red)]">{error}</span>}
          <button
            onClick={onClose}
            className="bg-transparent text-sm text-[var(--text3)] transition-colors hover:text-[var(--text2)]"
          >
            Discard
          </button>
        </div>
      </div>
    </>
  )

  return expanded ? (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">{content}</div>
  ) : (
    // Docked: a centered card over a click-to-close backdrop.
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex h-[75vh] w-[85vw] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      >
        {content}
      </div>
    </div>
  )
}

// ── List loading skeleton ────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="shimmer h-3.5 w-28 rounded" />
            <div className="shimmer h-3 w-10 rounded" />
          </div>
          <div className="shimmer mt-2.5 h-3.5 w-3/4 rounded" />
          <div className="shimmer mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Not-connected / error empty state ────────────────────────────────
function ConnectState({ title, cta }: { title: string; cta: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <MailIcon size={40} className="text-[var(--text3)]" />
        <div className="text-sm text-[var(--text2)]">{title}</div>
        <a
          href="/api/auth/microsoft"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          {cta}
        </a>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function MyEmailPage() {
  const [folder, setFolder] = useState<FolderKey>('inbox')
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Badge counts (kept fresh independently so they show on inactive folders).
  const [inboxUnread, setInboxUnread] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const prevUnreadRef = useRef<number | null>(null)
  const [newBanner, setNewBanner] = useState(false)

  // Reading pane.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<EmailMessage | null>(null)
  const [readingLoading, setReadingLoading] = useState(false)

  // Reply.
  const [replyText, setReplyText] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [replySent, setReplySent] = useState(false)
  const [replyError, setReplyError] = useState('')
  // AI-generated draft marker + revision-pill state. aiDraft is set when a draft
  // reply is generated (or revised); the revision pills only show when it's non-empty.
  const [aiDraft, setAiDraft] = useState('')
  const [revisionLoading, setRevisionLoading] = useState<string | null>(null)
  const [revisionError, setRevisionError] = useState('')
  const [customRevisionText, setCustomRevisionText] = useState('')
  const [replyExpanded, setReplyExpanded] = useState(false)
  const replyRef = useRef<HTMLTextAreaElement | null>(null)

  // AI.
  const [aiLoading, setAiLoading] = useState<AiKind | null>(null)
  const [aiCard, setAiCard] = useState<{ kind: AiKind; text: string } | null>(null)
  const [aiError, setAiError] = useState('')

  // Compose + toast.
  const [composeOpen, setComposeOpen] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => setToast(msg), [])

  // Auto-dismiss the toast after 3s.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Auto-dismiss the "Reply sent!" confirmation after 3s.
  useEffect(() => {
    if (!replySent) return
    const t = setTimeout(() => setReplySent(false), 3000)
    return () => clearTimeout(t)
  }, [replySent])

  // ── Fetch a folder's message list ──────────────────────────────────
  const loadList = useCallback(
    async (f: FolderKey, skip: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setListLoading(true)
      try {
        const res = await fetch(`/api/email/inbox?folder=${f}&top=50&skip=${skip}`)
        const json: InboxResponse = await res.json()
        if (json.error) {
          setListError(json.error)
          if (!append) setMessages([])
          return
        }
        setListError(null)
        const incoming = json.messages ?? []
        setMessages(prev => (append ? [...prev, ...incoming] : incoming))
        setTotalCount(json.totalCount ?? incoming.length)
        setHasMore(!!json.hasMore)
      } catch {
        setListError('fetch_error')
        if (!append) setMessages([])
      } finally {
        setListLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  // ── Refresh badge counts (inbox unread + flagged) ──────────────────
  const loadCounts = useCallback(async () => {
    try {
      const [inboxRes, flaggedRes] = await Promise.all([
        fetch('/api/email/inbox?folder=inbox&top=50&skip=0').then(r => r.json() as Promise<InboxResponse>),
        fetch('/api/email/inbox?folder=flagged&top=50&skip=0').then(r => r.json() as Promise<InboxResponse>),
      ])
      if (!inboxRes.error) {
        const unread = (inboxRes.messages ?? []).filter(m => !m.isRead).length
        // Banner when unread grows vs the previous poll (skip the first sample).
        if (prevUnreadRef.current !== null && unread > prevUnreadRef.current) {
          setNewBanner(true)
        }
        prevUnreadRef.current = unread
        setInboxUnread(unread)
      }
      if (!flaggedRes.error) {
        setFlaggedCount(flaggedRes.totalCount ?? (flaggedRes.messages ?? []).length)
      }
    } catch {
      /* non-fatal: badges just stay at their last value */
    }
  }, [])

  // Load the active folder whenever it changes.
  useEffect(() => {
    setSearch('')
    loadList(folder, 0, false)
  }, [folder, loadList])

  // Initial counts + 60s auto-refresh of the list and counts.
  useEffect(() => {
    loadCounts()
    const id = setInterval(() => {
      loadList(folder, 0, false)
      loadCounts()
    }, 60_000)
    return () => clearInterval(id)
    // folder is intentionally included so the interval refreshes the visible folder.
  }, [folder, loadList, loadCounts])

  // ── Select + open an email ─────────────────────────────────────────
  const openEmail = useCallback(
    async (m: EmailMessage) => {
      setSelectedId(m.id)
      setSelected(null)
      setReadingLoading(true)
      setAiCard(null)
      setReplyText('')
      setReplyOpen(false)
      setReplyError('')
      setReplySent(false)

      // Auto mark-as-read on opening an unread message.
      if (!m.isRead) {
        // Optimistic local update.
        setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, isRead: true } : x)))
        setInboxUnread(c => Math.max(0, c - 1))
        prevUnreadRef.current = Math.max(0, (prevUnreadRef.current ?? 0) - 1)
        fetch(`/api/email/${encodeURIComponent(m.id)}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        }).catch(() => {
          /* non-fatal: the message still opens */
        })
      }

      try {
        const res = await fetch(`/api/email/${encodeURIComponent(m.id)}`)
        const json = (await res.json()) as EmailMessage & { error?: string }
        if (json.error) {
          setListError(json.error)
          setSelected(null)
        } else {
          setSelected(json)
        }
      } catch {
        setSelected(null)
      } finally {
        setReadingLoading(false)
      }
    },
    [],
  )

  // ── Reply composer open/close ──────────────────────────────────────
  function openReply() {
    setReplyOpen(true)
    setReplyError('')
    // Focus once the textarea has mounted.
    setTimeout(() => replyRef.current?.focus(), 0)
  }
  function closeReply() {
    setReplyOpen(false)
    setReplyText('')
    setReplyError('')
    setAiDraft('')
    setRevisionLoading(null)
    setRevisionError('')
    setCustomRevisionText('')
    setReplyExpanded(false)
  }

  // ── Reply ──────────────────────────────────────────────────────────
  async function handleSendReply() {
    if (!selected || replySending || !replyText.trim()) return
    setReplySending(true)
    setReplyError('')
    try {
      const res = await fetch(`/api/email/${encodeURIComponent(selected.id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setReplyError('Could not send reply. Please try again.')
        return
      }
      setReplyOpen(false)
      setReplyText('')
      setReplySent(true)
    } catch {
      setReplyError('Network error. Please try again.')
    } finally {
      setReplySending(false)
    }
  }

  // ── Mark unread ────────────────────────────────────────────────────
  async function handleMarkUnread() {
    if (!selected) return
    setMessages(prev => prev.map(x => (x.id === selected.id ? { ...x, isRead: false } : x)))
    setSelected(s => (s ? { ...s, isRead: false } : s))
    setInboxUnread(c => c + 1)
    prevUnreadRef.current = (prevUnreadRef.current ?? 0) + 1
    try {
      await fetch(`/api/email/${encodeURIComponent(selected.id)}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: false }),
      })
    } catch {
      /* non-fatal */
    }
  }

  // Flag/Forward/Archive aren't wired to a backend yet (see file header).
  function handleComingSoon() {
    showToast('Coming soon')
  }

  // ── AI actions (routed through the dedicated /api/email/ai route) ──
  async function runAi(kind: AiKind) {
    if (!selected || aiLoading) return
    setAiLoading(kind)
    setAiError('')
    if (kind !== 'draft') setAiCard(null)

    // Map the page's AiKind to the /api/email/ai action names.
    const action: 'summarize' | 'draft_reply' | 'extract' =
      kind === 'draft' ? 'draft_reply' : kind

    try {
      const res = await fetch('/api/email/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          subject: selected.subject ?? '',
          // The route strips HTML server-side, so send the raw body content
          // (falling back to the preview if the full body is missing).
          body: selected.body?.content ?? selected.bodyPreview ?? '',
          senderName: senderName(selected),
          // Attachment context: let the AI route fetch + fold in this message's
          // attachments. Forced true so the AI always attempts a fetch — the
          // attachments route returns an empty array when there are none, so the
          // only cost is one extra API call. This is the signed-in user's own mailbox.
          messageId: selected.id,
          hasAttachments: true,
          isPresidentInbox: false,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { result?: string; error?: string }
      const text = (json.result ?? '').trim()
      if (!res.ok || json.error || !text) {
        setAiError('AI unavailable, try again')
        return
      }
      if (kind === 'draft') {
        // Draft reply → open the composer and populate it with the result so the
        // user can read the full draft, edit, then send.
        setReplyText(text)
        setAiDraft(text)
        setReplyOpen(true)
        setTimeout(() => replyRef.current?.focus(), 0)
      } else {
        // Summarize / Extract → show the result in the inline card below the body.
        setAiCard({ kind, text })
      }
    } catch {
      setAiError('AI unavailable, try again')
    } finally {
      setAiLoading(null)
    }
  }

  // ── AI draft revision (pills below the reply composer) ─────────────
  // Each pill (except Regenerate) sends the current draft + an instruction to
  // /api/email/ai action 'revise'. Regenerate re-runs 'draft_reply' from scratch.
  // The clicked pill's label doubles as the loading key and the revision text.
  async function runRevision(label: string, isCustom = false) {
    if (!selected || revisionLoading) return
    setRevisionLoading(label)
    setRevisionError('')
    const isRegenerate = !isCustom && label === 'Regenerate ↺'
    const body = selected.body?.content ?? selected.bodyPreview ?? ''
    const payload = isRegenerate
      ? {
          action: 'draft_reply',
          subject: selected.subject ?? '',
          body,
          senderName: senderName(selected),
        }
      : {
          action: 'revise',
          subject: selected.subject ?? '',
          body,
          senderName: senderName(selected),
          currentDraft: replyText,
          revision: label,
        }
    try {
      const res = await fetch('/api/email/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { result?: string; error?: string }
      const text = (json.result ?? '').trim()
      if (!res.ok || json.error || !text) {
        setRevisionError('AI unavailable, try again')
        return
      }
      setReplyText(text)
      setAiDraft(text)
      if (isCustom) setCustomRevisionText('')
    } catch {
      setRevisionError('AI unavailable, try again')
    } finally {
      setRevisionLoading(null)
    }
  }

  // ── Derived list (client-side search filter) ───────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(m => {
      const name = senderName(m).toLowerCase()
      const subj = (m.subject ?? '').toLowerCase()
      const prev = (m.bodyPreview ?? '').toLowerCase()
      return name.includes(q) || subj.includes(q) || prev.includes(q)
    })
  }, [messages, search])

  const shownUnread = filtered.filter(m => !m.isRead).length
  const notConnected = listError === 'not_connected' || listError === 'user_not_found'
  const tokenInvalid = listError === 'token_invalid' || listError === 'unauthorized'

  // ── Shared reply-composer pieces ───────────────────────────────────
  // Rendered identically in the inline composer and the full-screen overlay so
  // the two views never drift. Only one composer renders at a time (see the
  // replyExpanded ternary below), so reusing these elements is safe.
  const revisionTools = (
    <>
      <div className="flex flex-wrap gap-2">
        {(['Make it shorter', 'Make it longer', 'More formal', 'More friendly', 'More direct', 'Regenerate ↺'] as const).map(label => {
          const isLoading = revisionLoading === label
          const anyLoading = revisionLoading !== null
          return (
            <button
              key={label}
              type="button"
              onClick={() => runRevision(label)}
              disabled={anyLoading}
              className={`cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs text-[var(--text2)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:cursor-not-allowed ${anyLoading && !isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? '...' : label}
            </button>
          )
        })}
      </div>
      {revisionError && (
        <div className="mt-2 text-xs text-[var(--red)]">{revisionError}</div>
      )}

      {/* Custom revision input — free-text instruction + Apply */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={customRevisionText}
          onChange={e => setCustomRevisionText(e.target.value)}
          onKeyDown={e => {
            if (
              e.key === 'Enter' &&
              customRevisionText.trim() !== '' &&
              revisionLoading === null
            ) {
              e.preventDefault()
              runRevision(customRevisionText, true)
            }
          }}
          disabled={revisionLoading !== null}
          placeholder="Tell AI what to change..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => runRevision(customRevisionText, true)}
          disabled={customRevisionText.trim() === '' || revisionLoading !== null}
          className="rounded-lg bg-[var(--red)] px-3 py-2 text-sm text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply →
        </button>
      </div>

      {/* Divider between custom input row and textarea */}
      <div className="my-3 h-px bg-[var(--border)]" />
    </>
  )

  const actionButtons = (
    <>
      <button
        onClick={closeReply}
        className="rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)]"
      >
        Discard
      </button>
      <button
        onClick={handleSendReply}
        disabled={replySending || !replyText.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {replySending && <Spinner />}
        {replySending ? 'Sending…' : 'Send'}
      </button>
    </>
  )

  return (
    <div className="grid h-full grid-cols-[220px_300px_1fr] overflow-hidden animate-page-in">
      {/* ── COLUMN 1 — SIDEBAR ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text3)]">
            My Workspace
          </div>
          <h1 className="mt-0.5 text-base font-medium text-[var(--text)]">My Emails</h1>
        </div>

        <button
          onClick={() => setComposeOpen(true)}
          className="w-full rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Compose
        </button>

        <nav className="flex flex-col gap-0.5">
          {FOLDERS.map((f, idx) => {
            const active = folder === f.key
            const badge =
              f.key === 'inbox' ? inboxUnread : f.key === 'flagged' ? flaggedCount : 0
            return (
              <div key={f.key}>
                {/* Divider before Archive (spec: Drafts | divider | Archive) */}
                {idx === 4 && <div className="my-1.5 h-px bg-[var(--border)]" />}
                <button
                  onClick={() => setFolder(f.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--surface2)] font-medium text-[var(--text)]'
                      : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                  }`}
                >
                  <f.Icon size={17} className="shrink-0" />
                  <span className="flex-1 text-left">{f.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-[11px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>
      </div>

      {/* ── COLUMN 2 — EMAIL LIST ──────────────────────────────────── */}
      <div className="flex min-h-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">
              {FOLDER_LABEL[folder]}
            </div>
            {shownUnread > 0 && (
              <div className="text-xs text-[var(--text3)]">{shownUnread} unread</div>
            )}
          </div>
          {/* Search */}
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-[var(--surface2)] px-2.5 py-1.5">
            <SearchIcon className="shrink-0 text-[var(--text3)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
            />
          </div>
        </div>

        {/* "New emails" banner */}
        {newBanner && (
          <button
            onClick={() => {
              setNewBanner(false)
              setFolder('inbox')
              loadList('inbox', 0, false)
            }}
            className="border-b border-[var(--border)] bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            New emails · tap to refresh
          </button>
        )}

        {/* List body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listLoading ? (
            <ListSkeleton />
          ) : notConnected ? (
            <ConnectState title="Connect your Outlook to see your email" cta="Connect Outlook" />
          ) : tokenInvalid ? (
            <ConnectState title="Your Outlook session expired" cta="Reconnect Outlook" />
          ) : listError ? (
            <ConnectState title="Couldn't load your email. Please try again." cta="Reconnect Outlook" />
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text3)]">
              {search ? 'No emails match your search' : `No emails in ${FOLDER_LABEL[folder]}`}
            </div>
          ) : (
            <>
              {filtered.map(m => {
                const isSel = m.id === selectedId
                const unread = !m.isRead
                return (
                  <button
                    key={m.id}
                    onClick={() => openEmail(m)}
                    className={`flex w-full flex-col gap-1 border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
                      isSel ? 'bg-[var(--surface2)]' : 'hover:bg-[var(--surface2)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--red)]" aria-hidden="true" />
                      )}
                      <span
                        className={`flex-1 truncate text-sm ${
                          unread ? 'font-semibold text-[var(--text)]' : 'text-[var(--text2)]'
                        }`}
                      >
                        {senderName(m)}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--text3)]">
                        {formatMsgTime(m.receivedDateTime)}
                      </span>
                    </div>
                    <div
                      className={`truncate text-sm ${
                        unread ? 'font-semibold text-[var(--text)]' : 'text-[var(--text2)]'
                      }`}
                    >
                      {m.subject || '(No subject)'}
                    </div>
                    <div className="truncate text-xs text-[var(--text3)]">
                      {m.bodyPreview || ''}
                    </div>
                  </button>
                )
              })}

              {/* Load more (only when the folder itself has more, and not searching) */}
              {hasMore && !search && (
                <div className="p-3">
                  <button
                    onClick={() => loadList(folder, messages.length, true)}
                    disabled={loadingMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-xs font-semibold text-[var(--text2)] transition-colors hover:text-[var(--text)] disabled:opacity-60"
                  >
                    {loadingMore && <Spinner />}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
              <div className="px-4 py-2 text-center text-[11px] text-[var(--text3)]">
                {messages.length} of {totalCount}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── COLUMN 3 — READING PANE ────────────────────────────────── */}
      <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--bg)]">
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <MailIcon size={54} className="text-[var(--text3)]" />
            <div className="text-sm text-[var(--text3)]">Select an email to read</div>
          </div>
        ) : readingLoading ? (
          <div className="flex flex-1 items-center justify-center text-[var(--text3)]">
            <Spinner size={22} />
          </div>
        ) : !selected ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--text3)]">
            Couldn&apos;t load this email.
          </div>
        ) : (
          <>
            {/* Scrollable email content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {/* Subject */}
              <h2 className="text-[15px] font-medium text-[var(--text)]">
                {selected.subject || '(No subject)'}
              </h2>

              {/* Sender row */}
              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--red)] text-xs font-semibold text-white">
                  {initials(selected.from?.emailAddress?.name, selected.from?.emailAddress?.address)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text)]">
                    {selected.from?.emailAddress?.name || selected.from?.emailAddress?.address || '(Unknown)'}
                  </div>
                  <div className="truncate text-xs text-[var(--text3)]">
                    {selected.from?.emailAddress?.address || ''}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-[var(--text3)]">
                  {formatFullTime(selected.receivedDateTime)}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionBtn label="Reply" onClick={openReply}>
                  <ReplyIcon />
                </ActionBtn>
                <ActionBtn label="Forward" onClick={handleComingSoon}>
                  <ForwardIcon />
                </ActionBtn>
                <ActionBtn label="Flag" onClick={handleComingSoon}>
                  <FlagIcon size={16} />
                </ActionBtn>
                <ActionBtn label="Archive" onClick={handleComingSoon}>
                  <ArchiveIcon size={16} />
                </ActionBtn>
                <ActionBtn label="Mark unread" onClick={handleMarkUnread}>
                  <MailIcon size={16} />
                </ActionBtn>
              </div>

              {/* AI bar */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">
                  AI
                </span>
                <AiPill
                  label={aiLoading === 'summarize' ? (selected.hasAttachments ? 'Reading email and attachments…' : 'Summarizing…') : 'Summarize'}
                  loading={aiLoading === 'summarize'}
                  disabled={aiLoading !== null}
                  onClick={() => runAi('summarize')}
                >
                  <SparklesIcon />
                </AiPill>
                <AiPill
                  label={aiLoading === 'draft' ? (selected.hasAttachments ? 'Reading email and attachments…' : 'Drafting…') : 'Draft reply'}
                  loading={aiLoading === 'draft'}
                  disabled={aiLoading !== null}
                  onClick={() => runAi('draft')}
                >
                  <PencilIcon />
                </AiPill>
                <AiPill
                  label={aiLoading === 'extract' ? (selected.hasAttachments ? 'Reading email and attachments…' : 'Extracting…') : 'Extract action items'}
                  loading={aiLoading === 'extract'}
                  disabled={aiLoading !== null}
                  onClick={() => runAi('extract')}
                >
                  <ListCheckIcon />
                </AiPill>
              </div>

              {/* AI error */}
              {aiError && (
                <div className="mt-3 text-sm font-medium text-[var(--red)]">{aiError}</div>
              )}

              {/* AI result card (summarize / extract) */}
              {aiCard && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text3)]">
                    <SparklesIcon className="text-[var(--red)]" />
                    {aiCard.kind === 'summarize' ? 'Summary' : 'Action Items'}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--text)]">
                    {aiCard.text}
                  </pre>
                </div>
              )}

              {/* Body */}
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                {selected.body?.contentType?.toLowerCase() === 'html' ? (
                  // Sandboxed so remote/email markup can't script the app. A fixed
                  // tall height with internal scroll keeps this Tailwind-only (no
                  // dynamic inline sizing).
                  <iframe
                    title="Email body"
                    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    srcDoc={buildEmailSrcDoc(selected.body?.content ?? '', selected.inlineAttachments ?? [])}
                    // bg-white: HTML emails are designed for a white background.
                    className="h-[600px] w-full rounded-lg border border-[var(--border)] bg-white"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--text)]">
                    {selected.body?.content || selected.bodyPreview || ''}
                  </pre>
                )}

                {/* Attachments */}
                {selected.hasAttachments && (selected.attachments?.length ?? 0) > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.attachments!.map((a, i) => (
                      <div
                        key={a.id ?? i}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs text-[var(--text2)]"
                      >
                        <PaperclipIcon className="shrink-0 text-[var(--text3)]" />
                        <span className="max-w-[200px] truncate">{a.name || 'attachment'}</span>
                        {a.size ? <span className="text-[var(--text3)]">{fmtSize(a.size)}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply bar (bottom) */}
            {/* Reply composer — collapsed slim action bar, or expanded panel.
                flex-shrink-0 keeps it a fixed height at the bottom while the email
                body above (flex-1 overflow-y-auto) shrinks to fit. */}
            {!replyOpen ? (
              <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-4">
                <button
                  onClick={openReply}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)]"
                >
                  <ReplyIcon /> Reply
                </button>
              </div>
            ) : replyExpanded ? (
              // Full-screen reply composer overlay
              <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
                {/* Header row */}
                <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
                  <span className="text-[13px] text-[var(--text2)]">
                    Reply to {senderName(selected)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReplyExpanded(false)}
                      aria-label="Shrink"
                      title="Shrink"
                      className="rounded-md p-1 text-[var(--text2)] transition-colors hover:text-[var(--text)]"
                    >
                      <span aria-hidden className="text-sm leading-none">⤡</span>
                    </button>
                    <button
                      onClick={closeReply}
                      aria-label="Close reply"
                      title="Close"
                      className="rounded-md p-1 text-[var(--text3)] transition-colors hover:text-[var(--text)]"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                {/* Body — revision tools + textarea; everything visible, no scroll */}
                <div className="flex flex-1 flex-col overflow-hidden p-4">
                  {aiDraft !== '' && revisionTools}
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-4 text-[13px] leading-[1.7] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
                  />
                  {replyError && (
                    <div className="mt-2 text-xs text-[var(--red)]">{replyError}</div>
                  )}
                </div>

                {/* Bottom action row */}
                <div className="flex items-center justify-between border-t border-[var(--border)] p-4">
                  {actionButtons}
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text2)]">
                    Reply to {senderName(selected)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReplyExpanded(true)}
                      aria-label="Expand"
                      title="Expand"
                      className="rounded-md p-1 text-[var(--text2)] transition-colors hover:text-[var(--text)]"
                    >
                      <span aria-hidden className="text-sm leading-none">⤢</span>
                    </button>
                    <button
                      onClick={closeReply}
                      aria-label="Close reply"
                      className="rounded-md p-1 text-[var(--text3)] transition-colors hover:text-[var(--text)]"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-3 h-px bg-[var(--border)]" />

                {/* AI revision tools — shown only after a draft has been generated */}
                {aiDraft !== '' && revisionTools}

                {/* Textarea */}
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={6}
                  placeholder="Write your reply..."
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-3 text-[13px] leading-[1.7] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
                />

                {replyError && <div className="mt-2 text-xs text-[var(--red)]">{replyError}</div>}

                {/* Bottom action row */}
                <div className="mt-3 flex items-center justify-between">
                  {actionButtons}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <ComposeModal onClose={() => setComposeOpen(false)} />
      )}

      {/* "Reply sent!" green toast — auto-dismisses after 3s (replySent effect). */}
      {replySent && (
        <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--green)] shadow-lg">
          Reply sent!
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Small button pieces ──────────────────────────────────────────────
function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)]"
    >
      {children}
      {label}
    </button>
  )
}

function AiPill({
  label,
  loading,
  disabled,
  onClick,
  children,
}: {
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Spinner /> : children}
      {label}
    </button>
  )
}
