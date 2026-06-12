'use client'
// src/app/(app)/design-center/page.tsx

import { useState, useEffect, useRef } from 'react'
import { TopBar } from '@/components/ui'
import { createClient } from '@/lib/supabase'

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

interface SubFile { name: string; fileType: 'PDF' | 'Word'; date: string; author: string }

const FILE_CARDS: { title: string; url?: string; subFiles?: SubFile[] }[] = [
  { title: 'Design Center Ideas',              url: '#' },
  {
    title: 'Design Center — Calin',
    subFiles: [
      { name: 'Design Center Leadership Briefing V4', fileType: 'PDF',  date: 'May 12', author: 'Kai Mapoy'     },
      { name: 'Discoveries for Design Center wt CTN Notes v1', fileType: 'Word', date: 'May 7',  author: 'Calin Noonan' },
      { name: 'Discoveries for Design Center wt CTN Notes v2', fileType: 'Word', date: 'May 7',  author: 'Calin Noonan' },
      { name: 'LAmonts Meeting Agenda',         fileType: 'Word', date: 'May 13', author: 'Calin Noonan' },
    ],
  },
  { title: 'Design Center — Shannon',          url: '#' },
  { title: 'Design Center — Jeff',             url: '#' },
  { title: 'Design Center Planning — Jeff',    url: '#' },
  { title: 'Design Center Sneak Peek — Shannon', url: '#' },
]

// ── File icon helpers ─────────────────────────────────────────────────────────

function PdfIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function WordIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

// ── Placeholder doc modal ─────────────────────────────────────────────────────

function DocPlaceholderModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              {name}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Design Center — Calin
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Placeholder body */}
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-12"
          style={{ color: 'var(--text3)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p className="text-[13px] text-center" style={{ opacity: 0.5 }}>
            Document content will be added here.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Leadership Briefing V4 modal ──────────────────────────────────────────────

const LEADERSHIP_INVOLVEMENT = [
  {
    initials: 'LG',
    name: 'Lamont — VP of Finance',
    focus: 'Revenue capture · Margin improvement · Overhead reduction',
    asks: [
      { what: 'Refine the pro forma and stress-test assumptions', why: 'We need your lens on what\'s realistic — you see both the opportunity and the risk' },
      { what: 'Quantify current PM overhead tied to preconstruction tasks', why: 'This establishes the baseline and makes the overhead reduction story concrete and credible' },
      { what: 'Define financial KPIs for first 12-months', why: 'We need to agree on what success looks like financially before we open the doors' },
    ],
  },
  {
    initials: 'MC',
    name: 'Matteo — Operations Manager',
    focus: 'Growth infrastructure · Process efficiency · Market expansion',
    asks: [
      { what: 'Define the construction readiness packet standard', why: 'The single most critical operational output — scope, drawings, permit, estimate, selections, contract — all consistent, every project' },
      { what: 'Map where the Design Center journey ends and construction begins', why: 'A clear interface between the two removes ambiguity and prevents projects falling through the gap' },
      { what: 'Build the SOPs that replicate cleanly to new markets', why: 'If designed right once, they travel. This document becomes the operating standard for every future market' },
    ],
  },
  {
    initials: 'KG',
    name: 'Kait — HR Director',
    focus: 'People experience · Culture · Learning and belonging',
    asks: [
      { what: 'Define what kind of person thrives as a journey specialist', why: 'Not just skills — values, communication style, how they show up for people. That nuance is yours to define' },
      { what: 'Shape how architects and team members are onboarded', why: 'We want them to feel genuinely set up to succeed, not processed through a checklist' },
      { what: 'Design the partner recognition and performance program', why: 'We want it to feel human and motivating — you understand what actually makes people feel valued' },
    ],
  },
  {
    initials: 'JA',
    name: 'Jeff — VP Sales & Marketing',
    focus: 'Customer journey · Brand building · Industry disruption',
    asks: [
      { what: 'Own the customer journey from first touchpoint through construction handoff', why: 'Every stage needs intentional design — how a lead hears about us, what the first meeting feels like, how the space guides the experience' },
      { what: 'Merge two distinct sales narratives — partners and clients', why: 'Architects and homeowners care about completely different things. Both pitches need to land powerfully as one' },
      { what: 'Develop the 8-month pre-launch marketing strategy', why: 'We want demand at the door on opening day — not being built after we open' },
    ],
  },
  {
    initials: 'CN',
    name: 'Calin — Founder & President',
    focus: 'Team empowerment · Growth · Creating opportunity',
    asks: [
      { what: 'Enter each conversation knowing what motivates that person — not just professionally, but personally', why: 'Creates ultimate team synergy and alignment producing incredibly powerful results towards leadership team personal and professional goals' },
      { what: 'Name the opportunity for each leadership member', why: 'Hearing that you built this to create something the team could grow into changes everything for the right person' },
      { what: 'Hold space for hesitation without rushing to resolve it', why: 'The ones who come around slowly often become the most committed — if they\'re not pressured early' },
    ],
  },
  {
    initials: 'CH',
    name: 'Chad — Co-Owner & VP Operations',
    focus: 'Scalable systems · Empowering others · Personal growth',
    asks: [
      { what: 'Support with designing the operating system that runs the Design Center day to day', why: 'Journey checklists, handoff standards, quality gates — all built to be simple and self-executing so the right way is always the easy way' },
      { what: 'Build the replication playbook for new markets', why: 'Every decision made here becomes the template for the next market — design it with that in mind from day one' },
      { what: 'Empower ownership to team members and let them run', why: 'Clear accountability early means people earn real capability — and you build a team that doesn\'t need you in every room' },
    ],
  },
]

function LeadershipBriefingModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          width: 640,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 60px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              Design Center Leadership Briefing V4
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              April 30, 2025 · Calin · Chad · Lamont · Matteo · Kait · Jeff
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex items-center justify-center rounded-[6px]"
            style={{ width: 28, height: 28, color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Purpose */}
          <div className="rounded-[8px] px-4 py-3" style={{ background: '#f0f4ff', border: '1px solid #c7d4f8' }}>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-1.5" style={{ color: '#4361b8' }}>
              Purpose of this Meeting
            </div>
            <p className="text-[12.5px] leading-relaxed m-0" style={{ color: '#1e3a8a' }}>
              We are not presenting a finished plan for approval. We are aligning as a leadership team on what the Design Center is, how it supports CASK Construction&apos;s growth, and where each person&apos;s involvement will matter most in the months ahead.
            </p>
          </div>

          {/* The Opportunity */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              The Opportunity
            </div>
            <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>
              Construction projects today begin in a fragmented way. Clients, architects, and contractors come in at different times, focused on different priorities — resulting in misalignment, confusion, and cost overruns. The Design Center solves this by creating a single starting point: a preconstruction ecosystem where clients are guided through a structured journey, architects work on better-defined projects, and CASK Construction receives more prepared, more predictable work.
            </p>
            <div className="rounded-[8px] px-4 py-3 italic" style={{ background: '#f0f4ff', border: '1px solid #c7d4f8', color: '#1e3a8a' }}>
              <span className="text-[12px] font-semibold not-italic" style={{ color: '#4361b8' }}>&ldquo;We&rsquo;re not just designing buildings — we&rsquo;re designing how projects start.&rdquo;</span>
              <p className="text-[12px] leading-relaxed mt-1 mb-0">The Design Center creates a guided preconstruction experience that aligns clients, architects, and contractors from day one. Every lead that enters the network generates value.</p>
            </div>
          </div>

          {/* Three Benefits */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Three Direct Benefits to CASK Construction
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { title: 'Revenue from every lead', body: 'Leads not ready to build today pay for preconstruction services now and convert later. No lead leaves the network empty-handed.' },
                { title: 'More construction volume', body: 'Projects arriving with scope defined and budget aligned allow the construction team to take on more work with less friction.' },
                { title: 'Expansion into new markets', body: 'The Design Center establishes the brand, pipeline, and relationships in a new market before construction scales in. It is the advance team.' },
              ].map(b => (
                <div key={b.title} className="rounded-[8px] p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div className="text-[11.5px] font-semibold mb-1.5 leading-tight" style={{ color: 'var(--text)' }}>{b.title}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>{b.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Leadership Involvement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              Leadership Involvement
            </div>
            <div className="flex flex-col gap-3">
              {LEADERSHIP_INVOLVEMENT.map(leader => (
                <div key={leader.initials} className="rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {/* Leader header */}
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    <div
                      className="shrink-0 flex items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
                      style={{ width: 26, height: 26, background: '#1e293b' }}
                    >
                      {leader.initials}
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{leader.name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{leader.focus}</div>
                    </div>
                  </div>
                  {/* Asks */}
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {leader.asks.map((ask, i) => (
                      <div key={i} className="grid px-4 py-2.5 gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="text-[11.5px]" style={{ color: 'var(--text2)' }}>{ask.what}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{ask.why}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="https://caskconstruction.sharepoint.com/:b:/s/CASKConstruction/IQCmKo9-r6LFTK6hRKTNp1nGAdHWc5355EjOJ95_DE7L2NM?e=GArJGS"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-[7px] text-[12px] font-semibold transition-opacity no-underline"
            style={{ background: 'var(--charcoal)', color: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            View Full Document
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Expandable file card (Calin) ──────────────────────────────────────────────

function ExpandableFileCard({ title, subFiles }: { title: string; subFiles: SubFile[] }) {
  const [open, setOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3.5 px-5 py-[14px]">
        {/* Folder icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-[8px]"
          style={{ width: 34, height: 34, background: '#eff6ff', border: '1px solid #bfdbfe' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
            {title}
          </span>
          <span className="ml-2 text-[11px]" style={{ color: 'var(--text3)' }}>
            {subFiles.length} files
          </span>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-[5px] transition-opacity"
          style={{
            background: 'var(--surface2)',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {open ? 'Collapse' : 'Expand'}
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* Sub-file rows */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {subFiles.map((file, i) => (
            <div
              key={file.name}
              className="flex items-center gap-3 px-5 py-3"
              style={{
                borderBottom: i < subFiles.length - 1 ? '1px solid var(--border)' : 'none',
                marginLeft: 48,
                marginRight: 20,
              }}
            >
              {/* File type icon */}
              <div
                className="shrink-0 flex items-center justify-center rounded-[6px]"
                style={{
                  width: 28,
                  height: 28,
                  background: file.fileType === 'PDF' ? '#fef2f2' : '#eff6ff',
                  border: `1px solid ${file.fileType === 'PDF' ? '#fecaca' : '#bfdbfe'}`,
                  color: file.fileType === 'PDF' ? '#dc4f2a' : '#2563eb',
                }}
              >
                {file.fileType === 'PDF' ? <PdfIcon /> : <WordIcon />}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {file.name}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
                  {file.fileType} · {file.date} · {file.author}
                </div>
              </div>

              {/* View Document button */}
              <button
                type="button"
                className="shrink-0 flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-1.5 rounded-[5px] transition-opacity"
                style={{ background: 'var(--charcoal)', color: '#fff', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                onClick={() => setActiveModal(file.name)}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                View Document
              </button>
            </div>
          ))}
        </div>
      )}

      {activeModal === 'Design Center Leadership Briefing V4' && (
        <LeadershipBriefingModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal && activeModal !== 'Design Center Leadership Briefing V4' && (
        <DocPlaceholderModal name={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

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

// ── Floating Design Center AI — palette + chat config ────────────────
const AI_ACCENT = '#c8311a' // CASK red

// Drawer palette uses CSS variables so it adapts to light/dark mode with the app.
const AI_D = {
  bg: 'var(--surface)',
  surface: 'var(--surface2)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
  accent: AI_ACCENT,
}

const AI_GREETING =
  "Design Center AI online. I have context on Design Center referrals — clients, designers, project types, stages, and alignment scores. Ask about DC files, clients, or designs."

const AI_QUICK_PROMPTS = ['Top referrals', 'By designer', 'Alignment scores']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

// ── Floating Design Center AI button + chat drawer ───────────────────

function FloatingDesignCenterAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      userEmailRef.current = user.email
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_email', user.email)
        .eq('page_context', '/design-center')
        .order('created_at', { ascending: true })
        .limit(50)
      if (history && history.length > 0) {
        setMessages(history as PanelMsg[])
      }
    }
    loadHistory()
  }, [])

  function saveMessage(role: string, content: string) {
    if (!userEmailRef.current) return
    createClient()
      .from('chat_history')
      .insert({ user_email: userEmailRef.current, page_context: '/design-center', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/design-center')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    const next: PanelMsg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    saveMessage('user', msg)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pageContext: '/design-center',
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const aiContent = data.content || 'No response.'
      setMessages([...next, { role: 'assistant', content: aiContent }])
      saveMessage('assistant', aiContent)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <style>{`
        @keyframes designCenterSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on Design Center */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--charcoal)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-geist), sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.2px',
          boxShadow: btnHover
            ? '0 12px 30px -6px rgba(0,0,0,0.45)'
            : '0 6px 18px -4px rgba(0,0,0,0.35)',
          transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>💬</span>
        Design Center AI
      </button>

      {/* Chat drawer — slides up from bottom-right */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 61,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 500,
            maxHeight: 'calc(100vh - 48px)',
            background: AI_D.bg,
            color: AI_D.text,
            border: `1px solid ${AI_D.border}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.5)',
            animation: 'designCenterSlideUp 220ms ease',
          }}
        >
          {/* Dark header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 16px',
              background: 'var(--charcoal)',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: AI_D.accent,
                  boxShadow: `0 0 8px ${AI_D.accent}`,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.6px',
                  textTransform: 'uppercase',
                  color: '#fff',
                }}
              >
                Design Center AI
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={clearHistory}
              title="Clear chat history"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            </span>
          </div>

          {/* Feed */}
          <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 0',
                  borderBottom: i < messages.length - 1 ? `1px solid ${AI_D.borderSoft}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: m.role === 'user' ? AI_D.text3 : AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  {m.role === 'user' ? 'You' : 'Design Center AI'}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: m.role === 'user' ? AI_D.text2 : AI_D.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ padding: '11px 0' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: AI_D.accent,
                    marginBottom: 5,
                  }}
                >
                  Design Center AI
                </div>
                <div style={{ fontSize: 12.5, color: AI_D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {AI_QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: AI_D.surface,
                    border: `1px solid ${AI_D.border}`,
                    color: AI_D.text2,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${AI_D.accent}66`
                    e.currentTarget.style.color = AI_D.text
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = AI_D.border
                    e.currentTarget.style.color = AI_D.text2
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${AI_D.border}`, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                borderRadius: 9,
                padding: 5,
                border: `1px solid ${AI_D.border}`,
                background: AI_D.surface,
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about DC files, clients, designs..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: '5px 6px',
                  outline: 'none',
                  lineHeight: 1.5,
                  color: AI_D.text,
                  fontFamily: 'inherit',
                  maxHeight: 96,
                  overflowY: 'auto',
                  border: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: input.trim() && !thinking ? AI_D.accent : AI_D.surface,
                  color: input.trim() && !thinking ? '#fff' : AI_D.text3,
                  border: 'none',
                  cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease',
                }}
                title="Send"
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 1L11 6L6 11M11 6H1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
              {card.subFiles ? (
                <ExpandableFileCard title={card.title} subFiles={card.subFiles} />
              ) : (
                <FileCard title={card.title} url={card.url!} />
              )}
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

      {/* Floating Design Center AI button + chat drawer — bottom-right, this page only */}
      <FloatingDesignCenterAI />
    </div>
  )
}
