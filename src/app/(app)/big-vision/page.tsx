'use client'

// src/app/(app)/big-vision/page.tsx
// Big Vision — one shared memory that feeds every agent.
//
// VISUAL REBUILD ONLY (big-vision-premium.html mockup). Every hook, every fetch,
// every state variable and handleFoundationUpload are unchanged from the previous
// version — only JSX structure, CSS, fonts, colours and spacing were rewritten.
//
// Scoping note: the mockup's CSS variable names (--bg, --card, --line, --ink…)
// collide with the Hub's own tokens in globals.css, so every rule below is
// prefixed with `.bv-root` and the variables are redefined on that div. Nothing
// leaks out of this page's subtree. Same pattern as the precon page.
//
// The mockup's left rail is NOT ported — the Hub's Sidebar already occupies that
// column via src/app/(app)/layout.tsx, so the mockup's --rail (#0D0C0B) is unused
// here by design. Only the mockup's <main class="page"> is reproduced.
//
// Theme follows the Hub's global setting via useTheme() rather than hardcoding
// dark. The mockup is dark-only, so its exact palette lives under
// [data-theme="dark"] and light mode maps to the Hub's own light tokens.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme-context'

// ── Scoped stylesheet (port of the mockup's <style>, minus the rail) ──
//
// Fraunces and Inter are already self-hosted by next/font in src/app/layout.tsx
// (--font-fraunces / --font-inter), so they are referenced rather than re-fetched
// from Google. IBM Plex Mono and the Tabler icon webfont are not in the project,
// so they come from CDN exactly as the mockup does.
const BV_CSS = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap");
@import url("https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css");

.bv-root{
  /* Light mode — mapped to the Hub's own light tokens (globals.css :root) so the
     page follows Hub light mode. The mockup only specified a dark palette. */
  --bg:#FAFAFA; --card:#FFFFFF; --card-hi:#F5F5F5; --drop:#FCFCFB;
  --line:#EAEAEA; --line-strong:#D8D7D5;
  --ink:#111111; --ink-2:#666666; --ink-3:#8A8A8A; --ink-4:#A9A8A5;
  --coral:#c8311a; --live:#166534; --stale:#92400e;
  --chip:#EFEEED; --av:#F2F1F0;
  --r:10px;
  --fs:var(--font-fraunces),Georgia,serif;
  --fb:var(--font-inter),system-ui,sans-serif;
  --fm:"IBM Plex Mono",ui-monospace,monospace;
}
.bv-root[data-theme="dark"]{
  /* Exact palette from the approved mockup */
  --bg:#121110; --card:#1A1918; --card-hi:#1F1E1D; --drop:#161514;
  --line:#2A2928; --line-strong:#3A3937;
  --ink:#ECEBE8; --ink-2:#A8A7A3; --ink-3:#7B7A77; --ink-4:#5A5957;
  --coral:#F0565E; --live:#59B87E; --stale:#C08A4A;
  --chip:#252322; --av:#282625;
}

.bv-root *{box-sizing:border-box;margin:0;padding:0}
.bv-root{
  flex:1;min-width:0;min-height:0;overflow-y:auto;
  background:var(--bg);color:var(--ink);
  font:450 14px/1.5 var(--fb);letter-spacing:-0.005em;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.bv-root .num{font-variant-numeric:tabular-nums lining-nums}
.bv-root :focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* ---------- page ---------- */
.bv-root .page{padding:38px 44px 72px;max-width:1180px}
.bv-root .head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:34px}
.bv-root h1{font:400 40px/1.05 var(--fs);letter-spacing:-.02em;color:var(--ink)}
.bv-root .sub{color:var(--ink-2);font-size:15px;margin-top:9px}
.bv-root .meta{display:flex;align-items:center;gap:14px;margin-top:12px;font:400 12px/1 var(--fm);color:var(--ink-4)}
.bv-root .meta .dot{width:5px;height:5px;border-radius:50%;background:var(--live);flex:0 0 auto}
.bv-root .icon-btn{width:26px;height:26px;border:0;background:transparent;border-radius:6px;color:var(--ink-4);
  display:grid;place-items:center;cursor:pointer;font-size:15px;flex:0 0 auto;transition:background .12s,color .12s}
.bv-root .icon-btn:hover{background:var(--card-hi);color:var(--ink-2)}

/* ---------- section label ---------- */
.bv-root .sec{display:flex;align-items:center;gap:12px;margin:44px 0 14px}
.bv-root .sec h2{font:400 10px/1 var(--fm);letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase;white-space:nowrap}
.bv-root .sec .rule{height:1px;background:var(--line);flex:1}
.bv-root .sec .note{font-size:12px;color:var(--ink-4);white-space:nowrap}

/* ---------- metrics ---------- */
.bv-root .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.bv-root .metric{background:var(--card);padding:16px 18px 15px}
.bv-root .metric .k{font:400 10px/1.3 var(--fm);letter-spacing:.1em;color:var(--ink-3);text-transform:uppercase;
  height:26px;display:flex;align-items:flex-start}
.bv-root .metric .v{font:400 30px/1 var(--fm);letter-spacing:-.02em;color:var(--ink);margin:6px 0 7px;
  display:flex;align-items:baseline;gap:5px;font-variant-numeric:tabular-nums lining-nums}
.bv-root .metric .v small{font-size:15px;color:var(--ink-4)}
.bv-root .metric .d{font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px;min-height:17px}
.bv-root .metric .d i{font-size:14px;flex:0 0 auto}
/* NOTE: the mockup declares these as bare .up / .warn (0-1-0), which lose to
   .metric .d (0-2-0) — so in the mockup they never actually applied and both
   sub-lines rendered grey. The spec asks for a visible "warning style", so they
   are scoped here to win. This is a deliberate deviation from the mockup's CSS. */
.bv-root .metric .d.up{color:var(--live)}
.bv-root .metric .d.warn{color:var(--stale)}

/* ---------- foundation ---------- */
.bv-root .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.bv-root .drop{border:1px dashed var(--line-strong);border-radius:var(--r);padding:18px 20px;background:var(--drop)}
.bv-root .drop .lay{font:400 10px/1 var(--fm);letter-spacing:.1em;color:var(--ink-4);text-transform:uppercase}
.bv-root .drop h3{font:500 15px/1.3 var(--fb);margin:9px 0 5px;color:var(--ink)}
.bv-root .drop p{font-size:13px;color:var(--ink-3);line-height:1.5}
.bv-root .drop .foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px}
.bv-root .drop .foot span{font-size:12px;color:var(--ink-4)}
.bv-root .drop .foot span.ok{color:var(--live)}
.bv-root .ghost{border:1px solid var(--line-strong);background:transparent;color:var(--ink-2);
  font:450 12.5px/1 var(--fb);padding:7px 12px;border-radius:7px;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;transition:background .12s,color .12s,border-color .12s;flex:0 0 auto}
.bv-root .ghost i{font-size:14px}
.bv-root .ghost:hover:not(:disabled){background:var(--card-hi);color:var(--ink);border-color:var(--ink-4)}
.bv-root .ghost:disabled{cursor:default;opacity:.6}

/* ---------- agents ---------- */
.bv-root .agents{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.bv-root .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;
  transition:border-color .14s,background .14s}
.bv-root .card:hover{border-color:var(--line-strong);background:var(--card-hi)}
.bv-root .card .top{display:flex;align-items:center;gap:10px}
.bv-root .card .top i.gi{font-size:17px;color:var(--ink-3);flex:0 0 auto}
.bv-root .card .top h3{flex:1;min-width:0;font:500 15px/1.2 var(--fb);letter-spacing:-.01em;color:var(--ink)}
.bv-root .pill{font:400 9.5px/1 var(--fm);letter-spacing:.09em;padding:4px 7px;border-radius:5px;
  text-transform:uppercase;flex:0 0 auto}
.bv-root .pill.live{color:var(--live);background:rgba(89,184,126,.1)}
.bv-root .pill.stale{color:var(--stale);background:rgba(192,138,74,.1)}
.bv-root .card p{font-size:13px;color:var(--ink-2);margin:8px 0 0;line-height:1.5}
.bv-root .card .foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
.bv-root .stats{display:flex;align-items:center;gap:12px;font:400 11.5px/1 var(--fm);color:var(--ink-4);
  font-variant-numeric:tabular-nums lining-nums}
.bv-root .stats b{color:var(--ink-3);font-weight:400}
.bv-root .sep{width:1px;height:11px;background:var(--line-strong)}
.bv-root .ask{border:0;background:transparent;color:var(--ink-3);font:450 12.5px/1 var(--fb);padding:6px 9px;
  border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;
  transition:background .12s,color .12s;flex:0 0 auto}
.bv-root .ask i{font-size:14px}
.bv-root .card:hover .ask{background:var(--chip);color:var(--ink)}

/* ---------- leaders ---------- */
.bv-root .leaders{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.bv-root .lead{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:15px 15px 13px;
  transition:border-color .14s,background .14s}
.bv-root .lead:hover{border-color:var(--line-strong);background:var(--card-hi)}
.bv-root .lead .av{width:30px;height:30px;border-radius:50%;background:var(--av);border:1px solid var(--line-strong);
  display:grid;place-items:center;font:400 10.5px/1 var(--fm);letter-spacing:.02em;color:var(--ink-2)}
.bv-root .lead h3{font:500 13.5px/1.25 var(--fb);margin:11px 0 3px;color:var(--ink)}
.bv-root .lead .role{font:400 10px/1 var(--fm);letter-spacing:.08em;color:var(--ink-4);text-transform:uppercase}
.bv-root .lead p{font-size:12px;color:var(--ink-3);margin:9px 0 0;line-height:1.45}
.bv-root .lead .foot{display:flex;align-items:center;justify-content:space-between;margin-top:13px;padding-top:11px;
  border-top:1px solid var(--line)}
.bv-root .lead .foot .n{font:400 11px/1 var(--fm);color:var(--ink-4);font-variant-numeric:tabular-nums lining-nums}
.bv-root .lead .foot .n.warn{color:var(--stale)}
.bv-root .lead .ask{padding:4px 6px}
.bv-root .lead:hover .ask{background:var(--chip);color:var(--ink)}

/* ---------- rollup ---------- */
.bv-root .rollup{margin-top:44px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  padding:20px 22px;display:flex;align-items:center;gap:24px}
.bv-root .rollup .body{flex:1;min-width:0}
.bv-root .rollup h3{font:400 20px/1.2 var(--fs);letter-spacing:-.01em;color:var(--ink)}
.bv-root .rollup p{font-size:13px;color:var(--ink-3);margin-top:6px;line-height:1.5}
.bv-root .primary{border:0;background:var(--coral);color:#1A0A0C;font:500 13.5px/1 var(--fb);padding:11px 18px;
  border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;
  transition:filter .12s,transform .08s;flex:0 0 auto}
.bv-root .primary i{font-size:15px}
.bv-root .primary:hover{filter:brightness(1.07)}
.bv-root .primary:active{transform:scale(.985)}

/* Breakpoints are shifted ~236px from the mockup's because the Hub Sidebar takes
   that much of the viewport before this page's column starts. */
@media (max-width:1340px){
  .bv-root .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bv-root .leaders{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:1000px){
  .bv-root .two,.bv-root .agents{grid-template-columns:1fr}
  .bv-root .leaders{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bv-root .page{padding:28px 22px 60px}
  .bv-root .rollup{flex-direction:column;align-items:flex-start}
  .bv-root .sec .note{display:none}
}
@media (prefers-reduced-motion:reduce){.bv-root *{transition:none!important}}
`

// ── Static card copy (matches the mockup) ────────────────────────────
// `category` and `layer` drive handleFoundationUpload and are unchanged.
const FOUNDATION = [
  {
    lay: 'Layer 0',
    title: 'Big Vision — $1B strategy',
    desc: 'The reference every agent checks its answer against.',
    category: 'big_vision' as const,
    layer: 0 as const,
  },
  {
    lay: 'Layer 1',
    title: '2-year direction',
    desc: 'St. Petersburg → Tampa → Clearwater.',
    category: 'strategy' as const,
    layer: 1 as const,
  },
]

const AGENTS = [
  { slug: 'ai-hub', icon: 'ti-building-community', name: 'AI Hub rollout', desc: 'Pre-con in progress · construction next' },
  { slug: 'pit', icon: 'ti-settings-2', name: 'Process improvement', desc: 'Company focus is the AI Hub rollout' },
  { slug: 'design-center', icon: 'ti-palette', name: 'Design center', desc: 'Launch early 2027 · timeline tracked' },
  { slug: 'dept-alignment', icon: 'ti-sitemap', name: 'Dept alignment', desc: 'Matteo’s draft sent · others rolling out' },
]

// Leaders whose intelligence each has a dedicated agent page.
// NOTE: the Ask button links to `/big-vision/${slug}` (a single dynamic segment
// handled by big-vision/[agent]/page.tsx). Unchanged from the previous version.
const LEADERS = [
  { slug: 'jeff', initials: 'JA', name: 'Jeff Azcona', role: 'VP Sales', desc: 'Sales pipeline · revenue targets' },
  { slug: 'lamont', initials: 'LG', name: 'Lamont Gilyot', role: 'VP Finance', desc: 'Cash position · budget variance' },
  { slug: 'chad', initials: 'CH', name: 'Chad Holman', role: 'VP Operations', desc: 'WIP status · operational blockers' },
  { slug: 'matteo', initials: 'MC', name: 'Matteo Carpani', role: 'Ops Manager', desc: 'Active projects · client journey' },
  { slug: 'kaitlyn', initials: 'KG', name: 'Kaitlyn Grunenberg', role: 'VP HR', desc: 'Team alignment · hiring pipeline' },
]

// A memory is "stale" once its newest file is this old.
const STALE_DAYS = 7

// ── Relative-time helpers ────────────────────────────────────────────
// Both are only ever called with dates that arrive from a client-side fetch, so
// they never run against real data during SSR and cannot cause a hydration
// mismatch (on the server the freshness map is still empty).
function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, (Date.now() - t) / 3_600_000)
}

function ago(iso: string | null | undefined): string | null {
  const h = hoursSince(iso)
  if (h === null) return null
  if (h < 1) return 'just now'
  if (h < 24) return `fed ${Math.floor(h)}h ago`
  return `fed ${Math.floor(h / 24)}d ago`
}

// Compact form for the leader cards' footer ("50 · 1d").
function agoShort(iso: string | null | undefined): string {
  const h = hoursSince(iso)
  if (h === null) return '—'
  if (h < 24) return `${Math.max(1, Math.floor(h))}h`
  return `${Math.floor(h / 24)}d`
}

export default function BigVisionPage() {
  // Theme follows the Hub's global setting (the `dark` class on <html>) via the
  // shared useTheme hook — same pattern as the precon page. Its initial value is
  // 'dark' on both server and client, so SSR output is stable.
  const { theme } = useTheme()

  // ── Live stats ─────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    filesInMemory: 0,
    agentsLive: 0,
    leadersLive: 0,
    totalLeaders: 5,
    autoRoutedThisWeek: 0,
    rollupReady: false,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Per-agent file counts, keyed by slug. Populated after stats load.
  const [agentFileCounts, setAgentFileCounts] = useState<Record<string, number>>({})
  const [countsLoading, setCountsLoading] = useState(true)

  // Newest file date per slug, keyed the same way as agentFileCounts. Read from
  // the SAME /api/big-vision/files response that already populates the counts —
  // no extra request, no new endpoint. Drives "fed Xh ago", the LIVE/STALE pills
  // and the "memory needing attention" metric.
  const [agentFreshness, setAgentFreshness] = useState<Record<string, string | null>>({})

  // ── Foundation-card uploads (Big Vision / 2-Year Direction) ────────
  const [uploadingFoundation, setUploadingFoundation] = useState<string | null>(null)
  const [foundationSuccess, setFoundationSuccess] = useState<string | null>(null)
  const bigVisionInputRef = useRef<HTMLInputElement>(null)
  const strategyInputRef = useRef<HTMLInputElement>(null)
  const [foundationCounts, setFoundationCounts] = useState<Record<string, number>>({
    big_vision: 0,
    strategy: 0,
  })

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        const filesRes = await fetch('/api/big-vision/stats')
        const data = await filesRes.json()
        if (!cancelled && data && typeof data.filesInMemory === 'number') {
          setStats({
            filesInMemory: data.filesInMemory,
            agentsLive: data.agentsLive,
            leadersLive: data.leadersLive ?? 0,
            totalLeaders: data.totalLeaders ?? 5,
            autoRoutedThisWeek: data.autoRoutedThisWeek,
            rollupReady: data.rollupReady,
          })
        }
      } catch (e) {
        console.error('stats error', e)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    // Fetch each agent's file count in parallel. limit=50 matches the list route's
    // cap, so the count reflects up to 50 files per agent.
    async function loadAgentCounts() {
      const slugs = [
        'pit',
        'ai-hub',
        'design-center',
        'dept-alignment',
        'jeff',
        'lamont',
        'chad',
        'matteo',
        'kaitlyn',
      ]
      try {
        const counts = await Promise.all(
          slugs.map(async (slug) => {
            const res = await fetch(`/api/big-vision/files?agent=${slug}&limit=50`)
            const data = await res.json()
            // The route returns files already sorted newest-first by
            // meeting_date || created_at, so [0] is the freshest.
            const newest = data.files?.[0]
            return {
              slug,
              count: data.files?.length ?? 0,
              newest: (newest?.meeting_date || newest?.created_at) ?? null,
            }
          }),
        )
        if (!cancelled) {
          const countsMap: Record<string, number> = {}
          const freshMap: Record<string, string | null> = {}
          counts.forEach(({ slug, count, newest }) => {
            countsMap[slug] = count
            freshMap[slug] = newest
          })
          setAgentFileCounts(countsMap)
          setAgentFreshness(freshMap)
        }
      } catch (e) {
        console.error('agent counts error', e)
      } finally {
        if (!cancelled) setCountsLoading(false)
      }
    }

    // Foundation card counts. NOTE: /api/big-vision/files only maps the agent slugs in
    // its AGENT_CATEGORY table — it does NOT recognize 'big-vision' or 'strategy', and
    // adding those mappings would mean editing that API route, which is out of scope for
    // this task. So these requests currently return no files and the counts stay 0
    // ("No files uploaded yet"); a successful upload bumps the count locally. If the
    // files route later maps these slugs, this fetch will populate real counts.
    async function loadFoundationCounts() {
      const pairs = [
        { slug: 'big-vision', key: 'big_vision' },
        { slug: 'strategy', key: 'strategy' },
      ]
      try {
        const results = await Promise.all(
          pairs.map(async ({ slug, key }) => {
            const res = await fetch(`/api/big-vision/files?agent=${slug}&limit=50`)
            const data = await res.json()
            return { key, count: data.files?.length ?? 0 }
          }),
        )
        if (!cancelled) {
          setFoundationCounts((prev) => {
            const next = { ...prev }
            results.forEach(({ key, count }) => {
              next[key] = count
            })
            return next
          })
        }
      } catch (e) {
        console.error('foundation counts error', e)
      }
    }

    async function run() {
      await loadStats()
      if (!cancelled) await loadAgentCounts()
      if (!cancelled) await loadFoundationCounts()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Upload a seed doc straight into a Foundation category (big_vision → layer 0,
  // strategy → layer 1). Wrapped in try/finally so a network throw still clears the
  // "Uploading…" state; on success it bumps the local count so the card updates now.
  async function handleFoundationUpload(
    file: File,
    category: 'big_vision' | 'strategy',
    layer: 0 | 1,
  ) {
    setUploadingFoundation(category)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^.]+$/, ''))
    formData.append('categories', category)
    formData.append('layer', layer.toString())
    formData.append('source_type', 'seed_doc')

    try {
      const res = await fetch('/api/big-vision/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setFoundationSuccess(category)
        setTimeout(() => setFoundationSuccess(null), 3000)
        setFoundationCounts((prev) => ({ ...prev, [category]: (prev[category] ?? 0) + 1 }))
      }
    } catch (e) {
      console.error('foundation upload error', e)
    } finally {
      setUploadingFoundation(null)
    }
  }

  // ── Derived presentation values (all from live state, nothing invented) ──

  // A slug is "live" when it has files and its newest file is inside STALE_DAYS.
  function isLive(slug: string): boolean {
    const count = agentFileCounts[slug] ?? 0
    if (count === 0) return false
    const h = hoursSince(agentFreshness[slug])
    return h !== null && h < STALE_DAYS * 24
  }

  // Leaders whose memory has gone quiet (no files at all, or nothing in STALE_DAYS),
  // worst first. Drives the "memory needing attention" metric.
  const staleLeaders = LEADERS.map((l) => ({
    name: l.name.split(' ')[0],
    hours: hoursSince(agentFreshness[l.slug]),
  }))
    .filter((l) => l.hours === null || l.hours >= STALE_DAYS * 24)
    .sort((a, b) => (b.hours ?? Infinity) - (a.hours ?? Infinity))

  // How many of the four strategic agents were fed in the last 48h.
  const fedRecently = AGENTS.filter((a) => {
    const h = hoursSince(agentFreshness[a.slug])
    return h !== null && h < 48
  }).length

  // Total files sitting behind the four strategic agents.
  const routedFiles = AGENTS.reduce((sum, a) => sum + (agentFileCounts[a.slug] ?? 0), 0)

  // "Routed without sorting" — the share of memory that arrived via Fireflies
  // auto-routing instead of a manual upload. stats only exposes the last-7-day
  // Fireflies count (autoRoutedThisWeek), so this is that slice of the whole
  // library. A true all-time auto-tagged ratio would need a new field on
  // /api/big-vision/stats, which is out of scope for a visual rebuild — the
  // sub-label below states exactly what the number measures.
  const routedPct =
    stats.filesInMemory > 0 ? Math.round((stats.autoRoutedThisWeek / stats.filesInMemory) * 100) : 0

  // Freshest file anywhere — powers the header's "SYNCED …" line.
  const lastSync = Object.values(agentFreshness)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BV_CSS }} />

      <div className="bv-root animate-page-in" data-theme={theme}>
        <main className="page">
          {/* ── Header ────────────────────────────────────────────── */}
          <div className="head">
            <div>
              <h1>Big Vision</h1>
              <p className="sub">One shared memory — feed it once, every agent follows.</p>
              <div className="meta">
                <span className="dot" />
                <span>SHARED MEMORY ACTIVE</span>
                {lastSync && (
                  <>
                    <span>·</span>
                    <span>SYNCED {agoShort(lastSync).toUpperCase()} AGO</span>
                  </>
                )}
              </div>
            </div>
            {/* Visual only — same as the previous version. */}
            <button className="icon-btn" aria-label="Page options">
              <i className="ti ti-dots" aria-hidden="true" />
            </button>
          </div>

          {/* ── Metrics ───────────────────────────────────────────── */}
          <div className="metrics">
            <div className="metric">
              <div className="k">Files in memory</div>
              <div className="v">{statsLoading ? '—' : stats.filesInMemory}</div>
              <div className={`d${!statsLoading && stats.autoRoutedThisWeek > 0 ? ' up' : ''}`}>
                {!statsLoading && stats.autoRoutedThisWeek > 0 && (
                  <i className="ti ti-arrow-up-right" aria-hidden="true" />
                )}
                {statsLoading ? '' : `${stats.autoRoutedThisWeek} auto-routed this week`}
              </div>
            </div>

            <div className="metric">
              <div className="k">Agents reporting</div>
              <div className="v">
                {statsLoading ? '—' : stats.agentsLive}
                {!statsLoading && <small>/4</small>}
              </div>
              <div className="d">
                {countsLoading ? '' : `${fedRecently} of 4 fed in last 48h`}
              </div>
            </div>

            <div className="metric">
              <div className="k">Memory needing attention</div>
              <div className="v">{countsLoading ? '—' : staleLeaders.length}</div>
              <div className={`d${!countsLoading && staleLeaders.length > 0 ? ' warn' : ''}`}>
                {countsLoading ? (
                  ''
                ) : staleLeaders.length === 0 ? (
                  'Every leader fed recently'
                ) : (
                  <>
                    <i className="ti ti-alert-triangle" aria-hidden="true" />
                    {staleLeaders[0].hours === null
                      ? `${staleLeaders[0].name} — no files yet`
                      : `${staleLeaders[0].name} — ${Math.floor(staleLeaders[0].hours / 24)} days quiet`}
                  </>
                )}
              </div>
            </div>

            <div className="metric">
              <div className="k">Routed without sorting</div>
              <div className="v">
                {statsLoading ? '—' : routedPct}
                {!statsLoading && <small>%</small>}
              </div>
              <div className="d">
                {statsLoading
                  ? ''
                  : `${stats.autoRoutedThisWeek} of ${stats.filesInMemory} files, last 7 days`}
              </div>
            </div>
          </div>

          {/* ── Foundation ────────────────────────────────────────── */}
          <div className="sec">
            <h2>Foundation</h2>
            <div className="rule" />
            <span className="note">Every agent traces back here</span>
          </div>

          {/* Hidden file inputs — opened by each Foundation card's Upload button */}
          <input
            type="file"
            className="hidden"
            ref={bigVisionInputRef}
            accept=".pdf,.docx,.xlsx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFoundationUpload(f, 'big_vision', 0)
              e.target.value = ''
            }}
          />
          <input
            type="file"
            className="hidden"
            ref={strategyInputRef}
            accept=".pdf,.docx,.xlsx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFoundationUpload(f, 'strategy', 1)
              e.target.value = ''
            }}
          />

          <div className="two">
            {FOUNDATION.map((f) => {
              const inputRef = f.category === 'big_vision' ? bigVisionInputRef : strategyInputRef
              const isUploading = uploadingFoundation === f.category
              const isSuccess = foundationSuccess === f.category
              const count = foundationCounts[f.category] ?? 0
              return (
                <div key={f.category} className="drop">
                  <div className="lay">{f.lay}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <div className="foot">
                    {isSuccess ? (
                      <span className="ok">Uploaded</span>
                    ) : (
                      <span className="num">
                        {count === 0 ? 'Nothing here yet' : `${count} file${count === 1 ? '' : 's'}`}
                      </span>
                    )}
                    <button
                      className="ghost"
                      onClick={() => inputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <i className="ti ti-upload" aria-hidden="true" />
                      {isUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── The four agents ───────────────────────────────────── */}
          <div className="sec">
            <h2>The four agents</h2>
            <div className="rule" />
            <span className="note">
              {countsLoading ? '' : `${routedFiles} files routed automatically`}
            </span>
          </div>
          <div className="agents">
            {AGENTS.map((a) => {
              const count = agentFileCounts[a.slug] ?? 0
              const fed = ago(agentFreshness[a.slug])
              const live = isLive(a.slug)
              return (
                <div key={a.slug} className="card">
                  <div className="top">
                    <i className={`ti ${a.icon} gi`} aria-hidden="true" />
                    <h3>{a.name}</h3>
                    {!countsLoading && (
                      <span className={`pill ${live ? 'live' : 'stale'}`}>
                        {live ? 'Live' : 'Stale'}
                      </span>
                    )}
                  </div>
                  <p>{a.desc}</p>
                  <div className="foot">
                    <div className="stats">
                      <span>
                        <b>{countsLoading ? '—' : count}</b> files
                      </span>
                      {fed && (
                        <>
                          <span className="sep" />
                          <span>{fed}</span>
                        </>
                      )}
                    </div>
                    <Link href={`/big-vision/${a.slug}`} className="ask">
                      <i className="ti ti-message-2" aria-hidden="true" />
                      Ask
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Leader intelligence ───────────────────────────────── */}
          <div className="sec">
            <h2>Leader intelligence</h2>
            <div className="rule" />
            <span className="note">Ask any leader&apos;s memory directly</span>
          </div>
          <div className="leaders">
            {LEADERS.map((l) => {
              const count = agentFileCounts[l.slug] ?? 0
              const h = hoursSince(agentFreshness[l.slug])
              const isStale = h === null || h >= STALE_DAYS * 24
              return (
                <div key={l.slug} className="lead">
                  <div className="av">{l.initials}</div>
                  <h3>{l.name}</h3>
                  <div className="role">{l.role}</div>
                  <p>{l.desc}</p>
                  <div className="foot">
                    <span className={`n${!countsLoading && isStale ? ' warn' : ''}`}>
                      {countsLoading ? '—' : `${count} · ${agoShort(agentFreshness[l.slug])}`}
                    </span>
                    <Link href={`/big-vision/${l.slug}`} className="ask" aria-label={`Ask ${l.name}`}>
                      <i className="ti ti-message-2" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Quarterly roll-up ─────────────────────────────────── */}
          <div className="rollup">
            <div className="body">
              <h3>Quarterly leadership roll-up</h3>
              <p>
                Reads all four agents and five leader memories, then drafts Calin&apos;s update tied
                back to the $1B vision.
                {!statsLoading &&
                  ` Covers ${stats.filesInMemory} files across ${stats.agentsLive} live agents and ${stats.leadersLive} of ${stats.totalLeaders} leader memories.`}
                {!statsLoading && !stats.rollupReady && ' Not every agent has been fed yet.'}
              </p>
            </div>
            {/* Visual only for now — same as the previous version. */}
            <button className="primary">
              <i className="ti ti-sparkles" aria-hidden="true" />
              Generate roll-up
            </button>
          </div>
        </main>
      </div>
    </>
  )
}
