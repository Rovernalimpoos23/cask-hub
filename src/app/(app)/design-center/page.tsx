'use client'
// src/app/(app)/design-center/page.tsx

import { useState } from 'react'
import { TopBar } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'Contact Made' | 'No Contact' | 'Not Viable'

interface DesignReferral {
  id: string
  date: string
  designer: string
  customer: string
  projectType: string
  address: string
  stage: Stage
  constructionLikelihood: 'High' | 'Medium' | 'Low'
  alignmentScore: number | null
  notes: string
}

const STAGE_STYLES: Record<Stage, { color: string; bg: string; border: string }> = {
  'Contact Made': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'No Contact':   { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'Not Viable':   { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
}

const LIKELIHOOD_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  High:   { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  Medium: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  Low:    { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

// ── File cards data ───────────────────────────────────────────────────────────

const FILE_CARDS = [
  { title: 'Design Center Ideas',              url: '#' },
  { title: 'Design Center — Calin',            url: '#' },
  { title: 'Design Center — Shannon',          url: '#' },
  { title: 'Design Center — Jeff',             url: '#' },
  { title: 'Design Center Planning — Jeff',    url: '#' },
  { title: 'Design Center Sneak Peek — Shannon', url: '#' },
]

// ── File card component ───────────────────────────────────────────────────────

function FileCard({ title, url }: { title: string; url: string }) {
  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3.5 px-5 py-[14px]">
        {/* File icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-[8px]"
          style={{ width: 34, height: 34, background: '#eff6ff', border: '1px solid #bfdbfe' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span
            className="text-[14px] font-semibold tracking-[-0.2px]"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </span>
        </div>

        {/* View Document button */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-[5px] no-underline transition-opacity"
          style={{ background: 'var(--charcoal)', color: '#fff' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          View Document
        </a>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 20px',
      flex: '1 1 0',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text3)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.6px',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
        letterSpacing: '-0.5px',
      }}>
        {value}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ALL_REFERRALS: DesignReferral[] = []

export default function DesignCenterPage() {
  const [filterDesigner, setFilterDesigner] = useState('')
  const [filterStage, setFilterStage]       = useState('')
  const [filterType, setFilterType]         = useState('')
  const [search, setSearch]                 = useState('')

  const designers    = Array.from(new Set(ALL_REFERRALS.map(r => r.designer))).sort()
  const projectTypes = Array.from(new Set(ALL_REFERRALS.map(r => r.projectType))).sort()

  const filtered = ALL_REFERRALS.filter(r => {
    if (filterDesigner && r.designer    !== filterDesigner) return false
    if (filterStage    && r.stage       !== filterStage)    return false
    if (filterType     && r.projectType !== filterType)     return false
    if (search && !r.customer.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total       = ALL_REFERRALS.length
  const contactMade = ALL_REFERRALS.filter(r => r.stage === 'Contact Made').length
  const noContact   = ALL_REFERRALS.filter(r => r.stage === 'No Contact').length
  const notViable   = ALL_REFERRALS.filter(r => r.stage === 'Not Viable').length
  const scores      = ALL_REFERRALS.map(r => r.alignmentScore).filter((s): s is number => s !== null)
  const avgScore    = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text2)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    appearance: 'auto' as const,
    minWidth: 140,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TopBar title="Design Center" subtitle="Relevant Files" />

      <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── File cards ── */}
          {FILE_CARDS.map((card, i) => (
            <div key={card.title}>
              <FileCard title={card.title} url={card.url} />
              {i < FILE_CARDS.length - 1 && (
                <div className="flex justify-center" style={{ padding: '3px 0' }}>
                  <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
                    <line x1="7" y1="0" x2="7" y2="17" stroke="var(--border2)" strokeWidth="1.5"/>
                    <polyline points="3,13 7,19 11,13" stroke="var(--border2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* ── Divider before tracker ── */}
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0 8px' }} />

          {/* ── Tracker section label ── */}
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase' as const,
            color: 'var(--text3)',
            marginBottom: 4,
          }}>
            Referred Client Tracker
          </div>

        </div>

        {/* ── Tracker content (wider) ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard label="Total Referrals"    value={total}                                    accent="var(--text)" />
            <StatCard label="Contact Made"        value={contactMade}                              accent="#2563eb" />
            <StatCard label="No Contact"          value={noContact}                                accent="#d97706" />
            <StatCard label="Not Viable"          value={notViable}                                accent="#64748b" />
            <StatCard label="Avg Alignment Score" value={scores.length > 0 ? `${avgScore}%` : '—'} accent="#7c3aed" />
          </div>

          {/* Filter bar */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap' as const,
          }}>
            <select value={filterDesigner} onChange={e => setFilterDesigner(e.target.value)} style={selectStyle}>
              <option value="">All Designers</option>
              {designers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={selectStyle}>
              <option value="">All Stages</option>
              {(Object.keys(STAGE_STYLES) as Stage[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
              <option value="">All Project Types</option>
              {projectTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ position: 'relative', flex: '1 1 180px' }}>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search by customer name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...selectStyle, paddingLeft: 30, width: '100%', outline: 'none', boxSizing: 'border-box' as const }}
              />
            </div>

            {(filterDesigner || filterStage || filterType || search) && (
              <button
                type="button"
                onClick={() => { setFilterDesigner(''); setFilterStage(''); setFilterType(''); setSearch('') }}
                style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', flexShrink: 0 }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 130px 140px 120px 1fr 110px 100px 80px 1fr',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
              padding: '9px 16px',
            }}>
              {['Date', 'Designer', 'Customer', 'Project Type', 'Address', 'Stage', 'Likelihood', 'Score', 'Notes'].map(col => (
                <div key={col} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.6px', padding: '0 6px' }}>
                  {col}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', gap: 10 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--text3)', opacity: 0.35 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, opacity: 0.6 }}>No data yet</p>
              </div>
            )}

            {/* Rows */}
            {filtered.map((r, i) => {
              const ss = STAGE_STYLES[r.stage]
              const ls = LIKELIHOOD_STYLES[r.constructionLikelihood]
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 130px 140px 120px 1fr 110px 100px 80px 1fr',
                    padding: '11px 16px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'start',
                  }}
                >
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '0 6px' }}>{r.date}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', padding: '0 6px' }}>{r.designer}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', padding: '0 6px' }}>{r.customer}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '0 6px' }}>{r.projectType}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</div>
                  <div style={{ padding: '0 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, whiteSpace: 'nowrap' as const }}>
                      {r.stage}
                    </span>
                  </div>
                  <div style={{ padding: '0 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: ls.bg, color: ls.color, border: `1px solid ${ls.border}` }}>
                      {r.constructionLikelihood}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', padding: '0 6px' }}>
                    {r.alignmentScore !== null ? `${r.alignmentScore}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '0 6px', lineHeight: 1.4 }}>{r.notes}</div>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </div>
  )
}
