'use client'

// src/app/(app)/big-vision/[agent]/page.tsx
// Individual Big Vision agent page.
// The left "Files in memory" panel and the Upload button are wired to the live
// hub_memory API (/api/big-vision/files + /api/big-vision/upload).
// The right-hand AI chat panel is still VISUAL ONLY (hardcoded) — it gets wired
// in Phase C, so its static data below is intentionally left in place.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// ── Typography ───────────────────────────────────────────────────────
const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'

// ── Tag pill styles ──────────────────────────────────────────────────
// Category tags are solid-colored; leader (person) tags use each leader's
// avatar color; department tags are muted. Unknown keys fall back to muted
// in TagPill, so `tags` is a plain string[].
const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  // Category tags
  pit: { bg: 'var(--red)', color: '#fff' },
  alignment: { bg: 'var(--purple)', color: '#fff' },
  ai_hub: { bg: '#3B82F6', color: '#fff' },
  design: { bg: '#F59E0B', color: '#fff' },
  construction: { bg: '#0EA5E9', color: '#fff' },
  // Leader (person) tags — match each leader's avatar color
  jeff: { bg: 'var(--red)', color: '#fff' },
  lamont: { bg: '#2563eb', color: '#fff' },
  chad: { bg: '#059669', color: '#fff' },
  matteo: { bg: '#7c3aed', color: '#fff' },
  kaitlyn: { bg: '#d97706', color: '#fff' },
  // Department tags — muted
  sales: { bg: 'var(--surface2)', color: 'var(--text2)' },
  finance: { bg: 'var(--surface2)', color: 'var(--text2)' },
  operations: { bg: 'var(--surface2)', color: 'var(--text2)' },
  hr: { bg: 'var(--surface2)', color: 'var(--text2)' },
}

// ── Data model ───────────────────────────────────────────────────────
type Source = 'seed doc' | 'fireflies' | 'manual'

interface FileItem {
  name: string
  source: Source
  layer: number
  tags: string[]
}

// A segment of the AI response — plain text or a highlighted "link".
type Segment = { text: string; link?: boolean }

interface AgentData {
  slug: string
  icon: string
  name: string
  subtitle: string
  shortName: string
  files: FileItem[]
  moreCount: number
  instructions: string
  sampleQuestion: string
  answer: Segment[]
  drawnFrom: number
  // Leader-only fields — when set, the header renders an initials avatar +
  // role badge instead of the category emoji icon.
  isLeader?: boolean
  initials?: string
  initialsBg?: string
  role?: string
}

// ── Agents (hardcoded) ───────────────────────────────────────────────
const AGENTS: Record<string, AgentData> = {
  pit: {
    slug: 'pit',
    icon: '⚙️',
    name: 'Process Improvement (PIT)',
    subtitle: 'Every department has a clear PIT direction, reviewed quarterly',
    shortName: 'PIT',
    files: [
      { name: 'Process-Improvement-PIT.docx', source: 'seed doc', layer: 2, tags: ['pit'] },
      { name: 'Mateo 1:1 — 2026-07-15', source: 'fireflies', layer: 4, tags: ['pit', 'alignment'] },
      { name: 'Q2 PIT Review Notes', source: 'manual', layer: 3, tags: ['pit'] },
      { name: 'Pre-Con Standup — 2026-07-11', source: 'fireflies', layer: 4, tags: ['pit', 'ai_hub'] },
    ],
    moreCount: 4,
    instructions:
      'You are the PIT agent. Answer only from the files in this memory. Focus on each department’s PIT direction, its last-reviewed date, and how it compares to the company-level PIT focus (the AI Hub rollout). Flag anything not reviewed this quarter.',
    sampleQuestion: "What's Pre-construction's PIT focus right now, and when was it last reviewed?",
    answer: [
      { text: "Pre-construction's current PIT focus is " },
      { text: 'whole-team adoption of the pre-con hub', link: true },
      { text: ' — the company-level PIT direction for 2026–2028. It was last reviewed in ' },
      { text: "Mateo's 1:1 on July 15", link: true },
      { text: ', tracking toward the end-of-Q3 target.' },
    ],
    drawnFrom: 3,
  },
  'ai-hub': {
    slug: 'ai-hub',
    icon: '🤖',
    name: 'AI Hub Rollout',
    subtitle: 'Pre-con in progress · construction rollout next',
    shortName: 'AI Hub',
    files: [
      { name: 'AI-Hub-Rollout-Plan.docx', source: 'seed doc', layer: 2, tags: ['ai_hub'] },
      { name: 'Pre-Con Standup — 2026-07-11', source: 'fireflies', layer: 4, tags: ['ai_hub', 'pit'] },
      { name: 'Rollout Milestones — Q3', source: 'manual', layer: 3, tags: ['ai_hub'] },
      { name: 'Construction Kickoff — 2026-07-08', source: 'fireflies', layer: 4, tags: ['ai_hub', 'construction'] },
    ],
    moreCount: 7,
    instructions:
      'You are the AI Hub Rollout agent. Answer only from the files in this memory. Track rollout status by phase (pre-construction, then construction), the owners of each phase, and the next milestone dates. Flag any phase without a recent update.',
    sampleQuestion: "Where is the AI Hub rollout right now, and what's the next milestone?",
    answer: [
      { text: 'The AI Hub rollout is in the ' },
      { text: 'pre-construction adoption phase', link: true },
      { text: ', with the full pre-con team onboarded. The next milestone is the ' },
      { text: 'construction-team kickoff', link: true },
      { text: ', targeted for early Q4 once pre-con adoption is confirmed.' },
    ],
    drawnFrom: 3,
  },
  'design-center': {
    slug: 'design-center',
    icon: '🎨',
    name: 'Design Center',
    subtitle: 'Launch start of 2027 · timeline tracked',
    shortName: 'Design Center',
    files: [
      { name: 'Design-Center-Charter.docx', source: 'seed doc', layer: 2, tags: ['design'] },
      { name: 'DC Timeline Review — 2026-07-14', source: 'fireflies', layer: 4, tags: ['design', 'alignment'] },
      { name: 'Launch Readiness Notes', source: 'manual', layer: 3, tags: ['design'] },
      { name: 'Design Center Sync — 2026-07-09', source: 'fireflies', layer: 4, tags: ['design'] },
    ],
    moreCount: 5,
    instructions:
      'You are the Design Center agent. Answer only from the files in this memory. Track the launch timeline toward the start of 2027, key readiness milestones, and any dependencies. Flag anything slipping against the launch date.',
    sampleQuestion: "When does the Design Center launch, and is the timeline on track?",
    answer: [
      { text: 'The Design Center is targeted to launch at the ' },
      { text: 'start of 2027', link: true },
      { text: '. Current readiness is on track, with milestones reviewed in the ' },
      { text: 'DC timeline review on July 14', link: true },
      { text: '. No dependencies are flagged as slipping this quarter.' },
    ],
    drawnFrom: 3,
  },
  'dept-alignment': {
    slug: 'dept-alignment',
    icon: '👥',
    name: 'Dept Alignment',
    subtitle: 'Mateo draft sent · others rolling out',
    shortName: 'Dept Alignment',
    files: [
      { name: 'Dept-Alignment-Framework.docx', source: 'seed doc', layer: 2, tags: ['alignment'] },
      { name: 'Mateo 1:1 — 2026-07-15', source: 'fireflies', layer: 4, tags: ['alignment', 'pit'] },
      { name: 'Alignment Draft — Operations', source: 'manual', layer: 3, tags: ['alignment'] },
      { name: 'Leadership Sync — 2026-07-10', source: 'fireflies', layer: 4, tags: ['alignment', 'hr'] },
    ],
    moreCount: 10,
    instructions:
      'You are the Dept Alignment agent. Answer only from the files in this memory. Track which department alignment drafts have been sent, which are still rolling out, and how each maps back to the company direction. Flag any department without a draft in progress.',
    sampleQuestion: "Which department alignment drafts are done, and which are still pending?",
    answer: [
      { text: "Mateo's Operations alignment draft has been " },
      { text: 'sent and is under review', link: true },
      { text: '. The remaining departments are ' },
      { text: 'still rolling out', link: true },
      { text: ', with drafts in progress and reviewed in the July 10 leadership sync.' },
    ],
    drawnFrom: 3,
  },
}

// ── Leaders ──────────────────────────────────────────────────────────
// Each leader reuses the category-agent layout. `fileCount` is the total in
// memory (shown on the main page card); the detail page lists up to 4 named
// files and rolls the rest into "+ N more".
interface LeaderDef {
  slug: string
  first: string
  name: string
  initials: string
  bg: string
  role: string
  dept: string
  desc: string
  fileCount: number
  instructions: string
  question: string
  answer: string
}

const LEADER_DEFS: LeaderDef[] = [
  {
    slug: 'jeff',
    first: 'Jeff',
    name: 'Jeff Azcona',
    initials: 'JA',
    bg: 'var(--red)',
    role: 'VP Sales',
    dept: 'sales',
    desc: 'Sales pipeline · revenue targets',
    fileCount: 6,
    instructions:
      "You are Jeff's intelligence agent. Answer from his files. Focus on sales pipeline health, revenue tracking, and how to communicate effectively with Jeff (high D/I). Flag any pipeline risks.",
    question: "What's the current sales pipeline status and are we on track for Q3 target?",
    answer:
      'The sales pipeline currently shows 3 active prospects in final stages. Q3 target is tracking at 78% — slightly behind the 85% milestone set for mid-July. The Smith project close is the key variable this month.',
  },
  {
    slug: 'lamont',
    first: 'Lamont',
    name: 'Lamont Gilyot',
    initials: 'LG',
    bg: '#2563eb',
    role: 'VP Finance',
    dept: 'finance',
    desc: 'Cash position · budget variance',
    fileCount: 5,
    instructions:
      "You are Lamont's intelligence agent. Answer from his files. Focus on financial health, cash position, and how to communicate with Lamont (high D/C). Lead with data. Flag budget variances.",
    question: "What's the current cash position and are there any budget concerns this month?",
    answer:
      'Cash position is stable at approximately $2.1M operating reserve. One budget variance flagged — Design Center soft costs running 12% over estimate. Recommended: review in this week’s Finance alignment.',
  },
  {
    slug: 'chad',
    first: 'Chad',
    name: 'Chad Holman',
    initials: 'CH',
    bg: '#059669',
    role: 'VP Operations',
    dept: 'operations',
    desc: 'WIP status · operational blockers',
    fileCount: 4,
    instructions:
      "You are Chad's intelligence agent. Answer from his files. Focus on operational health, WIP status, and how to communicate with Chad. Flag blockers.",
    question: "What's the WIP status and are there any operational blockers I should know about?",
    answer:
      'WIP shows 4 active builds, all within timeline. One operational blocker flagged — permit delay on the Anderson project pushing completion by 2 weeks. No other critical blockers.',
  },
  {
    slug: 'matteo',
    first: 'Matteo',
    name: 'Matteo Carpani',
    initials: 'MC',
    bg: '#7c3aed',
    role: 'Ops Manager',
    dept: 'operations',
    desc: 'Active projects · client journey',
    fileCount: 7,
    instructions:
      "You are Matteo's intelligence agent. Answer from his files. Focus on active client projects, customer journey completion rates, and how to communicate with Matteo. Flag at-risk clients.",
    question: 'How are active client projects tracking and any at-risk clients?',
    answer:
      '3 active clients in customer journey. Smith at Step 16 is at risk — contract review overdue by 5 days. Anderson and Rahim are on track.',
  },
  {
    slug: 'kaitlyn',
    first: 'Kaitlyn',
    name: 'Kaitlyn Grunenberg',
    initials: 'KG',
    bg: '#d97706',
    role: 'VP HR',
    dept: 'hr',
    desc: 'Team alignment · hiring pipeline',
    fileCount: 3,
    instructions:
      "You are Kaitlyn's intelligence agent. Answer from her files. Focus on team alignment, HR pipeline, and how to communicate with Kaitlyn. Flag people concerns.",
    question: 'Any HR concerns or hiring pipeline updates this week?',
    answer:
      'No critical HR concerns this week. Hiring pipeline has 2 candidates in final interview for the PM role. Team alignment scores from last survey averaged 4.2/5.',
  },
]

function buildLeader(d: LeaderDef): AgentData {
  // The four standard leader files; sliced to fileCount so the card total and
  // the visible list stay consistent (e.g. Kaitlyn has 3 files → show 3).
  const standard: FileItem[] = [
    { name: 'DISC Report', source: 'manual', layer: 2, tags: [d.slug, d.dept] },
    { name: 'Goals 2026', source: 'manual', layer: 3, tags: [d.slug, d.dept] },
    { name: 'Past Meeting Notes', source: 'fireflies', layer: 4, tags: [d.slug, d.dept] },
    { name: 'Communication Style', source: 'manual', layer: 2, tags: [d.slug, d.dept] },
  ]
  const shown = Math.min(standard.length, d.fileCount)
  return {
    slug: d.slug,
    icon: '',
    name: d.name,
    subtitle: d.desc,
    shortName: d.first,
    files: standard.slice(0, shown),
    moreCount: Math.max(0, d.fileCount - shown),
    instructions: d.instructions,
    sampleQuestion: d.question,
    answer: [{ text: d.answer }],
    drawnFrom: Math.min(3, shown),
    isLeader: true,
    initials: d.initials,
    initialsBg: d.bg,
    role: d.role,
  }
}

const LEADER_AGENTS: Record<string, AgentData> = Object.fromEntries(
  LEADER_DEFS.map((d) => [d.slug, buildLeader(d)]),
)

// Category agents + leader agents share the single [agent] dynamic route.
const ALL_AGENTS: Record<string, AgentData> = { ...AGENTS, ...LEADER_AGENTS }

// ── Icons ────────────────────────────────────────────────────────────
// Icon for a real hub_memory source_type ('fireflies' | 'seed_doc' | 'manual' |
// 'meeting_note'). Fireflies transcripts get a mic; everything else a document.
function sourceIcon(sourceType: string): string {
  return sourceType === 'fireflies' ? '🎤' : '📄'
}

// Format an ISO timestamp as "Jul 21, 2026".
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// A fireflies file links to its source session only when source_ref is a valid UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Agent slug → hub_category (+ optional leader) ─────────────────────
// Mirrors the mapping the /api/big-vision/files + /api/big-vision/upload routes
// expect. Unknown slugs fall back to the slug itself as the category.
const AGENT_META: Record<string, { category: string; leader?: string }> = {
  pit: { category: 'pit' },
  'ai-hub': { category: 'ai_hub' },
  'design-center': { category: 'design_center' },
  'dept-alignment': { category: 'alignment' },
  jeff: { category: 'jeff', leader: 'Jeff' },
  lamont: { category: 'lamont', leader: 'Lamont' },
  chad: { category: 'chad', leader: 'Chad' },
  matteo: { category: 'matteo', leader: 'Matteo' },
  kaitlyn: { category: 'kaitlyn', leader: 'Kaitlyn' },
}

// ── Quick-action chat pills ──────────────────────────────────────────
// Shown above the input only before the first message. Universal prompts apply to
// every agent; the agent-specific set is appended per slug.
const UNIVERSAL_PILLS = [
  "Prepare me for today's meeting",
  "What's the latest status?",
  'What are the open action items?',
  'How should Calin approach this?',
]

const AGENT_PILLS: Record<string, string[]> = {
  pit: ["What's our PIT focus this quarter?", "Who hasn't reviewed PIT yet?"],
  'ai-hub': ['Where are we on the rollout?', "What's blocking construction phase?"],
  'design-center': ['Is the 2027 launch on track?', 'Any timeline risks?'],
  'dept-alignment': ["Who's on a Dev Plan?", 'Who needs follow-up?'],
  jeff: ["What's the sales pipeline status?", 'Are we on track for Q3 target?'],
  lamont: ["What's the cash position?", 'Any budget concerns?'],
  chad: ["What's the WIP status?", 'Any operational blockers?'],
  matteo: ['How are active clients tracking?', 'Any at-risk clients?'],
  kaitlyn: ['Any HR concerns this week?', "What's the hiring pipeline?"],
}

// ── Lightweight markdown → HTML for assistant messages ───────────────
// react-markdown is not a project dependency and packages can't be added here, so
// this handles the small subset Claude emits (bold, italic, ## / ### headers,
// bullet lists, paragraph breaks). Content is HTML-ESCAPED first — the result goes
// through dangerouslySetInnerHTML, so raw `<`/`>`/`&` must never reach the DOM as
// markup (prevents injection from anything the model echoes back).
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const html = escaped
    // H2 → h3 (block heading)
    .replace(/^## (.*)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1" style="color:var(--text)">$1</h3>')
    // H3 → styled paragraph label
    .replace(/^### (.*)$/gm, '<p class="font-medium text-sm mt-2 mb-1" style="color:var(--text2)">$1</p>')
    // Bullet points
    .replace(/^- (.*)$/gm, '<li class="ml-4 text-sm" style="color:var(--text)">• $1</li>')
    // Bold, then italic (bold consumes ** first so lone * become italic)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Paragraph breaks, then single line breaks
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')

  return `<p>${html}</p>`
}

export default function AgentPage({ params }: { params: { agent: string } }) {
  const agentSlug = params.agent
  const agent = ALL_AGENTS[agentSlug]

  // Slug → category (+ optional leader) used for uploads. Falls back to the slug.
  const agentCategory = AGENT_META[agentSlug]?.category ?? agentSlug
  const agentLeader = AGENT_META[agentSlug]?.leader

  // Quick-action pills: universal set + this agent's specific prompts.
  const quickPills = [...UNIVERSAL_PILLS, ...(AGENT_PILLS[agentSlug] ?? [])]

  // ── Live hub_memory file list + upload state ───────────────────────
  const [files, setFiles] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [filesLoading, setFilesLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Per-file delete state ──────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── File list expand/collapse ──────────────────────────────────────
  const [filesExpanded, setFilesExpanded] = useState(false)
  const VISIBLE_FILES = 4
  const visibleFiles = filesExpanded ? files : files.slice(0, VISIBLE_FILES)
  const hiddenCount = files.length - VISIBLE_FILES

  // ── Agent chat state ───────────────────────────────────────────────
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; filesUsed?: number }>
  >([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── @mention file dropdown ─────────────────────────────────────────
  // mentionQuery is null when no @mention is in progress; '' right after the user
  // types "@"; and the partial text as they keep typing. Spec called for an
  // HTMLTextAreaElement ref, but the input below is an <input> — ref typed to match
  // (only .focus() is used, so behavior is identical).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Files the user has selected as @mentions. Tracked separately from the input
  // text: selecting a file removes the "@query" from the input and adds it here, so
  // mentions render as pills instead of living as literal text in the input.
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{
      id: string
      title: string
      meeting_date: string | null
      created_at: string
    }>
  >([])

  // Files whose title matches the in-progress @mention (max 50). Empty when no
  // mention is being typed.
  const mentionResults =
    mentionQuery !== null
      ? files
          .filter((f) => f.title?.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 50)
      : []

  // Files currently @mentioned — now driven by the selectedMentions state (pills)
  // rather than by parsing the input text.
  const activeMentions = selectedMentions

  // ── Resizable divider between the two panels ───────────────────────
  const [leftWidth, setLeftWidth] = useState(38) // percentage of the container width
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)

  // Right-panel full-width toggle: hides the left panel + divider when true.
  const [rightExpanded, setRightExpanded] = useState(false)

  // Fetch this agent's files on mount / when the slug changes.
  useEffect(() => {
    let cancelled = false
    async function loadFiles() {
      setFilesLoading(true)
      try {
        const res = await fetch(`/api/big-vision/files?agent=${agentSlug}`)
        const data = await res.json()
        if (!cancelled && data.files) setFiles(data.files)
      } catch {
        // Network/parse failure — leave files empty; the empty state renders.
      } finally {
        if (!cancelled) setFilesLoading(false)
      }
    }
    loadFiles()
    return () => {
      cancelled = true
    }
  }, [agentSlug])

  // Keep the chat scrolled to the newest message / typing indicator.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Restore the saved panel split on mount.
  useEffect(() => {
    const saved = localStorage.getItem('bv-panel-width')
    if (saved) setLeftWidth(parseFloat(saved))
  }, [])

  // Persist the panel split whenever it changes.
  useEffect(() => {
    localStorage.setItem('bv-panel-width', leftWidth.toString())
  }, [leftWidth])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^.]+$/, ''))
      formData.append('categories', agentCategory)
      formData.append('layer', '4')
      formData.append('source_type', 'manual')
      if (agentLeader) {
        formData.append('leader', agentLeader)
      }

      const res = await fetch('/api/big-vision/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setUploadSuccess('File uploaded!')
        // Refresh the file list from the server.
        const filesRes = await fetch(`/api/big-vision/files?agent=${agentSlug}`)
        const data = await filesRes.json()
        if (data.files) setFiles(data.files)
        setTimeout(() => setUploadSuccess(''), 3000)
      } else {
        setUploadError('Upload failed. Try again.')
      }
    } catch {
      setUploadError('Upload failed. Try again.')
    } finally {
      setUploadingFile(false)
      // Reset the input so re-selecting the same file re-triggers onChange.
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Send a chat message to the agent. `overrideText` lets the quick-action pills
  // send their prompt directly — setChatInput is async, so relying on chatInput
  // right after setting it would send a stale (empty) value.
  async function sendMessage(overrideText?: string) {
    const userMessage = (overrideText ?? chatInput).trim()
    if (!userMessage || chatLoading) return

    // Prepend the selected @mentions to the question so the API forces those files
    // into context (the chat route detects "@<title>" in the question).
    const questionWithMentions =
      selectedMentions.length > 0
        ? selectedMentions.map((m) => `@${m.title}`).join(' ') + ' ' + userMessage
        : userMessage
    const mentionedFileIds = selectedMentions.map((m) => m.id)

    setChatInput('')
    setMentionQuery(null) // close the @mention dropdown if it was open
    setSelectedMentions([]) // clear the mention pills after sending
    setChatError('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const res = await fetch('/api/big-vision/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentSlug,
          question: questionWithMentions,
          mentionedFileIds,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, filesUsed: data.filesUsed },
        ])
      } else {
        setChatError('Failed to get response. Try again.')
      }
    } catch {
      setChatError('Connection error. Try again.')
    } finally {
      setChatLoading(false)
    }
  }

  // Selecting a file: strip the in-progress "@query" from the input and add the
  // file to selectedMentions (a pill). The mention no longer lives in the input
  // text — it's carried in state and prepended to the question on send.
  function selectMention(file: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Remove the @query from the input.
    const val = chatInput
    const atIndex = val.lastIndexOf('@')
    const cleanInput = atIndex === -1 ? val.trim() : val.slice(0, atIndex).trim()
    setChatInput(cleanInput)

    // Add to selected mentions (avoid duplicates by id).
    setSelectedMentions((prev) => {
      if (prev.find((m) => m.id === file.id)) return prev
      return [
        ...prev,
        {
          id: file.id,
          title: file.title,
          meeting_date: file.meeting_date ?? null,
          created_at: file.created_at,
        },
      ]
    })

    setMentionQuery(null)
    setMentionIndex(0)
    inputRef.current?.focus()
  }

  // Soft-delete a file, then drop it from local state on success.
  async function handleDelete(id: string, _fileTitle: string) {
    setDeletingId(id)
    setConfirmDeleteId(null)

    try {
      const res = await fetch('/api/big-vision/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id))
      } else {
        console.error('Delete failed')
      }
    } catch {
      console.error('Delete error')
    } finally {
      setDeletingId(null)
    }
  }

  // Begin dragging the divider. Tracks the pointer on `document` (not the divider)
  // so the drag continues even when the cursor moves off the 4px handle.
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    setIsDragging(true)

    const container = containerRef.current
    if (!container) return

    const startX = e.clientX
    const startWidth = leftWidth
    const containerWidth = container.getBoundingClientRect().width

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX
      const newWidth = startWidth + (delta / containerWidth) * 100
      setLeftWidth(Math.min(60, Math.max(20, newWidth)))
    }

    function onMouseUp() {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // Reset divider color
      if (dividerRef.current) {
        dividerRef.current.style.background = 'var(--border)'
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Hooks above run unconditionally; bail out for unknown agents afterwards.
  if (!agent) notFound()

  return (
    <>
      <style>{`
        .bv-file { transition: background 130ms ease; }
        .bv-file:hover { background: var(--surface2); }
        .bv-upload { transition: opacity 150ms ease; }
        .bv-upload:hover { opacity: 0.9; }
        .bv-back { transition: color 150ms ease; }
        .bv-back:hover { color: var(--text); }
        .bv-send { transition: opacity 150ms ease; }
        .bv-send:hover { opacity: 0.9; }
        .bv-icon-btn:hover { background: var(--surface2); color: var(--text2); }
        .bv-edit:hover { color: var(--text); }
        .bv-pill { transition: background 130ms ease, color 130ms ease; }
        .bv-pill:not(:disabled):hover { background: var(--surface); color: var(--text); }
        .bv-trash { transition: opacity 130ms ease, color 130ms ease; }
        .bv-trash:hover { color: var(--red); }
      `}</style>

      <div className="flex-1 min-h-0 overflow-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        {/* When the right panel is expanded, drop the 1080px cap + page padding so the
            chat goes edge-to-edge of the content area; otherwise keep the centered layout. */}
        <div
          className={`h-full flex flex-col min-h-0${rightExpanded ? '' : ' px-6 py-8'}`}
          style={{ width: '100%', maxWidth: rightExpanded ? '100%' : 1080, margin: '0 auto' }}
        >
          {/* ── Back ───────────────────────────────────────────── */}
          <Link
            href="/big-vision"
            className="bv-back inline-flex items-center gap-1.5 text-[13px] font-medium no-underline mb-5"
            style={{ color: 'var(--text3)' }}
          >
            ← Big Vision
          </Link>

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h1
                className="flex items-center gap-3"
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 30,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {agent.isLeader ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full shrink-0 text-white font-bold"
                    style={{
                      width: 40,
                      height: 40,
                      background: agent.initialsBg,
                      fontSize: 15,
                      letterSpacing: '0.3px',
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {agent.initials}
                  </span>
                ) : (
                  <span style={{ fontSize: 24 }}>{agent.icon}</span>
                )}
                {agent.name}
                {agent.isLeader && agent.role && (
                  <span
                    className="rounded-full font-semibold"
                    style={{
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontSize: 11,
                      padding: '3px 9px',
                      background: 'var(--surface2)',
                      color: 'var(--text2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {agent.role}
                  </span>
                )}
              </h1>
              <p className="text-[14px] mt-2" style={{ color: 'var(--text2)' }}>
                {agent.subtitle}
              </p>
            </div>
            <span
              className="shrink-0 inline-flex items-center rounded-full text-[10px] font-bold uppercase mt-1"
              style={{
                letterSpacing: '0.6px',
                padding: '3px 10px',
                background: 'var(--pill-green-bg)',
                color: 'var(--pill-green-color)',
                border: '1px solid var(--pill-green-border)',
              }}
            >
              Live
            </span>
          </div>

          {/* ── Resizable two-panel layout ─────────────────────── */}
          {/* Was a fixed 2-col grid; now a flex row split by a draggable divider.
              flex-1 + min-h-0 fill the fixed page height (used instead of the spec's
              height:100% because the back-link + header sit above this row in the same
              flex column). Container cursor flips to col-resize during a drag. */}
          <div
            ref={containerRef}
            className="flex-1 min-h-0"
            style={{ display: 'flex', width: '100%', flex: 1, cursor: isDragging ? 'col-resize' : 'default' }}
          >
            {/* ── LEFT PANEL ─────────────────────────────────── */}
            {/* min-h-0 + overflow-y-auto → the Files-in-memory panel scrolls inside
                the fixed column height instead of growing the page. Width is the
                draggable split (clamped 20–60% in startDrag; minWidth is a px floor). */}
            <div
              className="flex flex-col gap-4 min-h-0 overflow-y-auto"
              style={{
                width: `${leftWidth}%`,
                minWidth: '240px',
                maxWidth: '60%',
                display: rightExpanded ? 'none' : 'flex',
              }}
            >
              {/* Files in memory */}
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                    <span>🗂</span> Files in memory
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="bv-upload inline-flex items-center gap-1.5 rounded-lg text-[12px] font-semibold"
                    style={{
                      padding: '6px 12px',
                      background: 'var(--red)',
                      color: '#fff',
                      border: 'none',
                      cursor: uploadingFile ? 'default' : 'pointer',
                      opacity: uploadingFile ? 0.7 : 1,
                    }}
                  >
                    <span>↑</span> {uploadingFile ? 'Uploading…' : 'Upload'}
                  </button>
                </div>

                {/* Hidden file input — opened by the Upload button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={handleFileUpload}
                />

                {/* Upload status */}
                {uploadError && (
                  <div className="text-xs mb-2" style={{ color: 'var(--red)' }}>
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="text-xs mb-2" style={{ color: '#059669' }}>
                    {uploadSuccess}
                  </div>
                )}

                {/* File list — live hub_memory rows */}
                {filesLoading ? (
                  // Loading: 3 skeleton rows
                  <div className="-mx-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse px-2 py-2.5"
                        style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="shrink-0 rounded" style={{ width: 14, height: 14, marginTop: 1, background: 'var(--surface2)' }} />
                          <div className="min-w-0 flex-1">
                            <div className="rounded" style={{ height: 12, width: '60%', background: 'var(--surface2)' }} />
                            <div className="rounded mt-2" style={{ height: 10, width: '35%', background: 'var(--surface2)' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  // Empty state
                  <div className="text-sm italic px-2 py-4" style={{ color: 'var(--text3)' }}>
                    No files yet. Upload the first file to get started.
                  </div>
                ) : (
                  // Real files (first 4)
                  <>
                    <div className="-mx-2">
                      {visibleFiles.map((f, i) => {
                        const linkable =
                          f.source_type === 'fireflies' && !!f.source_ref && UUID_RE.test(f.source_ref)
                        return (
                        <div
                          key={f.id}
                          className="group bv-file rounded-lg px-2 py-2.5"
                          style={{ borderBottom: i < visibleFiles.length - 1 ? '1px solid var(--border)' : 'none' }}
                        >
                          {confirmDeleteId === f.id ? (
                            // Confirmation UI (replaces the row while confirming)
                            <div
                              className="rounded-lg p-3"
                              style={{
                                background: 'var(--surface2)',
                                border: '1px solid color-mix(in srgb, var(--red) 50%, transparent)',
                              }}
                            >
                              <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                                🗑 Delete &ldquo;{f.title.length > 30 ? `${f.title.slice(0, 30)}…` : f.title}&rdquo;?
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                                This cannot be undone.
                              </div>
                              <div className="flex items-center justify-end gap-3 mt-3">
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs bg-transparent border-0 p-0"
                                  style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDelete(f.id, f.title)}
                                  disabled={deletingId === f.id}
                                  className="text-xs rounded px-2 py-1"
                                  style={{
                                    background: 'var(--red)',
                                    color: '#fff',
                                    border: 'none',
                                    fontFamily: 'inherit',
                                    cursor: deletingId === f.id ? 'default' : 'pointer',
                                    opacity: deletingId === f.id ? 0.5 : 1,
                                  }}
                                >
                                  {deletingId === f.id ? 'Deleting…' : 'Yes, delete'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2.5">
                              <span className="shrink-0" style={{ fontSize: 14, marginTop: 1 }}>
                                {sourceIcon(f.source_type)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                                  {linkable ? (
                                    <Link
                                      href={`/sessions/${f.source_ref}`}
                                      className="underline decoration-dotted"
                                      style={{ color: 'var(--text)' }}
                                    >
                                      {f.title}
                                    </Link>
                                  ) : (
                                    f.title
                                  )}
                                </div>
                                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-1">
                                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                                    {f.source_type} · layer {f.layer}
                                  </span>
                                  {(f.categories ?? []).map((t: string) => (
                                    <TagPill key={t} tag={t} />
                                  ))}
                                  {f.leader && (
                                    <span
                                      className="rounded-full text-xs px-2 py-0.5 font-medium"
                                      style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: 10.5, lineHeight: 1.4 }}
                                    >
                                      {f.leader}
                                    </span>
                                  )}
                                </div>
                                {(f.meeting_date || f.created_at) && (
                                  <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                                    {fmtDate(f.meeting_date || f.created_at)}
                                  </div>
                                )}
                              </div>
                              {/* Delete — visible on row hover */}
                              <button
                                onClick={() => setConfirmDeleteId(f.id)}
                                aria-label="Delete file"
                                className="bv-trash shrink-0 opacity-0 group-hover:opacity-100 bg-transparent border-0 p-0"
                                style={{ color: 'var(--text3)', cursor: 'pointer', marginTop: 1 }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        )
                      })}
                    </div>

                    {hiddenCount > 0 && !filesExpanded && (
                      <button
                        onClick={() => setFilesExpanded(true)}
                        className="bv-edit text-xs mt-2 block text-center w-full bg-transparent border-0 p-0"
                        style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        + {hiddenCount} more ↓
                      </button>
                    )}
                    {filesExpanded && (
                      <button
                        onClick={() => setFilesExpanded(false)}
                        className="bv-edit text-xs mt-2 block text-center w-full bg-transparent border-0 p-0"
                        style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Show less ↑
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* ── DIVIDER (drag to resize · double-click to reset) ─ */}
            <div
              ref={dividerRef}
              onMouseDown={startDrag}
              onDoubleClick={() => setLeftWidth(38)}
              style={{
                position: 'relative',
                width: '4px',
                background: 'var(--border)',
                cursor: 'col-resize',
                flexShrink: 0,
                transition: isDragging ? 'none' : 'background 0.15s',
                display: rightExpanded ? 'none' : 'block',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--red)'
              }}
              onMouseLeave={(e) => {
                if (!isDragging) e.currentTarget.style.background = 'var(--border)'
              }}
            >
              {/* Center grip hint — three subtle dots */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '2px',
                      height: '2px',
                      borderRadius: '50%',
                      background: 'var(--text3)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ── RIGHT PANEL ────────────────────────────────── */}
            {/* min-h-0 lets the inner flex-1 messages area shrink and scroll; the panel
                fills the remaining width (flex:1) with a 300px floor, no minHeight so it
                never forces page scroll. */}
            <div
              className="rounded-xl p-5 flex flex-col min-h-0"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                flex: 1,
                width: rightExpanded ? '100%' : undefined,
                minWidth: '300px',
                overflow: 'hidden',
              }}
            >
              <div className="flex items-center justify-between gap-2 text-[14px] font-semibold mb-4 shrink-0" style={{ color: 'var(--text)' }}>
                <span className="flex items-center gap-2">
                  <span>💬</span> Ask the {agent.shortName} agent
                </span>
                <button
                  onClick={() => setRightExpanded(!rightExpanded)}
                  title={rightExpanded ? 'Collapse chat' : 'Expand chat'}
                  aria-label={rightExpanded ? 'Collapse chat' : 'Expand chat'}
                  className="text-sm cursor-pointer bg-transparent border-0 p-0"
                  style={{ color: 'var(--text3)', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text3)'
                  }}
                >
                  {rightExpanded ? '⤡' : '⤢'}
                </button>
              </div>

              {/* ── Chat messages area (fills space, scrolls) ────── */}
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {messages.length === 0 ? (
                  // Clean empty state — no fake sample Q&A. Centered agent identity,
                  // a subtitle, and the quick-action pills.
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                    {agent.isLeader ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full text-white font-bold mb-3"
                        style={{ width: 44, height: 44, background: agent.initialsBg, fontSize: 16 }}
                      >
                        {agent.initials}
                      </span>
                    ) : (
                      <span className="mb-3" style={{ fontSize: 32, lineHeight: 1 }}>
                        {agent.icon}
                      </span>
                    )}
                    <div className="text-sm" style={{ color: 'var(--text2)' }}>
                      Ask {agent.shortName} agent anything
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                      CASK Intelligence · Claude · {files.length} files in memory
                    </div>

                    {/* Quick-action pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                      {quickPills.map((p) => (
                        <button
                          key={p}
                          onClick={() => sendMessage(p)}
                          disabled={chatLoading}
                          className="bv-pill rounded-full px-3 py-1.5 text-xs"
                          style={{
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text2)',
                            cursor: chatLoading ? 'default' : 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Real conversation.
                  <div className="flex flex-col gap-3">
                    {messages.map((m, i) =>
                      m.role === 'user' ? (
                        <div
                          key={i}
                          className="rounded-xl px-4 py-3 text-sm max-w-[85%] ml-auto"
                          style={{ background: 'var(--surface2)', color: 'var(--text)' }}
                        >
                          {m.content}
                        </div>
                      ) : (
                        <div key={i} className="max-w-[95%]">
                          <div
                            className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                          />
                          {typeof m.filesUsed === 'number' && m.filesUsed > 0 && (
                            <div className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
                              🗂 Drawn from {m.filesUsed} files in memory
                            </div>
                          )}
                        </div>
                      ),
                    )}

                    {/* Typing indicator */}
                    {chatLoading && (
                      <div className="max-w-[95%]">
                        <div
                          className="rounded-xl px-4 py-3 text-sm inline-flex items-center gap-2"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text3)' }}
                        >
                          <span className="inline-flex gap-1">
                            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: 'var(--text3)' }} />
                            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: 'var(--text3)', animationDelay: '150ms' }} />
                            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: 'var(--text3)', animationDelay: '300ms' }} />
                          </span>
                          Thinking…
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Error */}
              {chatError && (
                <div className="text-xs mt-2" style={{ color: 'var(--red)' }}>
                  {chatError}
                </div>
              )}

              {/* ── Input area (bottom) ──────────────────────────── */}
              {/* position:relative so the @mention dropdown can anchor above it. */}
              <div className="mt-auto pt-4 shrink-0" style={{ position: 'relative' }}>
                {/* ── @mention file dropdown (floats above the input) ── */}
                {mentionResults.length > 0 && (
                  <div
                    className="rounded-xl overflow-hidden shadow-lg max-h-[240px] overflow-y-auto z-50"
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="text-xs px-3 py-2"
                      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
                    >
                      Files in memory
                    </div>
                    {mentionResults.map((f, index) => (
                      <div
                        key={f.id}
                        onClick={() => selectMention(f)}
                        onMouseEnter={() => setMentionIndex(index)}
                        className="px-3 py-2 cursor-pointer flex items-center gap-2"
                        style={{ background: index === mentionIndex ? 'var(--surface2)' : 'transparent' }}
                      >
                        <span className="shrink-0" style={{ fontSize: 14 }}>
                          {sourceIcon(f.source_type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                            {f.title}
                          </div>
                          {(f.meeting_date || f.created_at) && (
                            <div className="text-xs" style={{ color: 'var(--text3)' }}>
                              {fmtDate(f.meeting_date || f.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Active @mention pills (which files are attached) ── */}
                {/* A plain <input> can't style inline text, so mentioned files are
                    shown as removable indigo pills just above the input. */}
                {activeMentions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                    {activeMentions.map((f) => (
                      <span
                        key={f.id}
                        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.4)',
                          color: '#818cf8',
                        }}
                      >
                        📎 {f.title}
                        <button
                          // Remove this file from the selected mentions.
                          onClick={() => setSelectedMentions((prev) => prev.filter((m) => m.id !== f.id))}
                          aria-label={`Remove ${f.title} mention`}
                          className="bg-transparent border-0 p-0 cursor-pointer"
                          style={{ color: '#818cf8', marginLeft: 2, fontFamily: 'inherit' }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className="flex items-center gap-2 rounded-xl p-2"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                  <input
                    type="text"
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setChatInput(val)

                      // Detect an in-progress @mention based on the last "@".
                      const atIndex = val.lastIndexOf('@')
                      if (atIndex !== -1 && atIndex === val.length - 1) {
                        // Just typed "@" — show all files.
                        setMentionQuery('')
                        setMentionIndex(0)
                      } else if (atIndex !== -1) {
                        const afterAt = val.slice(atIndex + 1)
                        // Keep the dropdown open while still typing the mention
                        // (no space yet, or short enough to still be one token).
                        if (!afterAt.includes(' ') || afterAt.length < 30) {
                          setMentionQuery(afterAt)
                          setMentionIndex(0)
                        } else {
                          setMentionQuery(null)
                        }
                      } else {
                        setMentionQuery(null)
                      }
                    }}
                    onKeyDown={(e) => {
                      // When the mention dropdown is open, arrows/Enter/Tab/Escape
                      // drive it instead of sending the message.
                      if (mentionResults.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setMentionIndex((prev) => Math.min(prev + 1, mentionResults.length - 1))
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setMentionIndex((prev) => Math.max(prev - 1, 0))
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          selectMention(mentionResults[mentionIndex])
                          return
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setMentionQuery(null)
                          return
                        }
                      }

                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={`Ask anything about ${agent.shortName}…`}
                    className="flex-1 bg-transparent border-0 outline-none text-[13px] px-2"
                    style={{
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      // Subtle accent when files are @mentioned. Inline style wins
                      // over the `border-0` class.
                      borderLeft: activeMentions.length > 0 ? '2px solid #818cf8' : 'none',
                    }}
                  />
                  <button
                    aria-label="Send"
                    onClick={() => sendMessage()}
                    disabled={chatLoading || chatInput.trim() === ''}
                    className="bv-send shrink-0 rounded-lg flex items-center justify-center"
                    style={{
                      width: 32,
                      height: 32,
                      background: 'var(--red)',
                      color: '#fff',
                      border: 'none',
                      cursor: chatLoading || chatInput.trim() === '' ? 'default' : 'pointer',
                      opacity: chatLoading || chatInput.trim() === '' ? 0.6 : 1,
                    }}
                  >
                    {chatLoading ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Tag pill ─────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  const s = TAG_STYLES[tag] ?? { bg: 'var(--surface2)', color: 'var(--text2)' }
  return (
    <span
      className="rounded-full text-xs px-2 py-0.5 font-medium"
      style={{ background: s.bg, color: s.color, fontSize: 10.5, lineHeight: 1.4 }}
    >
      {tag}
    </span>
  )
}
