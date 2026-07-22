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

export default function AgentPage({ params }: { params: { agent: string } }) {
  const agentSlug = params.agent
  const agent = ALL_AGENTS[agentSlug]

  // Slug → category (+ optional leader) used for uploads. Falls back to the slug.
  const agentCategory = AGENT_META[agentSlug]?.category ?? agentSlug
  const agentLeader = AGENT_META[agentSlug]?.leader

  // ── Live hub_memory file list + upload state ───────────────────────
  const [files, setFiles] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [filesLoading, setFilesLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      `}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        <div className="px-6 py-8" style={{ maxWidth: 1080, margin: '0 auto' }}>
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

          {/* ── Two columns: ~40% left / 60% right ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
            {/* ── LEFT PANEL ─────────────────────────────────── */}
            <div className="flex flex-col gap-4">
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
                      {files.slice(0, 4).map((f, i, shown) => (
                        <div
                          key={f.id}
                          className="bv-file rounded-lg px-2 py-2.5"
                          style={{ borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : 'none' }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="shrink-0" style={{ fontSize: 14, marginTop: 1 }}>
                              {sourceIcon(f.source_type)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                                {f.title}
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
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {files.length > 4 && (
                      <button
                        className="bv-edit text-[12px] font-medium mt-3 bg-transparent border-0 p-0"
                        style={{ color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        + {files.length - 4} more
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Agent instructions */}
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                    <span>⚙️</span> Agent instructions
                  </div>
                  <button
                    className="bv-edit inline-flex items-center gap-1.5 text-[12px] font-medium bg-transparent border-0 p-0"
                    style={{ color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span>✎</span> Edit
                  </button>
                </div>
                <div
                  className="rounded-lg p-3.5 text-[13px] leading-relaxed"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}
                >
                  {agent.instructions}
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL ────────────────────────────────── */}
            <div
              className="rounded-xl p-5 flex flex-col"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 520 }}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
                <span>💬</span> Ask the {agent.shortName} agent
              </div>

              {/* Sample question (user bubble, right-aligned) */}
              <div className="flex justify-end mb-3">
                <div
                  className="rounded-xl rounded-tr-sm px-3.5 py-2.5 text-[13px]"
                  style={{ background: 'var(--surface2)', color: 'var(--text)', maxWidth: '85%' }}
                >
                  {agent.sampleQuestion}
                </div>
              </div>

              {/* AI response card */}
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text)' }}>
                  {agent.answer.map((seg, i) =>
                    seg.link ? (
                      <span key={i} style={{ color: 'var(--purple)', fontWeight: 500 }}>
                        {seg.text}
                      </span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </p>
                <div
                  className="flex items-center gap-1.5 text-[11px] mt-3 pt-3"
                  style={{ color: 'var(--text3)', borderTop: '1px solid var(--border)' }}
                >
                  <span>🗂</span> Drawn from {agent.drawnFrom} files in memory
                </div>
              </div>

              {/* Input at bottom (visual only) */}
              <div className="mt-auto pt-4">
                <div
                  className="flex items-center gap-2 rounded-xl p-2"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                  <input
                    type="text"
                    placeholder={`Ask anything about ${agent.shortName}…`}
                    className="flex-1 bg-transparent border-0 outline-none text-[13px] px-2"
                    style={{ color: 'var(--text)', fontFamily: 'inherit' }}
                  />
                  <button
                    aria-label="Send"
                    className="bv-send shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 32, height: 32, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
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
