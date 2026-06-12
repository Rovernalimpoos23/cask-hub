'use client'
// src/app/(app)/president/overview/page.tsx

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { TopBar } from '@/components/ui'

// ── Floating President AI — palette + chat config ────────────────────
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
  "President AI online. I have context on Calin's meeting cadence — annual, quarterly, monthly, weekly, and daily workflows, PIT goals, and team alignment. Ask about meeting agendas, workflows, or what to prepare."

const QUICK_PROMPTS = ['Weekly meeting prep', 'PIT goals status', 'Daily huddle agenda']

interface PanelMsg {
  role: 'user' | 'assistant'
  content: string
}

const FREQ = {
  annual:    { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'Annual' },
  quarterly: { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', label: 'Quarterly' },
  monthly:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Monthly' },
  weekly:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Weekly' },
  daily:     { color: '#dc4f2a', bg: '#fff5f3', border: '#fecaca', label: 'Daily' },
} as const

type Freq = keyof typeof FREQ

interface PersonItem { name: string }
interface SubSubItem { title: string; personItems?: PersonItem[]; modalKey?: string }
interface SubItem { title: string; subItems?: SubSubItem[]; modalKey?: string; personItems?: PersonItem[] }
interface MeetingLevel { title: string; freq: Freq; subItems?: SubItem[]; modalKey?: string }

const LEVELS: MeetingLevel[] = [
  { title: 'Annual Strategy Meeting', freq: 'annual', modalKey: 'annual-strategy' },
  { title: 'Yearly Company Strategic Alignment', freq: 'annual', modalKey: 'yearly-strategic-alignment' },
  { title: 'Quarterly Meetings', freq: 'quarterly', modalKey: 'quarterly-meetings' },
  {
    title: 'Monthly Check-ins',
    freq: 'monthly',
    modalKey: 'monthly-check-ins',
    subItems: [{
      title: 'DISC',
      personItems: [
        { name: 'Jeff Azcona' },
        { name: 'Lamont Gilyot' },
        { name: 'Kaitlyn Grunenberg' },
        { name: 'Matteo Carpani' },
      ],
    }],
  },
  {
    title: 'Weekly Meetings',
    freq: 'weekly',
    subItems: [
      { title: 'PIT Goals', modalKey: 'pit-goals' },
      {
        title: 'Department Alignment',
        subItems: [
          { title: 'DISC' },
          { title: 'Team Alignment – Hitting Our $20M Goal', modalKey: 'team-alignment' },
          { title: 'Department Roles and Responsibilities', modalKey: 'dept-roles' },
        ],
      },
    ],
  },
  {
    title: 'Daily Huddles',
    freq: 'daily',
    subItems: [
      { title: 'Daily Meeting – Calin and Kai', modalKey: 'daily-calin-kai' },
      { title: 'Data Planning Meeting with Joseph', modalKey: 'data-planning-joseph' },
    ],
  },
]

// ── DISC profile data ─────────────────────────────────────────────────────────

interface DiscProfile {
  style: string
  styleLabel: string
  styleColor: string
  styleBg: string
  styleBorder: string
  assessmentDate: string
  tagline: string
  traits: string[]
  strengths: string[]
  growthAreas: string[]
  sharePointUrl: string
}

const DISC_PROFILES: Record<string, DiscProfile> = {
  'Jeff Azcona': {
    style: 'i',
    styleLabel: 'i — Influence',
    styleColor: '#d97706',
    styleBg: '#fffbeb',
    styleBorder: '#fde68a',
    assessmentDate: 'May 23, 2023',
    tagline: 'Strongly inclined toward the i style — dot near the edge of the circle.',
    traits: [
      'Outgoing, enthusiastic, and optimistic',
      'Thrives on relating to and connecting with others',
      'Promotes opinions with passion and wholeheartedness',
      'Quick-paced, gut-instinct decision maker',
      'High energy with a strong ability to initiate action',
    ],
    strengths: [
      'Generates excitement and gets people fired up about goals',
      'Builds an extensive network of friends and colleagues',
      'Brings people together — naturally unifies groups',
      'Gifted storyteller with a colorful, engaging communication style',
      'Actively solicits ideas and sees brainstorming as endless possibility',
    ],
    growthAreas: [
      'May monopolize conversations, especially with soft-spoken people',
      'Optimism can lead to overestimating own abilities or task difficulty',
      'Tends to dive into projects without adequate planning or resources',
      'Avoids conflict — may suppress frustration until it reaches a breaking point',
    ],
    sharePointUrl: 'https://caskconstruction.sharepoint.com/sites/CASKConstruction/Shared%20Documents/Forms/AllItems.aspx?viewid=e70addd7%2D1c61%2D417d%2Dab4e%2Dec2c4bb59e3d&ct=1779743714745&or=WORD%2DWEB%2EBODY%2ENT&id=%2Fsites%2FCASKConstruction%2FShared%20Documents%2FHR%2FDISC%2FAzcona%5FJeff%20DiSC%20Profile%20Report%2Epdf&parent=%2Fsites%2FCASKConstruction%2FShared%20Documents%2FHR%2FDISC',
  },
  'Lamont Gilyot': {
    style: 'C',
    styleLabel: 'C — Conscientiousness',
    styleColor: '#2563eb',
    styleBg: '#eff6ff',
    styleBorder: '#bfdbfe',
    assessmentDate: 'Placeholder — full report on file',
    tagline: 'Strongly inclined toward the C style — precise, analytical, and committed to quality and accuracy.',
    traits: [
      'Analytical and detail-oriented in all financial decisions',
      'Systematic thinker who relies on data over intuition',
      'High standards for accuracy and thoroughness',
      'Methodical approach to problem-solving and process improvement',
      'Reserved and deliberate — thinks before speaking or acting',
    ],
    strengths: [
      'Builds rigorous financial systems and controls that scale with the business',
      'Identifies risks and gaps before they become problems',
      'Produces highly accurate reporting that leadership can trust',
      'Creates structured workflows that reduce manual error and increase efficiency',
      'Maintains long-term financial discipline even under growth pressure',
    ],
    growthAreas: [
      'May over-analyze before making a decision, slowing momentum',
      'Can be perceived as overly critical when reviewing others\' work',
      'Preference for precision may create friction in fast-moving situations',
      'May withdraw during conflict rather than addressing it directly',
    ],
    sharePointUrl: 'https://caskconstruction.sharepoint.com/:b:/s/CASKConstruction/IQAZBnT6jTHGRoDuySuUqCBKAT7z1NfpDvsnGLmIk00ucAM?e=NWDczT',
  },
  'Kaitlyn Grunenberg': {
    style: 'S',
    styleLabel: 'S — Steadiness',
    styleColor: '#16a34a',
    styleBg: '#f0fdf4',
    styleBorder: '#bbf7d0',
    assessmentDate: 'Placeholder — full report on file',
    tagline: 'Strongly inclined toward the S style — reliable, people-focused, and committed to building a stable, thriving team.',
    traits: [
      'Calm, patient, and consistent under pressure',
      'Deeply relationship-oriented — values trust and long-term connection',
      'Loyal and dependable; follows through on commitments',
      'Thoughtful listener who creates space for others to be heard',
      'Prefers stability and collaborative decision-making over rapid change',
    ],
    strengths: [
      'Builds a culture of trust, fairness, and psychological safety',
      'Develops people with genuine care for their growth and success',
      'Maintains team morale and cohesion during challenging periods',
      'Creates HR systems and processes that are consistent and people-centered',
      'Bridges communication between leadership and team members effectively',
    ],
    growthAreas: [
      'May avoid difficult conversations to preserve harmony',
      'Can be resistant to sudden change without adequate context or lead time',
      'Tendency to absorb others\' stress — needs strong personal boundaries',
      'May under-advocate for own needs or perspective in group settings',
    ],
    sharePointUrl: 'https://caskconstruction.sharepoint.com/:b:/s/CASKConstruction/IQAZBnT6jTHGRoDuySuUqCBKAT7z1NfpDvsnGLmIk00ucAM?e=Eb6Qhl',
  },
  'Matteo Carpani': {
    style: 'D',
    styleLabel: 'D — Dominance',
    styleColor: '#dc4f2a',
    styleBg: '#fff5f3',
    styleBorder: '#fecaca',
    assessmentDate: 'Placeholder — full report on file',
    tagline: 'Strongly inclined toward the D style — decisive, results-driven, and focused on moving fast and building big.',
    traits: [
      'Direct, confident, and action-oriented in all decisions',
      'Driven by results — sets high expectations for self and others',
      'Entrepreneurial mindset with a strong bias toward execution',
      'Thrives in competitive, fast-paced environments',
      'Challenges the status quo and pushes for continuous improvement',
    ],
    strengths: [
      'Moves projects forward quickly and cuts through ambiguity',
      'Holds teams accountable to timelines and outcomes',
      'Sees the big picture and takes initiative without waiting for direction',
      'Effective at building operational structure in high-growth environments',
      'Brings drive and urgency that elevates the pace of the team around him',
    ],
    growthAreas: [
      'May prioritize speed over process, creating gaps in documentation or follow-through',
      'Direct communication style can come across as blunt or dismissive',
      'May take on too much independently rather than delegating effectively',
      'Can underestimate the emotional impact of decisions on team members',
    ],
    sharePointUrl: 'https://caskconstruction.sharepoint.com/:b:/s/CASKConstruction/IQBPKZtpUr5ARasqVu4hBDv7AYfxJnhBQq2n7FVAkySWxnw?e=KGbCE6',
  },
}

// ── File modal ────────────────────────────────────────────────────────────────

function FileModal({ name, onClose }: { name: string; onClose: () => void }) {
  const profile = DISC_PROFILES[name]

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
          width: 560,
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
              DiSC Profile — Department Alignment
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

        {profile ? (
          <>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Style badge + date */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[12px] font-bold px-3 py-1 rounded-full tracking-[0.2px]"
                  style={{ background: profile.styleBg, color: profile.styleColor, border: `1px solid ${profile.styleBorder}` }}
                >
                  {profile.styleLabel}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                  Assessed {profile.assessmentDate}
                </span>
              </div>

              {/* Tagline */}
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                {profile.tagline}
              </p>

              {/* Key Traits */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Key Traits
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.traits.map(t => (
                    <li key={t} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: profile.styleColor }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Strengths */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Strengths
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.strengths.map(s => (
                    <li key={s} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: '#16a34a' }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Growth Areas */}
              <div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
                  Growth Areas
                </div>
                <ul className="flex flex-col gap-1.5">
                  {profile.growthAreas.map(g => (
                    <li key={g} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 5, height: 5, background: '#dc4f2a' }} />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer — View Full Report */}
            <div
              className="shrink-0 px-5 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <a
                href={profile.sharePointUrl}
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
                View Full Report
              </a>
            </div>
          </>
        ) : (
          /* Placeholder for profiles not yet added */
          <div
            className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-12"
            style={{ color: 'var(--text3)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p className="text-[13px] text-center" style={{ opacity: 0.5 }}>
              DiSC content will be added here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PIT Goals modal ───────────────────────────────────────────────────────────

const PIT_DEPT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Sales:           { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  Marketing:       { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  Preconstruction: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  Construction:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  Finance:         { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Administrative:  { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
}

function pitStatus(pct: number) {
  if (pct >= 100) return { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', bar: '#22c55e', icon: '✅' }
  if (pct >= 75)  return { color: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: '#f59e0b', icon: '🟡' }
  return             { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444', icon: '🔴' }
}

const PIT_SUMMARY_STATS = [
  { label: 'PIT Submitted',      actual: 78, target: 61 },
  { label: 'PS Submitted',       actual: 63, target: 63 },
  { label: 'Dept Team Review',   actual: 55, target: 81 },
  { label: 'Dept Team Approval', actual: 23, target: 25 },
  { label: 'SOP Created',        actual:  5, target: 25 },
]

const PIT_Q1_DEPTS = [
  { dept: 'Finance',          count: 14 },
  { dept: 'Preconstruction',  count: 10 },
  { dept: 'Sales',            count:  7 },
  { dept: 'Construction',     count:  5 },
  { dept: 'Marketing',        count:  4 },
  { dept: 'Administrative',   count:  1 },
]

const PIT_Q2_DEPTS = [
  { dept: 'Administrative',   count: 10 },
  { dept: 'Preconstruction',  count:  7 },
  { dept: 'Construction',     count:  3 },
  { dept: 'Sales',            count:  3 },
  { dept: 'Marketing',        count:  0 },
  { dept: 'Finance',          count:  0 },
]

const PIT_LEADERBOARD = [
  { name: 'Jeff Azcona',            pits: 17, depts: ['Sales', 'Marketing'] },
  { name: 'Kait Grunenberg',        pits: 14, depts: ['Preconstruction', 'Administrative', 'Construction'] },
  { name: 'Lamont Gilyot',          pits: 13, depts: ['Finance'] },
  { name: 'Calin Noonan',           pits: 10, depts: ['Administrative', 'Sales', 'Construction', 'Marketing', 'Preconstruction'] },
  { name: 'Matteo Carpani',         pits:  4, depts: ['Preconstruction'] },
  { name: 'Chad Holman',            pits:  2, depts: ['Preconstruction'] },
  { name: 'Tim Ritschel',           pits:  2, depts: ['Construction', 'Preconstruction'] },
  { name: 'Kelly Cuffel',           pits:  2, depts: ['Preconstruction'] },
  { name: 'Douglas Mertens',        pits:  1, depts: ['Construction'] },
  { name: 'Eric Bressler',          pits:  1, depts: ['Construction'] },
  { name: 'Peter Deutelmoser',      pits:  1, depts: ['Construction'] },
  { name: 'Jessica Zientarski',     pits:  1, depts: ['Sales'] },
  { name: 'Jasmin Salangsang',      pits:  1, depts: ['Finance'] },
  { name: 'Kevin Joshua Balmaceda', pits:  1, depts: ['Sales'] },
  { name: 'Kai Mapoy',              pits:  1, depts: ['Administrative'] },
  { name: 'Cooper Hermansen',       pits:  1, depts: ['Construction'] },
  { name: 'Joseph Estelloso',       pits:  1, depts: ['Sales'] },
]

const PIT_INACTIVE = [
  { name: 'Kait Grunenberg',  pits: 8, depts: ['Preconstruction', 'Administrative', 'Construction'] },
  { name: 'Calin Noonan',     pits: 2, depts: ['Administrative', 'Preconstruction'] },
  { name: 'Matteo Carpani',   pits: 1, depts: ['Preconstruction'] },
  { name: 'Kai Mapoy',        pits: 1, depts: ['Administrative'] },
  { name: 'Cooper Hermansen', pits: 1, depts: ['Construction'] },
  { name: 'Chad Holman',      pits: 1, depts: ['Preconstruction'] },
  { name: 'Jeff Azcona',      pits: 1, depts: ['Sales', 'Marketing'] },
]

interface PitGoalEntry {
  person: string
  dept: string
  description: string
  status: 'PIT Submitted' | 'PS Submitted' | 'Department Team Review' | 'Department Team Approval' | 'SOP Created'
  urgency: 'Critical' | 'Moderate' | 'Low'
  leverage: 'People and Education' | 'Systems and Technology' | 'Delivery and Distribution' | 'Testing and Measuring'
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  days: number
}

const PIT_STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  'PIT Submitted':            { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  'PS Submitted':             { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Department Team Review':   { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'Department Team Approval': { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  'SOP Created':              { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
}

const PIT_URGENCY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Critical: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  Moderate: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  Low:      { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
}

const PIT_LEVERAGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  'People and Education':      { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  'Systems and Technology':    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Delivery and Distribution': { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  'Testing and Measuring':     { color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
}

const PIT_ALL_GOALS: PitGoalEntry[] = [
  // Kait Grunenberg
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Finalize and roll out PM Onboarding Training', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Set and schedule monthly employee trainings for Q1', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Plan and execute March Quarterly Employee Event', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Begin transition into recruiting responsibilities', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP Hiring-General', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 36 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP General Onboarding', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 36 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Formal Performance Notice & 30-Day Improvement Plan', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 36 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Ordering Business Cards', status: 'PIT Submitted', urgency: 'Low', leverage: 'Systems and Technology', quarter: 'Q4', days: 36 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP for Person being fired/quit', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q3', days: 36 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Employee Review tracking system', status: 'Department Team Review', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q2', days: 34 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP for employee reviews', status: 'Department Team Review', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q2', days: 34 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP on document control', status: 'PIT Submitted', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q2', days: 34 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'Request Hiring Process', status: 'PIT Submitted', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q3', days: 34 },
  { person: 'Kait Grunenberg', dept: 'Preconstruction', description: 'SOP for when trades are working weekends', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 14 },
  // Jeff Azcona
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Updated proposal range pricing for new home builds up to 6K sq ft', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Updated sales workflow outlining 2 lead funnels', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Outline Scorecard for business development manager', status: 'Department Team Review', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Update sales questionnaire', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Revise sales process to support smaller upfront precon cost', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Architect and referral partner questionnaire', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Internal project scorecard criteria', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Add option for customer to purchase on website', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Create co-branding marketing packet for referral partners', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Revise and update website for new home builds', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Update sales materials for contract execution', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Standard book to review with prospect architects', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Onboard John with Acana marketing strategy', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Hire marketing VA for digital ads', status: 'Department Team Review', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q3', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'New precon and construction signage', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: 'Establish tracker for co-branding marketing referral partners', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 114 },
  { person: 'Jeff Azcona', dept: 'Sales', description: '2nd In-person Meeting Template', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q2', days: 4 },
  // Lamont Gilyot
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Centralized AP Infrastructure - Launch shared AP inbox', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Centralized AP Infrastructure - Formalize intake and routing workflow', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Centralized AP Infrastructure - Remove ad hoc invoice routing', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Centralized AP Infrastructure - Reduce executive-level email dependence', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Centralized AP Infrastructure - Position AP for scalable delegation', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Forecasting System Upgrade - Beta version of enhanced forecasting model', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Forecasting System Upgrade - Defined cross-department reporting inputs', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Forecasting System Upgrade - Recurring forecast meeting cadence', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Forecasting System Upgrade - Identification of automation opportunities', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Forecasting System Upgrade - Reduction of manual information relay', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Customer Journey Financial Control - Verify documentation timing', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Testing and Measuring', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Customer Journey Financial Control - Confirm compliance triggers', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Testing and Measuring', quarter: 'Q1', days: 114 },
  { person: 'Lamont Gilyot', dept: 'Finance', description: 'Customer Journey Financial Control - Ensure financial risk mitigation', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Testing and Measuring', quarter: 'Q1', days: 114 },
  // Calin Noonan
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Have a consistent PIT meeting set up', status: 'SOP Created', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Develop an Architect List', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Develop a Contractor List', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Develop an Outreach Process for both lists', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q2', days: 114 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Align with Strategic Partners', status: 'Department Team Approval', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 114 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Standered DWG 3 new builds and ADUs', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 63 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Standered DWG section and templates', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 61 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Standered DWG contracts', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 61 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Estimating process and Hire VA', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q2', days: 61 },
  { person: 'Calin Noonan', dept: 'Administrative', description: 'Bid/takeoff process and Hire VA', status: 'PS Submitted', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q2', days: 61 },
  // Matteo Carpani
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'Hiring 1 PM', status: 'Department Team Review', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q1', days: 114 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'ACE Finalize it', status: 'SOP Created', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'CRM for Precon', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'Selection Pre Made it', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 114 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'Quality Control Position', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q3', days: 49 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'HIRING VA for BID', status: 'Department Team Approval', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q2', days: 49 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'Hiring 1 New Expert PM', status: 'Department Team Review', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q2', days: 49 },
  { person: 'Matteo Carpani', dept: 'Preconstruction', description: 'ESTIMATOR/BID DEPARTMENT', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 49 },
  // Chad Holman
  { person: 'Chad Holman', dept: 'Preconstruction', description: 'Disengaged Customer Process', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 70 },
  { person: 'Chad Holman', dept: 'Preconstruction', description: 'TOPO Survey Communication', status: 'PIT Submitted', urgency: 'Critical', leverage: 'Delivery and Distribution', quarter: 'Q2', days: 15 },
  // Tim Ritschel
  { person: 'Tim Ritschel', dept: 'Construction', description: 'Construction and Financial Closeout', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 106 },
  { person: 'Tim Ritschel', dept: 'Construction', description: 'As-Built Uniformity', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 63 },
  { person: 'Tim Ritschel', dept: 'Construction', description: 'Add Best Practices Checklist to Buildertrend', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Testing and Measuring', quarter: 'Q2', days: 20 },
  // Kelly Cuffel
  { person: 'Kelly Cuffel', dept: 'Preconstruction', description: 'CASK facing portion of the customer journey', status: 'Department Team Review', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q2', days: 55 },
  { person: 'Kelly Cuffel', dept: 'Preconstruction', description: 'Selections Issues Tracker', status: 'SOP Created', urgency: 'Critical', leverage: 'Systems and Technology', quarter: 'Q2', days: 55 },
  // Others
  { person: 'Douglas Mertens',        dept: 'Construction',   description: 'Pre construction meeting at Footer stage', status: 'SOP Created', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 111 },
  { person: 'Eric Bressler',          dept: 'Construction',   description: 'Superintendents', status: 'Department Team Approval', urgency: 'Critical', leverage: 'People and Education', quarter: 'Q1', days: 104 },
  { person: 'Peter Deutelmoser',      dept: 'Construction',   description: 'Kimal Lumber free pick up of extra materials', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Delivery and Distribution', quarter: 'Q1', days: 101 },
  { person: 'Jessica Zientarski',     dept: 'Sales',          description: 'SOP for 2nd In Person Meeting', status: 'SOP Created', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q1', days: 88 },
  { person: 'Jasmin Salangsang',      dept: 'Finance',        description: 'Centralized AP email', status: 'PS Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q1', days: 84 },
  { person: 'Kevin Joshua Balmaceda', dept: 'Sales',          description: 'Sales to Precon Standardized Alignment', status: 'Department Team Review', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 34 },
  { person: 'Kai Mapoy',              dept: 'Administrative', description: 'Virtual Assistants Onboarding Process', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'People and Education', quarter: 'Q2', days: 29 },
  { person: 'Cooper Hermansen',       dept: 'Construction',   description: 'Changing the OOO SOP', status: 'PIT Submitted', urgency: 'Moderate', leverage: 'Systems and Technology', quarter: 'Q2', days: 28 },
  { person: 'Joseph Estelloso',       dept: 'Sales',          description: 'BT – Sales and Marketing File (Semi-Automatic Process)', status: 'PS Submitted', urgency: 'Critical', leverage: 'Systems and Technology', quarter: 'Q2', days: 19 },
]

type PitTab = 'all' | 'q1' | 'q2'

function PitDeptBadge({ dept }: { dept: string }) {
  const c = PIT_DEPT_COLORS[dept] ?? PIT_DEPT_COLORS.Administrative
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] tracking-[0.3px] uppercase shrink-0"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {dept}
    </span>
  )
}

function PitModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<PitTab>('all')
  const [fPerson,   setFPerson]   = useState('')
  const [fDept,     setFDept]     = useState('')
  const [fStatus,   setFStatus]   = useState('')
  const [fQuarter,  setFQuarter]  = useState('')
  const [fUrgency,  setFUrgency]  = useState('')

  const filteredGoals = PIT_ALL_GOALS.filter(g =>
    (!fPerson  || g.person  === fPerson)  &&
    (!fDept    || g.dept    === fDept)    &&
    (!fStatus  || g.status  === fStatus)  &&
    (!fQuarter || g.quarter === fQuarter) &&
    (!fUrgency || g.urgency === fUrgency)
  )

  const qDepts  = tab === 'q1' ? PIT_Q1_DEPTS  : tab === 'q2' ? PIT_Q2_DEPTS  : null
  const qActual = tab === 'q1' ? 41 : tab === 'q2' ? 23 : null
  const qTarget = tab === 'q1' ? 25 : tab === 'q2' ? 36 : null
  const qPct    = qActual != null && qTarget != null ? Math.round((qActual / qTarget) * 100) : null
  const maxDept = qDepts ? Math.max(...qDepts.map(d => d.count), 1) : 1

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
          width: 680,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 60px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: 'var(--text)' }}>PIT Goals Dashboard</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>Weekly Meetings · President Workflow</div>
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* ── All-Time Summary Cards ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              All-Time Summary
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {PIT_SUMMARY_STATS.map(({ label, actual, target }) => {
                const pct = Math.round((actual / target) * 100)
                const s = pitStatus(pct)
                return (
                  <div key={label} className="rounded-[8px] px-3 pt-3 pb-2.5 flex flex-col gap-2" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <div className="text-[10px] font-semibold leading-tight" style={{ color: s.color }}>{label}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-[22px] font-bold leading-none tracking-[-0.5px]" style={{ color: s.color }}>{actual}</span>
                      <span className="text-[10px] mb-0.5" style={{ color: s.color, opacity: 0.65 }}>/{target}</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(0,0,0,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: s.bar }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold" style={{ color: s.color }}>{pct}%</span>
                      <span className="text-[12px]">{s.icon}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Quarter Tabs + Dept Breakdown ── */}
          <div>
            <div className="flex items-center gap-1 mb-4 p-1 rounded-[7px]" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', width: 'fit-content' }}>
                {([['all', 'All Time'], ['q1', 'Q1 2026'], ['q2', 'Q2 2026']] as [PitTab, string][]).map(([key, label]) => (
                <button
                  key={key} type="button"
                  className="text-[11px] font-semibold px-3 py-1 rounded-[5px]"
                  style={{
                    background: tab === key ? 'var(--surface)' : 'transparent',
                    color: tab === key ? 'var(--text)' : 'var(--text3)',
                    border: tab === key ? '1px solid var(--border)' : '1px solid transparent',
                    fontFamily: 'inherit', cursor: 'pointer',
                    boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                  }}
                  onClick={() => setTab(key)}
                >{label}</button>
              ))}
            </div>

            {qPct != null && qActual != null && qTarget != null ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 rounded-[8px] mb-4" style={{ background: pitStatus(qPct).bg, border: `1px solid ${pitStatus(qPct).border}` }}>
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.8px] uppercase mb-0.5" style={{ color: pitStatus(qPct).color }}>
                      {tab === 'q1' ? 'Q1 2026 — Previous Quarter' : 'Q2 2026 — Current Quarter'}
                    </div>
                    <div className="text-[12px]" style={{ color: pitStatus(qPct).color, opacity: 0.8 }}>
                      {qActual} PITs submitted · Target: {qTarget}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[24px] font-bold tracking-[-0.5px]" style={{ color: pitStatus(qPct).color }}>{qPct}%</span>
                    <span className="text-[16px]">{pitStatus(qPct).icon}</span>
                  </div>
                </div>
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2.5" style={{ color: 'var(--text3)' }}>Department Breakdown</div>
                <div className="flex flex-col gap-2">
                  {qDepts!.map(({ dept, count }) => {
                    const dc = PIT_DEPT_COLORS[dept] ?? PIT_DEPT_COLORS.Administrative
                    return (
                      <div key={dept} className="flex items-center gap-3">
                        <div className="text-[11.5px] font-medium shrink-0" style={{ width: 118, color: 'var(--text2)' }}>{dept}</div>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round((count / maxDept) * 100)}%`, background: dc.color }} />
                        </div>
                        <span className="shrink-0 text-[11.5px] font-bold w-5 text-right" style={{ color: dc.color }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-[12px]" style={{ color: 'var(--text3)' }}>Select a quarter above to see the department breakdown.</div>
            )}
          </div>

          {/* ── Leaderboard ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              All-Time Leaderboard
            </div>
            <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="grid text-[10px] font-semibold px-4 py-2" style={{ gridTemplateColumns: '22px 1fr auto 36px', gap: '10px', background: 'var(--surface2)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                <span>#</span><span>Team Member</span><span>Departments</span><span className="text-right">PITs</span>
              </div>
              {PIT_LEADERBOARD.map(({ name, pits, depts }, i) => (
                <div
                  key={name}
                  className="grid items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: '22px 1fr auto 36px', gap: '10px', borderBottom: i < PIT_LEADERBOARD.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <span className="text-[11px] font-bold" style={{ color: i === 0 ? '#2563eb' : i === 1 ? '#7c3aed' : i === 2 ? '#d97706' : 'var(--text3)' }}>
                    {i + 1}
                  </span>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{name}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {depts.map(d => <PitDeptBadge key={d} dept={d} />)}
                  </div>
                  <span className="text-[13px] font-bold text-right" style={{ color: 'var(--text)' }}>{pits}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Individual PIT Goals ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>Individual PIT Goals</div>
                <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-[3px]" style={{ background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                  {filteredGoals.length} of {PIT_ALL_GOALS.length}
                </span>
              </div>
              {(fPerson || fDept || fStatus || fQuarter || fUrgency) && (
                <button
                  type="button"
                  className="text-[10px] font-semibold"
                  style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => { setFPerson(''); setFDept(''); setFStatus(''); setFQuarter(''); setFUrgency('') }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {([
                ['Person',     fPerson,   setFPerson,   ['Jeff Azcona','Kait Grunenberg','Lamont Gilyot','Calin Noonan','Matteo Carpani','Chad Holman','Tim Ritschel','Kelly Cuffel','Douglas Mertens','Eric Bressler','Peter Deutelmoser','Jessica Zientarski','Jasmin Salangsang','Kevin Joshua Balmaceda','Kai Mapoy','Cooper Hermansen','Joseph Estelloso']],
                ['Dept',       fDept,     setFDept,     ['Sales','Marketing','Preconstruction','Construction','Finance','Administrative']],
                ['Status',     fStatus,   setFStatus,   ['PIT Submitted','PS Submitted','Department Team Review','Department Team Approval','SOP Created']],
                ['Quarter',    fQuarter,  setFQuarter,  ['Q1','Q2','Q3','Q4']],
                ['Urgency',    fUrgency,  setFUrgency,  ['Critical','Moderate','Low']],
              ] as [string, string, (v: string) => void, string[]][]).map(([label, val, setter, opts]) => (
                <select
                  key={label}
                  value={val}
                  onChange={e => setter(e.target.value)}
                  className="text-[10.5px] font-medium rounded-[6px] px-2 py-1.5 w-full"
                  style={{
                    background: 'var(--surface2)',
                    color: val ? 'var(--text)' : 'var(--text3)',
                    border: val ? '1px solid #2563eb' : '1px solid var(--border)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    appearance: 'auto',
                  }}
                >
                  <option value="">All {label}s</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
            </div>

            {/* Table */}
            {filteredGoals.length === 0 ? (
              <div className="text-center py-6 text-[12px]" style={{ color: 'var(--text3)' }}>No goals match the current filters.</div>
            ) : (
              <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {/* Header */}
                <div
                  className="grid text-[9.5px] font-semibold px-3 py-2 gap-2"
                  style={{ gridTemplateColumns: '100px 1fr 118px 60px 90px 28px 38px', background: 'var(--surface2)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
                >
                  <span>Person</span>
                  <span>PIT Goal</span>
                  <span>Status</span>
                  <span>Urgency</span>
                  <span>Leverage</span>
                  <span>Q</span>
                  <span className="text-right">Days</span>
                </div>
                {/* Rows */}
                {filteredGoals.map((g, i) => {
                  const ss = PIT_STATUS_STYLES[g.status]
                  const us = PIT_URGENCY_STYLES[g.urgency]
                  const ls = PIT_LEVERAGE_STYLES[g.leverage]
                  const dc = PIT_DEPT_COLORS[g.dept] ?? PIT_DEPT_COLORS.Administrative
                  return (
                    <div
                      key={i}
                      className="grid items-start px-3 py-2 gap-2"
                      style={{ gridTemplateColumns: '100px 1fr 118px 60px 90px 28px 38px', borderBottom: i < filteredGoals.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      {/* Person + Dept */}
                      <div className="flex flex-col gap-1 pt-0.5">
                        <span className="text-[11px] font-medium leading-tight" style={{ color: 'var(--text)' }}>{g.person}</span>
                        <span className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded-[3px] uppercase self-start" style={{ background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>{g.dept}</span>
                      </div>
                      {/* Description */}
                      <span className="text-[11.5px] leading-snug pt-0.5" style={{ color: 'var(--text2)' }}>{g.description}</span>
                      {/* Status */}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] self-start mt-0.5 leading-tight text-center" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{g.status}</span>
                      {/* Urgency */}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] self-start mt-0.5" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>{g.urgency}</span>
                      {/* Leverage */}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] self-start mt-0.5 leading-tight" style={{ background: ls.bg, color: ls.color, border: `1px solid ${ls.border}` }}>{g.leverage}</span>
                      {/* Quarter */}
                      <span className="text-[10.5px] font-semibold pt-0.5" style={{ color: 'var(--text3)' }}>{g.quarter}</span>
                      {/* Days */}
                      <span className="text-[10.5px] font-semibold text-right pt-0.5" style={{ color: 'var(--text3)' }}>{g.days}d</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Inactive PITs ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>Inactive PIT Submitted</div>
              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-[3px]" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                ⚠ Needs Action
              </span>
            </div>
            <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid #fecaca' }}>
              {PIT_INACTIVE.map(({ name, pits, depts }, i) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < PIT_INACTIVE.length - 1 ? '1px solid #fecaca' : 'none', background: '#fef2f2' }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-[12px] font-medium shrink-0" style={{ color: '#7f1d1d' }}>{name}</span>
                    {depts.map(d => <PitDeptBadge key={d} dept={d} />)}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: '#b91c1c' }}>{pits} {pits === 1 ? 'PIT' : 'PITs'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Latest Weekly Update ── */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
              Latest Weekly Update
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-[8px]" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>Week of 5/24/2026</div>
                <div className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>Jeff Azcona</div>
              </div>
              <div className="flex items-center gap-1.5">
                <PitDeptBadge dept="Sales" />
                <PitDeptBadge dept="Marketing" />
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                  1 PIT
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="https://caskconstruction.sharepoint.com/:x:/s/CASKConstruction/IQATkTe2nosHSaqOz5PAgd1zAQnksU-Bf2OQt0Bl5soI00Y?e=lO3nZy"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-[7px] text-[12px] font-semibold transition-opacity no-underline"
            style={{ background: 'var(--charcoal)', color: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            View Full Report
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Daily Meeting – Calin and Kai modal ──────────────────────────────────────

const DAILY_CALIN_KAI_AGENDA = [
  {
    number: '1',
    title: 'Calendar Review',
    items: [
      'Identify conflicts, overlaps, or scheduling gaps',
      'Confirm meeting priorities',
      'Flag meetings requiring preparation or materials',
    ],
  },
  {
    number: '2',
    title: 'Emails',
    items: [
      'Review unread and priority emails from yesterday',
      'Review flagged emails',
      'Questions on filing',
    ],
  },
  {
    number: '3',
    title: 'Task Progress, Follow-ups and Priorities',
    items: [
      'Review status of previously assigned items',
      'Updates on action items — Pres task tracker',
      'Completed / updated tasks',
      'In-progress tasks and current status',
    ],
  },
  {
    number: '4',
    title: 'Quick Recap',
    items: [
      'Confirm key action items',
      'Confirm priorities for the day',
      'Ensure nothing urgent was missed',
    ],
  },
]

// TODO: Replace '#' below with the SharePoint document URL when available
const DAILY_CALIN_KAI_URL = '#'

function DailyCalinKaiModal({ onClose }: { onClose: () => void }) {
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
              Daily Huddle — Calin &amp; Kai
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Facilitator: Kai Mapoy · Attendees: Calin Noonan, Kai Mapoy
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>
            Meeting Agenda
          </div>
          {DAILY_CALIN_KAI_AGENDA.map((section) => (
            <div key={section.number}>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ width: 20, height: 20, background: '#dc4f2a' }}
                >
                  {section.number}
                </div>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  {section.title}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5" style={{ marginLeft: 30 }}>
                {section.items.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <a
            href={DAILY_CALIN_KAI_URL}
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

// ── Expandable DISC row ───────────────────────────────────────────────────────

function DiscExpandable({ subsub }: { subsub: { title: string; personItems?: PersonItem[] } }) {
  const [open, setOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  return (
    <div>
      {/* DISC header row — clickable */}
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="shrink-0 rounded-full"
          style={{ width: 4, height: 4, background: 'var(--border2)' }}
        />
        <span className="text-[11.5px] font-medium" style={{ color: 'var(--text3)' }}>
          {subsub.title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            color: 'var(--text3)',
            opacity: 0.5,
            flexShrink: 0,
            transition: 'transform 180ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Person rows */}
      {open && subsub.personItems && (
        <div className="flex flex-col gap-1.5 mt-2" style={{ marginLeft: 14 }}>
          {subsub.personItems.map((person) => (
            <div key={person.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: 3, height: 3, background: 'var(--border2)' }}
                />
                <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
                  {person.name}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveModal(person.name)}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                View File
              </button>
            </div>
          ))}
        </div>
      )}

      {activeModal && (
        <FileModal name={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FreqIcon({ freq }: { freq: Freq }) {
  const f = FREQ[freq]
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[8px]"
      style={{ width: 34, height: 34, background: f.bg, border: `1px solid ${f.border}` }}
    >
      {freq === 'daily' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
        </svg>
      ) : freq === 'weekly' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
    </div>
  )
}

function DownArrow() {
  return (
    <div className="flex justify-center" style={{ padding: '3px 0' }}>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
        <line x1="7" y1="0" x2="7" y2="17" stroke="var(--border2)" strokeWidth="1.5"/>
        <polyline points="3,13 7,19 11,13" stroke="var(--border2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Level card ────────────────────────────────────────────────────────────────

function AnnualStrategyModal({ onClose }: { onClose: () => void }) {
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
          width: 560,
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
              Annual Strategic Planning Session
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Calin &amp; Chad · Timing: November
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Prep Material */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Prep Material for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Participants should review the following materials prior to the session:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Review Big Vision (10-Year Vision)',
                "Review Last Year's Goals",
                'Review Current Strategic Plan and KPIs',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links for the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Links for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Include links within the meeting document to the following materials:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Chat GPT channel — Company Planning GPT',
                'Teams channel — Company Planning',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purpose Statement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Purpose Statement of the Meeting
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
              Set a direction for the next year so that each individual department can set their own mission statement and goals for the upcoming year.
            </p>
          </div>

          {/* Outcomes After the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Outcomes After the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Define the expected outcomes from the session, including:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Set a meeting with the Department Heads',
                'Send out the direction and the vision and mission statement for each department to set their goals.',
                'Alignment on long-term company vision',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

function DataPlanningJosephModal({ onClose }: { onClose: () => void }) {
  const meetingFlow = [
    {
      title: 'Active Tasks Recap',
      subItems: [
        'Review all current tasks Joseph is working on',
        'Quick status per task (progress, blockers, completion stage)',
      ],
    },
    {
      title: 'Priority Setting',
      subItems: [
        'Identify top priorities to focus on before next meeting',
        'Align on what matters most',
        'Confirm expected timeline / urgency',
      ],
    },
    {
      title: 'Deep Dive (If Needed)',
      subItems: [
        'Review 1–2 key tasks in detail',
        'Clarify direction, expectations, or next steps',
      ],
    },
    {
      title: 'Email Update Requirement',
      subItems: [
        'Joseph sends an email after every meeting to: Calin, Jeff, Matteo, Others (if working with another PM)',
        'Email must include: Current priorities, Short status per task (1 sentence each), Focus before next meeting',
      ],
    },
  ]

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
              Data Planning Meeting (Joseph)
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Calin + Joseph · Timing: Every Other Day
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="text-[10px] font-semibold tracking-[1.2px] uppercase" style={{ color: 'var(--text3)' }}>
            Meeting Flow
          </div>
          <ul className="flex flex-col gap-3" style={{ marginLeft: 4 }}>
            {meetingFlow.map(section => (
              <li key={section.title}>
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] font-semibold leading-relaxed" style={{ color: 'var(--text)' }}>{section.title}</span>
                </div>
                <ul className="flex flex-col gap-1" style={{ marginLeft: 14 }}>
                  {section.subItems.map(sub => (
                    <li key={sub} className="flex items-start gap-2">
                      <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 3, height: 3, background: 'var(--border2)', opacity: 0.6 }} />
                      <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>{sub}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

interface DeptRole { title: string; person?: string; description: string }
interface DeptSection { department: string; roles: DeptRole[] }

const DEPT_ROLES_DATA: DeptSection[] = [
  {
    department: 'Executive Leadership',
    roles: [
      { title: 'Owners', person: 'Calin Noonan & Chad Holman', description: 'Provide overall company vision, strategic direction, financial oversight, and long-term growth planning for CASK Construction.' },
      { title: 'President', person: 'Calin Noonan', description: 'Leads company operations, drives organizational strategy, oversees leadership execution, and ensures alignment across all departments.' },
      { title: 'Data Analyst', person: 'Joseph Estelloso', description: 'Develops dashboards, KPI tracking systems, reporting tools, and operational analytics to support company decision-making.' },
    ],
  },
  {
    department: 'Operations Department',
    roles: [
      { title: 'VP Operations', person: 'Chad Holman', description: 'Oversees all operational activities, construction execution, project delivery, field performance, and process improvement initiatives.' },
      { title: 'Director of Operations (St. Pete)', description: 'Manages day-to-day operations for the St. Pete division, ensuring project efficiency, scheduling, and team accountability.' },
      { title: 'Director of Operations (Future)', description: 'Future leadership role responsible for expansion and operational scaling.' },
      { title: 'Operations Manager (ADU, Reno & New Build)', person: 'Mateo Carpani', description: 'Coordinates operational workflows for ADU, renovation, and new build projects while supporting project execution teams.' },
    ],
  },
  {
    department: 'Preconstruction & Design Team',
    roles: [
      { title: 'Preconstruction / Design Manager', description: 'Leads estimating, planning, design coordination, and preconstruction workflows.' },
      { title: 'Interior Designer', description: 'Manages selections, finishes, and design coordination with clients and project teams.' },
      { title: 'Draftsman', person: 'Kevin Balmaceda', description: 'Produces architectural drawings, revisions, drafting support, and construction documentation.' },
      { title: 'Selections Admin', person: 'Hazel Mae', description: 'Coordinates material selections, client communication, documentation, and design tracking.' },
    ],
  },
  {
    department: 'Project Management Team',
    roles: [
      { title: 'Project Manager', description: 'Oversees construction projects from planning through completion, including schedules, budgets, subcontractors, and client communication.' },
      { title: 'Assistant Project Manager', description: 'Supports project managers with documentation, coordination, scheduling, and field communication.' },
    ],
  },
  {
    department: 'Field Operations Team',
    roles: [
      { title: 'Lead Superintendent', person: 'Doug Mertens', description: 'Leads field operations, supervises superintendents, ensures jobsite performance, safety, and quality standards.' },
      { title: 'Superintendent', description: 'Manages daily onsite construction activities, subcontractor coordination, scheduling, and project execution.' },
      { title: 'Assistant Superintendent', description: 'Supports field coordination, quality control, scheduling, and onsite communication.' },
      { title: 'Carpenter', description: 'Performs skilled construction work, repairs, installations, and jobsite support.' },
    ],
  },
  {
    department: 'Sales & Marketing Department',
    roles: [
      { title: 'VP Sales & Marketing', person: 'Jeff Azcona', description: 'Leads company sales strategy, marketing initiatives, revenue growth, and client acquisition efforts.' },
    ],
  },
  {
    department: 'Sales Team',
    roles: [
      { title: 'Director of Sales (Main & St. Pete)', description: 'Leads sales operations, sales team development, forecasting, and strategic growth initiatives.' },
      { title: 'Sales Manager (St. Pete)', description: 'Oversees daily sales activities, lead management, and sales process execution.' },
      { title: 'Education & Solution Specialist', description: 'Provides client education, consultation support, and solution-based sales guidance.' },
      { title: 'Sales Analyst & Support', person: 'Leonilo Abbu Jr.', description: 'Supports sales reporting, CRM management, lead tracking, and administrative coordination.' },
      { title: 'Strategic Partnership', person: 'Austin Haid', description: 'Builds and manages referral partnerships, strategic alliances, and business development relationships.' },
      { title: 'Direct Marketer', description: 'Coordinates direct outreach campaigns, lead generation, and prospect engagement initiatives.' },
    ],
  },
  {
    department: 'Marketing Team',
    roles: [
      { title: 'Director of Marketing (Main & St. Pete)', description: 'Oversees branding, campaigns, marketing strategy, and lead generation initiatives.' },
      { title: 'Marketing Manager (St. Pete)', description: 'Executes marketing plans, campaign coordination, and local market initiatives.' },
      { title: 'Creative Director', person: 'Shannon Halvorsen', description: 'Leads branding, creative assets, visual direction, and content development.' },
      { title: 'Marketing Support', description: 'Provides administrative and execution support for marketing campaigns and initiatives.' },
      { title: 'Digital Marketing', description: 'Manages online advertising, SEO, social media, website performance, and digital campaigns.' },
      { title: 'Relationship Marketing', description: 'Focuses on relationship-building initiatives, client engagement, and strategic communication.' },
    ],
  },
  {
    department: 'Finance Department',
    roles: [
      { title: 'VP Finance', person: 'Lamont Gilyot', description: 'Oversees financial strategy, budgeting, forecasting, accounting operations, and financial compliance.' },
      { title: 'Controller', description: 'Manages accounting systems, financial reporting, controls, and compliance processes.' },
      { title: 'Accounting Manager', description: 'Supervises accounting workflows, reconciliations, payables, receivables, and reporting accuracy.' },
      { title: 'Virtual Staff Accountant', person: 'Jasmin Salangsang', description: 'Handles bookkeeping, reconciliations, financial data entry, and accounting support tasks.' },
      { title: 'Virtual Accounting Specialist', person: 'Precious Mae', description: 'Provides accounting administrative support, financial processing, and reporting assistance.' },
      { title: 'Executive Assistant', description: 'Supports executive leadership with scheduling, coordination, communication, and administrative management.' },
      { title: 'Compliance Manager', description: 'Ensures operational compliance, documentation standards, licensing, and internal policy adherence.' },
    ],
  },
  {
    department: 'Human Resources Department',
    roles: [
      { title: 'VP Human Resources', person: 'Kaitlyn Grunenberg', description: 'Leads company HR strategy, employee development, recruiting, engagement, and organizational culture.' },
      { title: 'Compensation & Benefits Manager', description: 'Manages compensation structures, employee benefits, payroll coordination, and HR compliance.' },
      { title: 'Recruiting Manager', description: 'Leads hiring processes, recruitment systems, onboarding coordination, and talent acquisition.' },
      { title: 'Training & Engagement', description: 'Develops training programs, employee engagement initiatives, onboarding support, and team development programs.' },
    ],
  },
  {
    department: 'Virtual Staff',
    roles: [
      { title: 'Virtual Staff Team', description: 'Provides remote operational, administrative, marketing, accounting, and support services across departments to improve scalability and efficiency.' },
    ],
  },
]

function DeptRolesModal({ onClose }: { onClose: () => void }) {
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
          width: 620,
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
              Department Roles and Responsibilities
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              CASK Construction — Role Description Documentation
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {DEPT_ROLES_DATA.map((section, si) => (
            <div key={section.department}>
              {/* Department heading */}
              <div
                className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-3 pb-1.5"
                style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
              >
                {section.department}
              </div>
              {/* Roles */}
              <div className="flex flex-col gap-3">
                {section.roles.map((role) => (
                  <div key={role.title} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                        {role.title}
                      </span>
                      {role.person && (
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
                          {role.person}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                      {role.description}
                    </p>
                  </div>
                ))}
              </div>
              {si < DEPT_ROLES_DATA.length - 1 && <div className="mt-2" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const TEAM_ALIGNMENT_RESPONSES = [
  {
    name: 'Calin',
    paragraphs: [
      "Hitting $20 million in revenue means our business model is proven, our systems are dialed in, and we have a foundation strong enough to not only recognize your individual goals but to start moving people into new roles and responsibilities.",
      "What's just as important is that reaching this level of revenue means we've ironed out the kinks here at home and built a model we can repeat in other markets. That's where the bigger vision comes in—seeing how your own future plans align with CASK's growth, and being part of a company that's able to expand and offer those opportunities.",
      "For me, I'm genuinely excited to support and work with all of you as you go after your big, long-term goals. The $20 million mark really is the first big step in making those ambitions a reality.",
      "After reflecting on all this, I have two main thoughts on how we might move forward. Rather than simply revising the goal for this year, I think it makes sense to break it into two steps: First, starting January 1st, 2025, let's define how long it will take us to hit $20 million in revenue. Second, let's focus on achieving a rolling 12-month period where we maintain that level. This way, we keep our eyes on the $20 million target—which is so important for all our business and career goals—but take the pressure off the exact timing. It's more about getting there together and building something that lasts.",
      "Additionally what else excites me about this new way of phrasing our goal is that we get to look at and dive deeper into what each department looks like in the next year or two as we're trying to achieve to hit this goal how do we streamline and make efficiency easier and better, what work flows need to change and will change, keeping an idea that is focused on what your department should look like — what are your biggest pain points in your work flows in each department and how do we solve them or make things easier so that a $20 million company is easier and more efficient to run is very important. In our meetings that we are constantly looking at how the business operates I'd like to keep these big goals in mind so that we can constructively plan on solve the problems that are in the future by building an easier faster process.",
    ],
  },
  {
    name: 'Kait',
    paragraphs: [
      "This goal motivates me because I see people I care about—friends and family—growing and succeeding in this business, and I want to be part of that journey. There's something really fulfilling about working toward a challenging goal and feeling proud of what we accomplish together. Being part of something that has the potential to positively impact not just our own lives, but our families and our community, is incredibly meaningful to me.",
      "In past roles within large corporations, my job often felt like just a job. I didn't feel connected to something bigger. This is different. This goal represents more than just numbers—it's about growth, collaboration, and building something meaningful together. I'm motivated by the opportunity to learn, to stretch myself, and to be part of a team that's all in on the same mission. And yes, I'm a bit competitive too—I know other companies are hitting goals like this, but what sets us apart is our culture, our drive, and the genuine sense of family we have.",
      "Achieving this goal would mean that I pushed past my comfort zone instead of holding back. It would mean I contributed in a way that helped move both the business and myself forward. I'm growing not just professionally, but personally—learning to be more thoughtful in my responses, stay calm under pressure, be intentional with my time, and lead in new ways. I'm also getting better at navigating difficult conversations, reading people, and communicating more effectively with clients, coworkers, and the people in my life.",
      "Ultimately, reaching this milestone would represent stepping into a career I'm passionate about while continuing to learn and evolve. I'm genuinely excited about being part of building something that doesn't fully exist yet—and helping shape what it becomes.",
    ],
  },
  {
    name: 'Matteo',
    paragraphs: [
      "For me, the $20M goal is meaningful because of what it unlocks, both professionally and personally. From a business standpoint, it represents a level where we're no longer just operating, but truly leveraging structure, people, and systems to scale. In my role as Operations Manager, it challenges me to grow into a position where I'm not just solving problems myself, but building and guiding a team that can operate effectively together toward the same direction.",
      "Personally, a big part of my motivation is the opportunity this creates outside of work. Achieving this level of growth supports my ability to build assets, including continuing to grow RAMA alongside CASK. To me, those aren't separate paths — they are connected, and both depend on building the right foundation here.",
      "At the same time, I'm very aware that growth at this level comes with pressure. If I don't continue to work on myself, that pressure can easily carry over into my personal life and impact my family. So part of this journey for me is learning how to manage that — how to grow professionally while still protecting balance.",
      "That ties directly into the person I'm working to become. I want to be a calmer, more grounded leader — someone who brings clarity, a different perspective, and stability when challenges come up, and who helps the team stay aligned and moving in the same direction. Also, like Chad mentioned, I see this milestone as part of a bigger transformation — not just for the company, but for how we think and operate as a team. That shift is something I want to be an active part of building.",
      "From a career standpoint, hitting $20M would be a strong step in proving that I can operate at a higher level — not just managing tasks, but leading people, developing others, and creating leverage through the team.",
      "For me, it's about growing in both directions — building something meaningful as a company, while also becoming someone capable of leading at that level without losing what matters outside of work.",
    ],
  },
  {
    name: 'Chad',
    paragraphs: [
      "For me, hitting $20M would have a meaningful impact on both my family and personal life, but probably not in the way people typically think. It's less about lifestyle changes, while those are nice and I will likely strive for them it's more about stability and options. I already feel like I have everything I need in life. I have amazing family and friends, live in a place that I love and have resources (financial and otherwise) to experience pretty much everything I want, and this came from a shift in my perspective not from the amount of money in my bank account or the number of KPIs I achieved. I have a natural drive to succeed in every aspect of my life (family, career, sports, go kart racing, top golf, etc) but I have had to learn that I have already achieved all the success I truly need and that the dopamine hit I get from hitting the next success marker shouldn't come at the expense of the people, experiences, and personal time that are currently in front of me.",
      "On a personal career level, I think it pushes me to become someone who can operate at a higher level — more disciplined, better at delegating, and more focused on developing people rather than just solving problems myself. That ties directly into who I want to be for the team and for my family. I want to be someone who creates opportunities, not just for myself, but for others — someone who builds leaders, not just a business.",
      "From a career perspective, $20M feels like a credibility milestone. It proves that we can build a scalable, structured operation, not just a scrappy, founder-led company. That opens the door to the bigger vision we've talked about — replicating this model, expanding geographically, and ultimately building toward that $1B goal. It shifts us from \"figuring it out\" to \"we've built something that works.\"",
      "In terms of balance and boundaries, while I feel I do a good job with this that's something I will likely actively work on forever in my life. I think the biggest shift for me was recognizing that growth at this level can't come from just working more — it has to come from building better systems and stronger people. If I don't make that shift, the business will always compete with personal time instead of supporting it. So for me, maintaining boundaries is less about strict separation and more about building the kind of organization that doesn't rely on me being in everything.",
      "At the end of the day, the goal is to build something that's successful enough to create freedom, but structured enough that it doesn't come at the expense of the things that actually matter.",
    ],
  },
  {
    name: 'Jeff',
    paragraphs: [
      "Personally, hitting the $20M goal is meaningful because it allows me to test and apply practices and frameworks I learned through business school and my experiences in corporate America — but in real-world scenarios. There's a big difference between theory and execution, and being part of scaling a company from $10M to $20M is the kind of environment where those ideas get pressure tested. Achieving that milestone would also strengthen my confidence in creating, and tracking, a proven sales process that can scale and sustain a $20M organization.",
      "Professionally, a goal like this forces me to think differently about how we work with the team and our partners. It pushes me to dig deeper into individual motivations, both internally and externally, to better understand what drives people and where leverage opportunities exist. Unlocking those opportunities is what allows myself and team to grow faster and more efficiently.",
      "2026 will likely come with a level of discomfort as we work through new challenges and unknowns while growing at this pace. Leaning into that discomfort and figuring things out along the way will be very valuable. The experience and lessons that come from building through those unknowns will create long-term stability for CASK Construction, and for my family and future generations.",
    ],
  },
  {
    name: 'Lamont',
    paragraphs: [
      "For me, hitting the $20M mark is meaningful in a lot of ways. About five years ago I made the decision to step away from something that was solid, consistent, and safe because I believed in what we were building here. I poured a lot into this company over those years and seeing us push toward this milestone reinforces that the decision to invest my time and energy here was the right one.",
      "On a personal level, it also brings perspective to everything that has happened over the past few years. While going through one of the most difficult periods in my life during my divorce, I may not have always been as present or personable as I would have liked. The systems and structure we've been building allowed the business to continue moving forward even during that time. In many ways, that was a real test of whether what we were building had strength behind it.",
      "What I've tried to stay focused on is continuing to build layers of systems, processes, and structure that allow the company to scale without everything relying on a few people at the top. For me personally, that means continuing to strengthen the financial visibility and systems that allow leadership to make faster, better decisions as the company grows.",
      "At the same time, those systems have also allowed me to protect what matters outside of work. I've been able to be present for my daughters, spend time with family, and maintain balance while still helping push the company forward.",
      "While people may not always see every detail of what happens behind the scenes, they do see how we show up — how we work, how we treat people, and the consistency we bring to the organization. That example matters not just for my daughters, but for the people around me here at CASK as well.",
      "To me, reaching $20M is really a test of everything we've been building — the systems, the leadership structure, and the culture. It's like tending something over time and watching it grow stronger with the right care and attention. Seeing that growth happen is what makes the journey meaningful.",
    ],
  },
]

function TeamAlignmentModal({ onClose }: { onClose: () => void }) {
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
          width: 600,
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
              Team Alignment – Hitting Our $20M Goal
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Weekly Meetings · Department Alignment
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

        {/* Prompt */}
        <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <p className="text-[12px] font-medium leading-relaxed" style={{ color: 'var(--text2)' }}>
            What motivates you personally about hitting the $20M goal this year? What does achieving that milestone mean to you — professionally or personally?
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {TEAM_ALIGNMENT_RESPONSES.map((person, i) => (
            <div key={person.name}>
              <div
                className="text-[11px] font-bold tracking-[1.4px] uppercase mb-3 pb-1.5"
                style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
              >
                {person.name}
              </div>
              <div className="flex flex-col gap-2.5">
                {person.paragraphs.map((para, j) => (
                  <p key={j} className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                    {para}
                  </p>
                ))}
              </div>
              {i < TEAM_ALIGNMENT_RESPONSES.length - 1 && (
                <div className="mt-6" style={{ borderBottom: '1px solid var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthlyCheckInsModal({ onClose }: { onClose: () => void }) {
  const meetingFlow = [
    { title: 'Big Vision Alignment', subItems: ['Connection to company vision', 'How current work supports direction'] },
    { title: 'Department Wins & Progress', subItems: ['Key wins', 'Progress on goals / PIT items'] },
    { title: 'Strategic Discussion (Work ON the Business)', subItems: ['Challenges / bottlenecks', 'Process / system improvements', 'Adjustments based on performance'] },
    { title: 'Forward Planning & Risks', subItems: ['Upcoming risks / constraints', 'What needs to shift next month/quarter', 'Resource / support needs'] },
    { title: 'Personal & Professional Alignment', subItems: ['Alignment with personal goals', 'Growth / development needs', 'Leadership support needed'] },
    { title: 'Top Priorities', subItems: ['1–3 key focuses before next meeting', 'What matters most'] },
    { title: 'Action Items & Commitments', subItems: ['Key action items', 'Ownership', 'Follow-ups'] },
  ]

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
          width: 560,
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
              Monthly Department Alignment Meeting (1:1)
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Calin + Department Heads · Timing: Monthly
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Prep Material */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Prep Material for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Participants should review prior to the meeting:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Department KPIs / performance',
                'Weekly meeting recaps (wins, blockers, action items)',
                'Quarterly goals progress',
                'Active PIT items',
                'Key challenges / bottlenecks',
                'Personal goals (professional growth)',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links for the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Links for the Meeting
            </div>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'ChatGPT Channel specific to the Leader',
                'Teams Channel for Management Team',
                'KPI Dashboard',
                'PIT Tracker',
                'Weekly Meeting Notes',
                'Company Vision / Strategic Plan',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purpose Statement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Purpose Statement of the Meeting
            </div>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Align department with company big vision',
                'Connect current work to strategic priorities',
                'Identify risks, bottlenecks, and opportunities',
                'Support department leader growth and alignment',
                'Focus on working ON the business',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Meeting Flow */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Meeting Flow
            </div>
            <ul className="flex flex-col gap-3" style={{ marginLeft: 4 }}>
              {meetingFlow.map(section => (
                <li key={section.title}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                    <span className="text-[12.5px] font-semibold leading-relaxed" style={{ color: 'var(--text)' }}>{section.title}</span>
                  </div>
                  <ul className="flex flex-col gap-1" style={{ marginLeft: 14 }}>
                    {section.subItems.map(sub => (
                      <li key={sub} className="flex items-start gap-2">
                        <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 3, height: 3, background: 'var(--border2)', opacity: 0.6 }} />
                        <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>{sub}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          {/* Outcomes After the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Outcomes After the Meeting
            </div>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Alignment with company vision and direction',
                'Clear top priorities for the next month',
                'Identified risks and problem areas',
                'Defined support needed by department head',
                'Strengthened accountability and focus',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

function QuarterlyMeetingsModal({ onClose }: { onClose: () => void }) {
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
          width: 560,
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
              Quarterly Company Meeting Agenda
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Leadership Team (Calin, Chad, Department Heads) · Timing: Before Quarter Starts
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Prep Material */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Prep Material for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Participants should review and submit the following prior to the session:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Department Q[Previous] Recap',
                'Department Wins',
                'Department Challenges',
                'Department Q[Next] Goals',
                'Previous Quarterly Presentation',
                'Blank Quarterly Presentation for this Q',
                'Company Mission & Vision',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links for the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Links for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Include links within the meeting document to the following materials:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Chat GPT channel — Company Planning GPT',
                'Teams channel — Company Planning',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purpose Statement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Purpose Statement of the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Translate company strategy into quarterly execution by:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Reviewing performance from the previous quarter',
                'Aligning on department wins and challenges',
                'Defining goals for the upcoming quarter',
                'Reinforcing company mission, vision, and priorities',
                'Complete presentations for this Quarter',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Meeting Flow */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Meeting Flow
            </div>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Company Direction Alignment (Mission, Vision, Priorities)',
                'Department Recap (Previous Quarter)',
                'Department Wins',
                'Department Challenges',
                'Department Goals (Next Quarter)',
                'Company Focus Areas (PIT, NPS, Culture)',
                'Presentation Alignment (Slides, Messaging, Gaps)',
                'Next Steps & Ownership',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Outcomes After the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Outcomes After the Meeting
            </div>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Alignment on Q[Previous] performance across departments',
                'Defined Q[Next] goals per department',
                'Clear company priorities for the quarter',
                'Completed inputs for Quarterly Company Presentation',
                'Ownership and deadlines confirmed for final deliverables',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </div>
  )
}

function YearlyStrategicAlignmentModal({ onClose }: { onClose: () => void }) {
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
          width: 560,
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
              Company Strategic Alignment Meeting
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Participants: Calin, Chad, Department Heads · Timing: December (Annual Leadership Alignment)
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Prep Material */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Prep Material for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Participants should review the following materials prior to the meeting:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Outcome from the last Executive Meeting with Calin and Chad',
                'Review Company Big Vision (10-Year Vision)',
                "Review Last Year's Strategic Goals",
                'Review Strategic Priorities Defined in the Annual Executive Strategy Planning Session',
                'Review Company Performance Metrics and KPI Dashboard',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              This ensures all department leaders arrive prepared and aligned on the current company direction before the meeting begins.
            </p>
          </div>

          {/* Links for the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Links for the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Include links within the meeting document to the following materials:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Chat GPT channel — Company Planning GPT',
                'Teams channel — Company Planning',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purpose Statement */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Purpose Statement of the Meeting
            </div>
            <p className="text-[12.5px] leading-relaxed mb-2" style={{ color: 'var(--text2)' }}>
              The purpose of the Company Strategic Alignment Meeting is to ensure that department leaders fully understand and align with the company&apos;s strategic direction for the upcoming year.
            </p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
              This meeting translates the executive-level strategy defined by leadership into department-level direction, ensuring each department understands how they contribute to achieving company priorities.
            </p>
          </div>

          {/* Outcomes After the Meeting */}
          <div>
            <div className="text-[10px] font-semibold tracking-[1.2px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Outcomes After the Meeting
            </div>
            <p className="text-[12px] mb-2 leading-relaxed" style={{ color: 'var(--text2)' }}>
              By the end of the meeting, the following outcomes should be achieved:
            </p>
            <ul className="flex flex-col gap-1.5" style={{ marginLeft: 4 }}>
              {[
                'Actual goals due 30 days after the meeting',
                "Department leaders understand the company's strategic priorities",
                'Clear alignment on department roles in executing company initiatives',
                'Identification of key initiatives each department will support',
                'Alignment on cross-department collaboration',
                'Clear expectations for department planning and execution for the upcoming year',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ width: 4, height: 4, background: 'var(--border2)' }} />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

function PlaceholderModal({ title, onClose }: { title: string; onClose: () => void }) {
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
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: 'var(--text)' }}>
              {title}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Department Alignment
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
        <div className="flex-1 overflow-y-auto px-5 py-4" />
      </div>
    </div>
  )
}

function LevelCard({ level }: { level: MeetingLevel }) {
  const f = FREQ[level.freq]
  const hasSubItems = level.subItems && level.subItems.length > 0
  const [activeSubModal, setActiveSubModal] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3.5 px-5 py-[14px]">
        <FreqIcon freq={level.freq} />

        <div className="flex-1 min-w-0">
          <span
            className="text-[14px] font-semibold tracking-[-0.2px]"
            style={{ color: 'var(--text)' }}
          >
            {level.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] tracking-[0.3px]"
            style={{ background: f.bg, color: f.color, border: `1px solid ${f.border}` }}
          >
            {f.label}
          </span>

          <button
            type="button"
            className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
            style={{
              background: f.bg,
              color: f.color,
              border: `1px solid ${f.border}`,
              fontFamily: 'inherit',
              opacity: level.modalKey ? 1 : 0.45,
              cursor: level.modalKey ? 'pointer' : 'default',
            }}
            onClick={() => { if (level.modalKey) setActiveModal(level.modalKey) }}
            onMouseEnter={e => { if (level.modalKey) e.currentTarget.style.opacity = '0.7' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = level.modalKey ? '1' : '0.45' }}
          >
            View Agenda
          </button>

          <span
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-[5px]"
            style={{
              background: '#ede9fe',
              color: '#6d28d9',
              border: '1px solid #c4b5fd',
              fontFamily: 'inherit',
              opacity: 0.45,
              cursor: 'default',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="15" height="10" rx="2"/><path d="m17 9 5-3v12l-5-3"/>
            </svg>
            Join Teams
          </span>
        </div>
      </div>

      {/* Sub-items */}
      {hasSubItems && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-3 flex flex-col gap-2" style={{ marginLeft: 48 }}>
            {level.subItems!.map((sub) => (
              <div key={sub.title}>
                {sub.personItems ? (
                  <DiscExpandable subsub={sub} />
                ) : (
                <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 6, height: 6, background: f.border }}
                    />
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text2)' }}>
                      {sub.title}
                    </span>
                  </div>
                  {sub.modalKey && (
                    <button
                      type="button"
                      className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveSubModal(sub.modalKey!)}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      View File
                    </button>
                  )}
                </div>
                {sub.subItems && sub.subItems.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1.5" style={{ marginLeft: 22 }}>
                    {sub.subItems.map((subsub) =>
                      subsub.personItems ? (
                        <DiscExpandable key={subsub.title} subsub={subsub} />
                      ) : (
                        <div key={subsub.title} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="shrink-0 rounded-full"
                              style={{ width: 4, height: 4, background: 'var(--border2)' }}
                            />
                            <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
                              {subsub.title}
                            </span>
                          </div>
                          {subsub.modalKey && (
                            <button
                              type="button"
                              className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px] transition-opacity"
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                              }}
                              onClick={() => setActiveSubModal(subsub.modalKey!)}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                            >
                              View File
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubModal === 'pit-goals' && (
        <PitModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'daily-calin-kai' && (
        <DailyCalinKaiModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'data-planning-joseph' && (
        <DataPlanningJosephModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'team-alignment' && (
        <TeamAlignmentModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeSubModal === 'dept-roles' && (
        <DeptRolesModal onClose={() => setActiveSubModal(null)} />
      )}
      {activeModal === 'annual-strategy' && (
        <AnnualStrategyModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'yearly-strategic-alignment' && (
        <YearlyStrategicAlignmentModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'quarterly-meetings' && (
        <QuarterlyMeetingsModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'monthly-check-ins' && (
        <MonthlyCheckInsModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Floating President AI button + chat drawer ───────────────────────

function FloatingPresidentAI() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PanelMsg[]>([{ role: 'assistant', content: AI_GREETING }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [btnHover, setBtnHover] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userEmailRef = useRef('')

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
        .eq('page_context', '/president/overview')
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
      .insert({ user_email: userEmailRef.current, page_context: '/president/overview', role, content })
      .then(({ error }) => { if (error) console.error('[chat history] save error:', error.message) })
  }

  async function clearHistory() {
    if (!userEmailRef.current) return
    await createClient()
      .from('chat_history')
      .delete()
      .eq('user_email', userEmailRef.current)
      .eq('page_context', '/president/overview')
    setMessages([{ role: 'assistant', content: AI_GREETING }])
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

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
          pageContext: '/president/overview',
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
        @keyframes presidentSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Floating button — always visible on President's Meetings */}
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
        President AI
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
            animation: 'presidentSlideUp 220ms ease',
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
                President AI
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
                  {m.role === 'user' ? 'You' : 'President AI'}
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
                  President AI
                </div>
                <div style={{ fontSize: 12.5, color: AI_D.text3, fontStyle: 'italic' }}>Analyzing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts (only at start) */}
          {messages.length <= 1 && !thinking && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
              {QUICK_PROMPTS.map(q => (
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
                placeholder="Ask about meeting agendas, workflows..."
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

export default function PresidentOverviewPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TopBar title="President's Meetings" subtitle="President Workflow" />
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {LEVELS.map((level, i) => (
            <div key={level.title}>
              <LevelCard level={level} />
              {i < LEVELS.length - 1 && <DownArrow />}
            </div>
          ))}
        </div>
      </div>

      {/* Floating President AI button + chat drawer — bottom-right, this page only */}
      <FloatingPresidentAI />
    </div>
  )
}
