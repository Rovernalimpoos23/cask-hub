'use client'

// ── Shared Compose modal ─────────────────────────────────────────────
// Extracted verbatim from my-workspace/email/page.tsx and president/inbox/page.tsx,
// which each carried a byte-identical 656-line copy of this block. Both pages now
// import from here, so the two mailboxes can no longer drift apart.
//
// Behavior is unchanged from those inline copies. The only addition is the optional
// prefillSubject / prefillBody props, used to seed the Subject and Message fields
// when Compose is opened from a deep link (e.g. the Big Vision leader agent's
// "Open in Compose" action). Both seeded fields stay fully editable — nothing is
// locked, which is a deliberate difference from the calendar's locked-invite flow.
// `to` / `cc` / `bcc` are never prefilled, so canSend still requires the user to
// type a recipient before Send enables.
//
// RecipientInput and CASK_TEAM are exported too: both pages' ForwardModal (which
// stays in the pages) also renders RecipientInput, so it has to live alongside the
// component that shares it rather than being duplicated again.
//
// The icon helpers and fmtSize below are small private copies of the pages' own
// versions. Those pages still use their originals for the reading pane and
// ForwardModal, so they could not simply be moved; copying the four this modal
// needs keeps the shared component self-contained without rewiring ~20 unrelated
// icon call sites across both pages.

import { ChangeEvent, useRef, useState } from 'react'

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

function SparklesIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
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

// ── Compose modal ────────────────────────────────────────────────────
export const CASK_TEAM: { name: string; email: string }[] = [
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
export function RecipientInput({
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

// Attachment size caps (client-side pre-checks; the compose API re-validates).
// 3MB per file matches Microsoft Graph's inline fileAttachment limit.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024 // 3MB
const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024 // 10MB

// Read a File into a base64 string (no data: prefix) for the Graph fileAttachment
// contentBytes field. FileReader.readAsDataURL yields "data:<mime>;base64,<data>";
// we strip everything up to and including the comma.
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

// Fully working compose modal. All field/UI state lives here; the modal is
// conditionally rendered ({composeOpen && <ComposeModal/>}), so closing it
// (onClose) unmounts the component and resets every field to its default.
export default function ComposeModal({
  onClose,
  prefillSubject,
  prefillBody,
}: {
  onClose: () => void
  prefillSubject?: string
  prefillBody?: string
}) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  // Subject/body are seeded from the optional prefill props (deep-link Compose).
  // These are just the initial values of ordinary useState, so both fields stay
  // fully editable after prefill — nothing here is read-only or locked. With no
  // props passed (the manual "New Message" flow) both fall back to the empty
  // string, exactly as before this component was shared.
  const [subject, setSubject] = useState(prefillSubject ?? '')
  const [body, setBody] = useState(prefillBody ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  // Default to full-screen (true) so Compose opens expanded, not the centered card.
  const [expanded, setExpanded] = useState(true)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [aiDraftError, setAiDraftError] = useState('')
  // AI revision state. composeAiDraft holds the last AI-generated body and gates
  // the revision pills' visibility (non-empty → at least one draft exists).
  // No explicit closeCompose reset is needed: the modal is conditionally rendered
  // and unmounts on close (see the note above ComposeModal), which resets all of
  // these to their defaults along with every other field.
  const [composeAiDraft, setComposeAiDraft] = useState('')
  const [composeRevisionLoading, setComposeRevisionLoading] = useState<string | null>(null)
  const [composeCustomRevision, setComposeCustomRevision] = useState('')
  const [composeRevisionError, setComposeRevisionError] = useState('')
  // File attachments. Like the rest of this modal's state, these reset on close:
  // the modal unmounts (see the note above ComposeModal), so no explicit
  // closeCompose reset is needed for attachments / attachError.
  const [attachments, setAttachments] = useState<
    Array<{ name: string; contentType: string; contentBytes: string; size: number }>
  >([])
  const [attachError, setAttachError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
          ...(attachments.length > 0 ? { attachments } : {}),
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

  // Read the picked files, enforce the per-file (3MB) and running-total (10MB)
  // caps, and append valid ones (base64-encoded) to the attachments list. Any
  // rejected/failed file sets attachError but never blocks the others.
  async function handleFileAttach(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setAttachError('')
    let runningTotal = attachments.reduce((sum, a) => sum + a.size, 0)
    const added: Array<{ name: string; contentType: string; contentBytes: string; size: number }> = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError('File must be under 3MB. Please compress or split the file.')
        continue
      }
      if (runningTotal + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
        setAttachError('Total attachments exceed 10MB limit.')
        continue
      }
      try {
        const contentBytes = await readFileAsBase64(file)
        added.push({
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBytes,
          size: file.size,
        })
        runningTotal += file.size
      } catch {
        setAttachError('Could not read file. Try again.')
      }
    }
    if (added.length > 0) setAttachments(prev => [...prev, ...added])
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = ''
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    setAttachError('')
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
        // Record the generated draft (reveals the revision pills). aiPrompt is
        // intentionally NOT cleared here: the revision pills + Regenerate reuse it
        // as the `body` for /api/email/ai, so it must survive the initial draft.
        setComposeAiDraft(data.result)
        setComposeRevisionError('')
      } else {
        setAiDraftError('AI unavailable, try again.')
      }
    } catch {
      setAiDraftError('AI unavailable, try again.')
    } finally {
      setAiDraftLoading(false)
    }
  }

  // Revise (or regenerate) the AI-drafted body. Mirrors the reading-pane reply
  // composer's runRevision: each pill sends the current draft + an instruction to
  // /api/email/ai action 'revise'; Regenerate re-runs 'draft_reply' from the
  // original prompt (aiPrompt). The clicked label doubles as the loading key and,
  // for the preset pills, the revision instruction. Only reachable once
  // composeAiDraft is set (the pills are hidden otherwise).
  async function runComposeRevision(label: string, isCustom = false) {
    if (composeRevisionLoading) return
    setComposeRevisionLoading(label)
    setComposeRevisionError('')
    const isRegenerate = !isCustom && label === 'Regenerate ↺'
    const payload = isRegenerate
      ? {
          action: 'draft_reply',
          subject: subject || 'New email',
          body: aiPrompt,
          senderName: 'CASK Construction Team',
        }
      : {
          action: 'revise',
          subject: subject || 'New email',
          body: aiPrompt,
          senderName: 'CASK Construction Team',
          currentDraft: body,
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
        setComposeRevisionError('AI unavailable, try again')
        return
      }
      setBody(text)
      setComposeAiDraft(text)
      if (isCustom) setComposeCustomRevision('')
    } catch {
      setComposeRevisionError('AI unavailable, try again')
    } finally {
      setComposeRevisionLoading(null)
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

      {/* Message — flex-1 so it grows to fill the space between the fixed
          header/recipients above and the fixed Draft-with-AI + footer below.
          min-h-0 lets it shrink below its content within the flex column (default
          min-height:auto would otherwise push the footer off screen), and
          overflow-y-auto keeps long drafts scrolling inside the textarea. */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your message..."
        className="min-h-0 flex-1 resize-none overflow-y-auto bg-transparent px-4 py-3 text-sm leading-[1.7] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
      />

      {/* Draft with AI — flex-shrink-0 so this section keeps its natural height
          and never squeezes the footer out; the textarea above absorbs the flex. */}
      <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3">
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

        {/* AI revision pills — shown only once an AI draft exists (composeAiDraft
            set). Styling + behavior mirror the reading-pane reply composer's
            revisionTools. NOTE: in this modal the message textarea sits ABOVE this
            Draft-with-AI block, so the "divider between pills and textarea" is the
            leading divider below (the pills' natural neighbour here is the AI
            input row above, and the textarea just above the section border). */}
        {composeAiDraft !== '' && (
          <div>
            {/* Divider separating the revision pills from the prompt input row */}
            <div className="my-3 h-px bg-[var(--border)]" />
            <div className="flex flex-wrap gap-2">
              {(['Make it shorter', 'Make it longer', 'More formal', 'More friendly', 'More direct', 'Regenerate ↺'] as const).map(label => {
                const isLoading = composeRevisionLoading === label
                const anyLoading = composeRevisionLoading !== null
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => runComposeRevision(label)}
                    disabled={anyLoading}
                    className={`cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-xs text-[var(--text2)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:cursor-not-allowed ${anyLoading && !isLoading ? 'opacity-50' : ''}`}
                  >
                    {isLoading ? '...' : label}
                  </button>
                )
              })}
            </div>
            {composeRevisionError && (
              <div className="mt-2 text-xs text-[var(--red)]">{composeRevisionError}</div>
            )}

            {/* Custom revision input — free-text instruction + Apply */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={composeCustomRevision}
                onChange={e => setComposeCustomRevision(e.target.value)}
                onKeyDown={e => {
                  if (
                    e.key === 'Enter' &&
                    composeCustomRevision.trim() !== '' &&
                    composeRevisionLoading === null
                  ) {
                    e.preventDefault()
                    runComposeRevision(composeCustomRevision, true)
                  }
                }}
                disabled={composeRevisionLoading !== null}
                placeholder="Tell AI what to change..."
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => runComposeRevision(composeCustomRevision, true)}
                disabled={composeCustomRevision.trim() === '' || composeRevisionLoading !== null}
                className="rounded-lg bg-[var(--red)] px-3 py-2 text-sm text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply →
              </button>
            </div>

            {/* Divider closing the revision section */}
            <div className="my-3 h-px bg-[var(--border)]" />
          </div>
        )}

        <div className="mt-1.5 text-xs text-[var(--text3)]">
          AI will write the email body. You can edit before sending.
        </div>
      </div>

      {/* Hidden file input — triggered by the paperclip button in the footer. */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleFileAttach}
      />

      {/* Attached files — listed above the footer. Rendered when there are
          attachments OR an attach error to show, so a rejected oversized file's
          message stays visible even when nothing was actually added. */}
      {(attachments.length > 0 || attachError !== '') && (
        <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs text-[var(--text2)]"
                >
                  <PaperclipIcon className="shrink-0 text-[var(--text3)]" />
                  <span className="max-w-[200px] truncate">{a.name}</span>
                  <span className="text-[var(--text3)]">{fmtSize(a.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${a.name}`}
                    className="text-[var(--text3)] transition-colors hover:text-[var(--text)]"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachError && (
            <div className={`text-xs text-[var(--red)] ${attachments.length > 0 ? 'mt-2' : ''}`}>
              {attachError}
            </div>
          )}
        </div>
      )}

      {/* Footer — flex-shrink-0 so Send + Discard stay pinned to the bottom and
          are always visible regardless of textarea / Draft-with-AI content. */}
      <div className="flex flex-shrink-0 items-center justify-between border-t-[0.5px] border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
          {/* Attach file — paperclip button (reading-pane action-button style) with
              the size hint directly below it. */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file (max 3MB each)"
              aria-label="Attach file (max 3MB each)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] p-2 text-[var(--text2)] transition-colors hover:text-[var(--text)]"
            >
              <PaperclipIcon />
            </button>
            <span className="text-xs text-[var(--text3)]">Max 3MB per file</span>
          </div>
        </div>
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
