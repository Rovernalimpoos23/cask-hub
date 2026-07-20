// src/app/(app)/big-vision/page.tsx
// Big Vision — one shared memory that feeds every agent.
// VISUAL ONLY. All data hardcoded — no Supabase, no API calls.
// Matches the Hub dark theme via CSS variables from globals.css.

import Link from 'next/link'

// ── Typography ───────────────────────────────────────────────────────
const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif'
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums' }

// ── Data (hardcoded) ─────────────────────────────────────────────────
const STATS = [
  { label: 'Files in memory', value: '42' },
  { label: 'Agents live', value: '4', suffix: '/ 4', tone: 'green' as const },
  { label: 'Auto-routed this week', value: '7' },
  { label: 'Roll-up report', value: 'Ready to draft', tone: 'green' as const, small: true },
]

const FOUNDATION = [
  {
    title: 'Big Vision — $1B strategy',
    meta: 'Layer 0 · the reference every agent traces back to',
    icon: '◎',
  },
  {
    title: '2-Year Direction',
    meta: 'Layer 1 · St. Petersburg → Tampa → Clearwater',
    icon: '⇄',
  },
]

const AGENTS = [
  {
    slug: 'ai-hub',
    icon: '🤖',
    name: 'AI Hub Rollout',
    desc: 'Pre-con in progress · construction next',
    files: 11,
  },
  {
    slug: 'pit',
    icon: '⚙️',
    name: 'Process Improvement (PIT)',
    desc: 'Company focus = AI Hub rollout',
    files: 8,
  },
  {
    slug: 'design-center',
    icon: '🎨',
    name: 'Design Center',
    desc: 'Launch start of 2027 · timeline tracked',
    files: 9,
  },
  {
    slug: 'dept-alignment',
    icon: '👥',
    name: 'Dept Alignment',
    desc: 'Mateo draft sent · others rolling out',
    files: 14,
  },
]

// Leaders whose intelligence each has a dedicated agent page.
// NOTE: the Ask button links to `/big-vision/${slug}` (a single dynamic
// segment handled by big-vision/[agent]/page.tsx). The original spec named
// `/big-vision/leader/[slug]`, but that two-segment path would require a new
// route file (leader/[slug]/page.tsx) outside the two files this task is
// allowed to touch — so leaders are served by the existing [agent] route.
const LEADERS = [
  { slug: 'jeff', initials: 'JA', bg: 'var(--red)', name: 'Jeff Azcona', role: 'VP Sales', desc: 'Sales pipeline · revenue targets', files: 6 },
  { slug: 'lamont', initials: 'LG', bg: '#2563eb', name: 'Lamont Gilyot', role: 'VP Finance', desc: 'Cash position · budget variance', files: 5 },
  { slug: 'chad', initials: 'CH', bg: '#059669', name: 'Chad Holman', role: 'VP Operations', desc: 'WIP status · operational blockers', files: 4 },
  { slug: 'matteo', initials: 'MC', bg: '#7c3aed', name: 'Matteo Carpani', role: 'Ops Manager', desc: 'Active projects · client journey', files: 7 },
  { slug: 'kaitlyn', initials: 'KG', bg: '#d97706', name: 'Kaitlyn Grunenberg', role: 'VP HR', desc: 'Team alignment · hiring pipeline', files: 3 },
]

export default function BigVisionPage() {
  return (
    <>
      <style>{`
        .bv-stat { transition: border-color 150ms ease; }
        .bv-stat:hover { border-color: var(--border2); }
        .bv-found:hover { border-color: var(--border2); }
        .bv-agent { transition: border-color 150ms ease, background 150ms ease; }
        .bv-agent:hover { border-color: var(--border2); }
        .bv-ask { transition: background 150ms ease, color 150ms ease, border-color 150ms ease; }
        .bv-ask:hover { border-color: var(--red); color: var(--red); }
        .bv-menu:hover { background: var(--surface2); color: var(--text2); }
        .bv-rollup-btn { transition: opacity 150ms ease; }
        .bv-rollup-btn:hover { opacity: 0.9; }
      `}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden animate-page-in" style={{ background: 'var(--bg)' }}>
        <div className="px-6 py-8" style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 32,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Big Vision
              </h1>
              <p className="text-[14px] font-medium mt-2" style={{ color: 'var(--text2)' }}>
                One shared memory — feed it once, every agent follows
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text3)', ...NUM }}>
                6 seed documents loaded · 4 agents live · shared memory active
              </p>
            </div>
            <button
              aria-label="More options"
              className="bv-menu shrink-0 rounded-lg flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text3)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ···
            </button>
          </div>

          {/* ── Stat cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="bv-stat rounded-xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="text-[10px] font-semibold uppercase"
                  style={{ letterSpacing: '1px', color: 'var(--text3)' }}
                >
                  {s.label}
                </div>
                <div
                  className="mt-3 flex items-baseline gap-1.5"
                  style={{
                    fontSize: s.small ? 18 : 28,
                    fontWeight: 650,
                    letterSpacing: '-0.5px',
                    lineHeight: 1,
                    color: s.tone === 'green' ? 'var(--green)' : 'var(--text)',
                    ...NUM,
                  }}
                >
                  {s.value}
                  {s.suffix && (
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>{s.suffix}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Foundation ──────────────────────────────────────── */}
          <div className="mb-8">
            <div
              className="text-[10px] font-semibold uppercase mb-3"
              style={{ letterSpacing: '1.2px', color: 'var(--text3)' }}
            >
              Foundation
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FOUNDATION.map((f) => (
                <div
                  key={f.title}
                  className="bv-found rounded-xl p-5"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--red)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: 'var(--red)', fontSize: 15 }}>{f.icon}</span>
                    <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
                      {f.title}
                    </span>
                  </div>
                  <div className="text-[13px] mt-1.5" style={{ color: 'var(--text2)' }}>
                    {f.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── The four agents ─────────────────────────────────── */}
          <div className="mb-8">
            <div
              className="text-[10px] font-semibold uppercase mb-3"
              style={{ letterSpacing: '1.2px', color: 'var(--text3)' }}
            >
              The Four Agents
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENTS.map((a) => (
                <div
                  key={a.slug}
                  className="bv-agent rounded-xl p-5 flex flex-col"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {/* Top row — icon + name + LIVE badge */}
                  <div className="flex items-center gap-2.5">
                    <span style={{ fontSize: 17 }}>{a.icon}</span>
                    <span className="text-[15px] font-semibold flex-1 min-w-0" style={{ color: 'var(--text)' }}>
                      {a.name}
                    </span>
                    <LiveBadge />
                  </div>

                  {/* Description */}
                  <p className="text-sm mt-2.5" style={{ color: 'var(--text2)' }}>
                    {a.desc}
                  </p>

                  {/* Bottom row — file count + Ask */}
                  <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text3)', ...NUM }}>
                      <span>▢</span> {a.files} files
                    </span>
                    <Link
                      href={`/big-vision/${a.slug}`}
                      className="bv-ask inline-flex items-center gap-1.5 rounded-lg no-underline text-[12px] font-semibold"
                      style={{
                        padding: '6px 12px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                      }}
                    >
                      <span>💬</span> Ask
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Leader intelligence ─────────────────────────────── */}
          <div className="mb-8">
            <div
              className="text-[10px] font-semibold uppercase mb-3"
              style={{ letterSpacing: '1.2px', color: 'var(--text3)' }}
            >
              Leader Intelligence
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LEADERS.map((l) => (
                <div
                  key={l.slug}
                  className="bv-agent rounded-xl p-5 flex flex-col"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {/* Top row — avatar initials + name + role badge */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center rounded-full shrink-0 text-[12px] font-bold text-white"
                      style={{ width: 34, height: 34, background: l.bg, letterSpacing: '0.3px' }}
                    >
                      {l.initials}
                    </span>
                    <span className="text-[15px] font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
                      {l.name}
                    </span>
                    <span
                      className="shrink-0 rounded-full text-xs font-medium"
                      style={{ padding: '3px 9px', background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                    >
                      {l.role}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm mt-2.5" style={{ color: 'var(--text2)' }}>
                    {l.desc}
                  </p>

                  {/* Bottom row — file count + Ask */}
                  <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text3)', ...NUM }}>
                      <span>▢</span> {l.files} files
                    </span>
                    <Link
                      href={`/big-vision/${l.slug}`}
                      className="bv-ask inline-flex items-center gap-1.5 rounded-lg no-underline text-[12px] font-semibold"
                      style={{
                        padding: '6px 12px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                      }}
                    >
                      <span>💬</span> Ask
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quarterly roll-up ───────────────────────────────── */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <span style={{ color: 'var(--red)', fontSize: 16 }}>📄</span>
              <span className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>
                Quarterly Leadership Roll-Up
              </span>
            </div>
            <p className="text-[13px] mt-2 mb-4" style={{ color: 'var(--text2)', maxWidth: 640 }}>
              Reads all four agents → drafts Calin&apos;s update connecting everything back to the $1B vision
            </p>
            <button
              className="bv-rollup-btn inline-flex items-center gap-2 rounded-lg text-[13px] font-semibold"
              style={{
                padding: '9px 16px',
                background: 'var(--red)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span>✳</span> Generate roll-up
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── LIVE badge ───────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 rounded-full text-[10px] font-bold uppercase"
      style={{
        letterSpacing: '0.6px',
        padding: '2px 8px',
        background: 'var(--pill-green-bg)',
        color: 'var(--pill-green-color)',
        border: '1px solid var(--pill-green-border)',
      }}
    >
      Live
    </span>
  )
}
