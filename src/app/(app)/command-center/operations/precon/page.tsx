'use client'
// src/app/(app)/command-center/operations/precon/page.tsx
// Preconstruction Pipeline — a direct port of the approved standalone mockup
// (cask-precon-pipeline (4).html). Intentionally does NOT use the Hub design
// system: it replicates the mockup's own self-contained design (its own fonts,
// its own colour variables, its own dark theme) so it looks identical to what
// was approved.
//
// Scoping note: every rule in PRECON_CSS below is prefixed with `.precon-root`
// so nothing (including the CSS variable names, which collide with the Hub's
// --bg/--line/etc.) leaks out of this page's subtree. The mockup toggled
// `data-theme` on <html>; here it lives on the `.precon-root` div instead so the
// Hub's own theme (a `.dark` class on <html>) is never touched.
//
// The mockup's own left sidebar is NOT ported — the Hub's Sidebar already
// occupies that column via src/app/(app)/layout.tsx. Everything else (topbar,
// metrics, stage rail, toolbar, all four views, slide-out detail panel) is a
// verbatim port.
//
// Access: role === 'ai_specialist' ONLY. Role is read from the `users` table with
// the same pattern used by src/app/(app)/sessions/[id]/page.tsx.

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────

type StageId = 'sales' | 'design' | 'permit' | 'bid' | 'contract'
type JStatus = 'done' | 'active'

interface JStep {
  s: StageId
  st: JStatus
  m: string
}

interface Project {
  _id: string
  c: string
  a: string
  t: string
  pm: string
  stage: StageId
  days: number
  retained: boolean
  pr?: string
  arch?: string
  pass?: string
  sub?: string
  dwg?: number
  perm?: string
  hold?: 'hold' | 'pause'
  note?: string
  archived?: boolean
  j: JStep[]
}

// ── Constants (verbatim from the mockup) ─────────────────────────────

const PMC: Record<string, string> = {
  Kait: '#4A6FA5',
  Chad: '#3F8B79',
  Matteo: '#BE8A3D',
  Tim: '#7A5EA8',
  Scott: '#BF4F3E',
  Cooper: '#4E8A63',
  Calin: '#6E7480',
}

function dc(d: number): 'ok' | 'warn' | 'bad' {
  return d >= 200 ? 'bad' : d >= 120 ? 'warn' : 'ok'
}

const STG: { id: StageId; nm: string; c: string; mt: string }[] = [
  { id: 'sales', nm: 'Sales', c: 'var(--s-sales)', mt: 'avg 11d' },
  { id: 'design', nm: 'Design', c: 'var(--s-design)', mt: 'avg 87d' },
  { id: 'permit', nm: 'Permitting', c: 'var(--s-permit)', mt: 'avg 138d' },
  { id: 'bid', nm: 'Bid', c: 'var(--s-bid)', mt: 'avg 72d' },
  { id: 'contract', nm: 'Contract', c: 'var(--s-contract)', mt: 'this month' },
]

const SC: Record<StageId, string> = {
  sales: 'var(--s-sales)',
  design: 'var(--s-design)',
  permit: 'var(--s-permit)',
  bid: 'var(--s-bid)',
  contract: 'var(--s-contract)',
}

const SN: Record<StageId, string> = {
  sales: 'Sales',
  design: 'Design',
  permit: 'Permitting',
  bid: 'Bid',
  contract: 'Contract',
}

// ---- ACTIVE (refreshed to 7/24 tracker) ----
const P_RAW: Omit<Project, '_id'>[] = [
  {
    c: 'Scott (Precon)', a: 'Sales passoff in progress', t: 'ADU', pm: 'Scott', stage: 'sales', days: 18, retained: true,
    j: [{ s: 'sales', st: 'active', m: 'Precon signed 6/30 · 18 days' }],
  },
  {
    c: 'New intake', a: 'Precon signed this week', t: 'ADU', pm: 'Kait', stage: 'sales', days: 3, retained: true,
    j: [{ s: 'sales', st: 'active', m: 'Precon signed 7/15 · 3 days' }],
  },

  {
    c: 'Daman & Nina Toth', a: '767 17th Ave N', t: 'Addition', pm: 'Tim', stage: 'design', days: 249, retained: true, pr: 'Second', arch: 'Anna', pass: '11/17/2025',
    note: 'July 28th going to permit. Have Universal with a clear scope and schedule date.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 11/17/2025' }, { s: 'design', st: 'active', m: 'In design · 249 days' }],
  },
  {
    c: 'Bud Williams', a: '273 38th Ave NE', t: 'ADU', pm: 'Chad', stage: 'design', days: 140, retained: true, pr: 'Second', arch: 'Ellen', dwg: 95, pass: '3/6/2026',
    note: '95% set — back by 7/2.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 3/6/2026' }, { s: 'design', st: 'active', m: 'In design · 140 days · 95% DWG' }],
  },
  {
    c: "Shannon O'Malley", a: '480 23rd Ave N', t: 'ADU', pm: 'Kait', stage: 'design', days: 109, retained: true, pr: 'Third', arch: 'Ellen', pass: '4/6/2026',
    note: '7/9 Thursday meeting — redesign.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 4/6/2026' }, { s: 'design', st: 'active', m: 'In design · 109 days' }],
  },
  {
    c: 'Charlie Evans (Remodel)', a: '1909 Beach Drive SE', t: 'Remodel', pm: 'Cooper', stage: 'design', days: 108, retained: true, pr: 'Last', arch: 'Drew', hold: 'hold', pass: '4/7/2026',
    note: 'On hold.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 4/7/2026' }, { s: 'design', st: 'active', m: 'In design · 108 days · on hold' }],
  },
  {
    c: 'Lisa Sweet', a: '630 Kirkwood Terrace N', t: 'ADU', pm: 'Chad', stage: 'design', days: 81, retained: true, arch: 'Ellen', dwg: 95, pass: '5/4/2026',
    note: '95% Sweet — back by 6/30.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 5/4/2026' }, { s: 'design', st: 'active', m: 'In design · 81 days · 95% DWG' }],
  },
  {
    c: 'Andrew Butterfield', a: '13122 4th St E', t: 'New home build', pm: 'Cooper', stage: 'design', days: 66, retained: true, arch: 'Drew', pass: '5/19/2026',
    note: '7/27 getting engineer back.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 5/19/2026' }, { s: 'design', st: 'active', m: 'In design · 66 days' }],
  },
  {
    c: 'Cary & Chad Lopez', a: '4818 Alcazar Way S', t: 'ADU', pm: 'Scott', stage: 'design', days: 53, retained: true, arch: 'Drew', pass: '6/1/2026',
    note: 'Review red mark Fri 17th, 3:30pm selection meeting with 3D.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 6/1/2026' }, { s: 'design', st: 'active', m: 'In design · 53 days' }],
  },
  {
    c: 'Kelly Hall', a: '4734 3rd Ave N', t: 'ADU', pm: 'Scott', stage: 'design', days: 45, retained: true, arch: 'Drew', pass: '6/9/2026',
    note: '7/28 goal to submit for permit.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 6/9/2026' }, { s: 'design', st: 'active', m: 'In design · 45 days' }],
  },
  {
    c: 'Brendon Hart', a: '1429 15th St N', t: 'ALS', pm: 'Scott', stage: 'design', days: 45, retained: true, arch: 'Drew', pass: '6/9/2026',
    note: "7/17 permit set if today's meeting goes well. August go to Kelly permit.",
    j: [{ s: 'sales', st: 'done', m: 'Passed off 6/9/2026' }, { s: 'design', st: 'active', m: 'In design · 45 days' }],
  },
  {
    c: 'Lisa Anderson', a: '419 Bayview Dr NE', t: 'ADU', pm: 'Matteo', stage: 'design', days: 31, retained: true, arch: 'Drew', dwg: 95, pass: '6/23/2026',
    note: '7/16 updated plan to Chad. 7/23 meeting, 95%.',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 6/23/2026' }, { s: 'design', st: 'active', m: 'In design · 31 days · 95% DWG' }],
  },
  {
    c: 'Kalim Rahim', a: '136 19th Ave NE', t: 'ALS', pm: 'Kait', stage: 'design', days: 10, retained: true, pass: '7/14/2026',
    j: [{ s: 'sales', st: 'done', m: 'Passed off 7/14/2026' }, { s: 'design', st: 'active', m: 'In design · 10 days' }],
  },

  {
    c: 'Lisa Schweitzer', a: '3049 7th Ave N', t: 'ADU', pm: 'Kait', stage: 'permit', days: 155, retained: true, perm: '26-05001527',
    note: 'Zoning and building approved 07/07.',
    j: [{ s: 'design', st: 'done', m: 'Completed' }, { s: 'permit', st: 'active', m: 'Submitted 2/13 · 155 days' }],
  },
  {
    c: 'Michaela Crook', a: '3225 11th St N', t: 'New home build', pm: 'Kait', stage: 'permit', days: 155, retained: true, perm: '26-01000574',
    note: 'Building approved 03/05 · Zoning RFC 03/05.',
    j: [{ s: 'design', st: 'done', m: 'Completed 2/13/2026' }, { s: 'permit', st: 'active', m: 'Submitted 2/13 · 155 days' }],
  },
  {
    c: 'Norma Wood', a: '1817 Bayou Grande Blvd NE', t: 'ADU', pm: 'Kait', stage: 'permit', days: 212, retained: true, perm: '26-04000895',
    note: 'FEMA approved 07/16.',
    j: [{ s: 'design', st: 'done', m: 'Completed 4/14/2026' }, { s: 'permit', st: 'active', m: 'Submitted 12/18 · 212 days' }],
  },
  {
    c: 'Rob Hillery', a: '1118 Highland St S', t: 'ADU', pm: 'Kait', stage: 'permit', days: 127, retained: true, perm: '26-6001068',
    note: 'Deck demo — zoning approved 06/15.',
    j: [{ s: 'design', st: 'done', m: 'Completed' }, { s: 'permit', st: 'active', m: 'In permitting · 127 days' }],
  },
  {
    c: 'Lolli / Mekr', a: '735 17th St N', t: 'New build (non-ADU)', pm: 'Calin', stage: 'permit', days: 751, retained: true, perm: '24-6001945',
    note: 'Longest-running item in the pipeline. Also paused in bid.',
    j: [{ s: 'design', st: 'done', m: 'Completed' }, { s: 'permit', st: 'active', m: 'Submitted 6/27/2024 · 751 days' }],
  },

  {
    c: 'Lolli / Mekr', a: '2824 5th Ave N', t: 'New build (non-ADU)', pm: 'Chad', stage: 'bid', days: 242, retained: true, hold: 'pause',
    note: 'Paused.',
    j: [{ s: 'design', st: 'done', m: 'Completed' }, { s: 'permit', st: 'done', m: 'Routed 11/18/2025' }, { s: 'bid', st: 'active', m: 'In bid · 242 days · paused' }],
  },
  {
    c: 'Art Brake', a: '3055 6th Ave N', t: 'ADU', pm: 'Kait', stage: 'bid', days: 127, retained: true, perm: '23-5000304',
    note: 'In permitting and bid concurrently.',
    j: [{ s: 'design', st: 'done', m: 'Completed 3/13/2026' }, { s: 'permit', st: 'active', m: '127 days' }, { s: 'bid', st: 'active', m: 'In bid · 127 days' }],
  },
  {
    c: 'Charlie Evans', a: '1909 Beach Drive SE', t: 'ADU', pm: 'Matteo', stage: 'bid', days: 92, retained: true, perm: '26-04001314',
    note: 'Plans recorded, routed to city 05/20.',
    j: [{ s: 'design', st: 'done', m: 'Completed 3/24/2026' }, { s: 'permit', st: 'done', m: 'Routed 4/17/2026' }, { s: 'bid', st: 'active', m: 'In bid · 92 days' }],
  },
  {
    c: 'Samuel Maiden', a: '2120 5th Ave N', t: 'ADU', pm: 'Chad', stage: 'bid', days: 60, retained: true, perm: '26-05001332',
    note: 'Bldg and zoning approved 07/07.',
    j: [{ s: 'design', st: 'done', m: 'Completed 5/19/2026' }, { s: 'permit', st: 'active', m: '60 days' }, { s: 'bid', st: 'active', m: 'In bid · 60 days' }],
  },
  {
    c: 'Jordan Henley (Remodel)', a: '2555 2nd Ave N', t: 'Remodel', pm: 'Matteo', stage: 'bid', days: 47, retained: true, perm: '26-05001547',
    j: [{ s: 'design', st: 'done', m: 'Completed 6/1/2026' }, { s: 'permit', st: 'active', m: '30 days' }, { s: 'bid', st: 'active', m: 'In bid · 47 days' }],
  },
  {
    c: 'Brianna Miniter (Historic)', a: '3219 6th Ave N', t: 'ADU', pm: 'Kait', stage: 'bid', days: 32, retained: true,
    note: 'Friday submit historic app.',
    j: [{ s: 'design', st: 'done', m: 'Completed 6/16/2026' }, { s: 'permit', st: 'active', m: '32 days' }, { s: 'bid', st: 'active', m: 'In bid · 32 days' }],
  },
  {
    c: 'Dave Greenberg', a: '6946 Bougainvilla Ave S', t: 'ADU', pm: 'Chad', stage: 'bid', days: 30, retained: true, perm: '26-6001224',
    note: 'On LAN — submitting by June 16th.',
    j: [{ s: 'design', st: 'done', m: 'Completed 6/18/2026' }, { s: 'permit', st: 'active', m: '30 days' }, { s: 'bid', st: 'active', m: 'In bid · 30 days' }],
  },
  {
    c: 'Joy Collura (ADU)', a: '165 21st Ave NE', t: 'ADU', pm: 'Kait', stage: 'bid', days: 18, retained: true, perm: '26-07000116',
    note: 'June 12th going to permit.',
    j: [{ s: 'design', st: 'done', m: 'Completed 6/30/2026' }, { s: 'permit', st: 'active', m: '18 days' }, { s: 'bid', st: 'active', m: 'In bid · 18 days' }],
  },
  {
    c: 'Tim and Lisa Johnson', a: '1900 20th Ave N', t: 'ADU', pm: 'Chad', stage: 'bid', days: 4, retained: true, perm: '26-07000862',
    note: 'Submitted to permit 7.10.',
    j: [{ s: 'design', st: 'done', m: 'Completed 7/14/2026' }, { s: 'permit', st: 'active', m: '4 days' }, { s: 'bid', st: 'active', m: 'In bid · 4 days' }],
  },

  {
    c: 'Terry Skinner', a: '346 16th Ave NE', t: 'ADU', pm: 'Matteo', stage: 'contract', days: 0, retained: true,
    j: [{ s: 'design', st: 'done', m: 'Completed 3/31/2026' }, { s: 'permit', st: 'done', m: 'Routed 5/19/2026' }, { s: 'bid', st: 'done', m: '56 days' }, { s: 'contract', st: 'active', m: 'Contract signed 5/26/2026' }],
  },
  {
    c: 'Christina Valiquette (Remodel)', a: '165 21st Ave NE', t: 'Remodel', pm: 'Kait', stage: 'contract', days: 0, retained: true,
    j: [{ s: 'design', st: 'done', m: 'Completed 6/18/2026' }, { s: 'permit', st: 'done', m: 'Routed 6/18/2026' }, { s: 'bid', st: 'done', m: '6 days' }, { s: 'contract', st: 'active', m: 'Contract signed 6/24/2026' }],
  },
  {
    c: 'Jordan Henley', a: '2555 2nd Ave N', t: 'ADU', pm: 'Matteo', stage: 'contract', days: 0, retained: true,
    j: [{ s: 'design', st: 'done', m: 'Completed 2/26/2026' }, { s: 'permit', st: 'done', m: 'Routed 3/31/2026' }, { s: 'bid', st: 'done', m: '4 days' }, { s: 'contract', st: 'active', m: 'Contract signed 3/2/2026' }],
  },
]

// ---- COMPLETED / ARCHIVE (Design tab — the ~110-row section, recent shown) ----
const COMP_RAW: Omit<Project, '_id' | 'stage' | 'archived' | 'j'>[] = [
  { c: 'Michaela Crook', a: '3225 11th St N', t: 'New home build', pm: 'Kait', pass: '1/29/2026', sub: '2/13/2026', days: 15, retained: true, arch: 'Kevin' },
  { c: 'Casey Sapp', a: '555 80th Ave N', t: 'Addition', pm: 'Tim', pass: '12/4/2025', sub: '2/13/2026', days: 71, retained: true, pr: 'Second' },
  { c: 'Lisa Schweitzer', a: '3049 7th Ave N', t: 'ADU', pm: 'Kait', pass: '10/30/2025', sub: '2/13/2026', days: 106, retained: true, pr: 'First' },
  { c: 'Jordan Henley', a: '2555 2nd Ave N', t: 'ADU', pm: 'Matteo', pass: '1/29/2026', sub: '2/26/2026', days: 28, retained: true, pr: 'First' },
  { c: 'Art Brake', a: '3055 6th Ave N', t: 'ADU', pm: 'Kait', pass: '2/9/2026', sub: '3/13/2026', days: 32, retained: true, arch: 'Kevin' },
  { c: 'Addison Killebrew', a: '719 7th St N', t: 'ADU', pm: 'Kait', pass: '10/16/2025', sub: '3/24/2026', days: 159, retained: false, pr: 'Second', arch: 'Kevin' },
  { c: 'Terry Skinner', a: '346 16th Ave NE', t: 'ADU', pm: 'Matteo', pass: '2/27/2026', sub: '3/31/2026', days: 32, retained: true, pr: 'First', arch: 'Drew' },
  { c: 'Norma Wood', a: '1817 Bayou Grande Blvd NE', t: 'ADU', pm: 'Kait', pass: '12/18/2025', sub: '4/14/2026', days: 117, retained: true, pr: 'First', arch: 'Kevin' },
  { c: 'Ray & Sara Wolski', a: '415 18th Ave NE', t: 'Remodel', pm: 'Chad', pass: '12/11/2025', sub: '4/15/2026', days: 125, retained: true, pr: 'Second', arch: 'Anna' },
  { c: 'Charlie Evans', a: '1909 Beach Drive SE', t: 'ADU', pm: 'Matteo', pass: '3/24/2026', sub: '4/17/2026', days: 24, retained: true, pr: 'First', arch: 'Drew' },
  { c: 'Samuel Maiden', a: '2120 5th Ave N', t: 'ADU', pm: 'Chad', pass: '5/4/2026', sub: '5/19/2026', days: 15, retained: true, arch: 'Kevin' },
  { c: 'Jordan Henley (Remodel)', a: '2555 2nd Ave N', t: 'Remodel', pm: 'Matteo', pass: '2/25/2026', sub: '6/1/2026', days: 96, retained: true, pr: 'Third', arch: 'Anna' },
  { c: 'Brianna Miniter (Historic)', a: '3219 6th Ave N', t: 'ADU', pm: 'Kait', pass: '5/19/2026', sub: '6/16/2026', days: 28, retained: true, arch: 'Drew', note: 'Friday submit historic app.' },
  { c: 'Christina Valiquette (Remodel)', a: '165 21st Ave NE', t: 'Remodel', pm: 'Kait', pass: '4/21/2026', sub: '6/18/2026', days: 58, retained: true, pr: 'Third', arch: 'Anna', note: 'June 12th going to permit.' },
  { c: 'Dave Greenberg', a: '6946 Bougainvilla Ave S', t: 'ADU', pm: 'Chad', pass: '5/19/2026', sub: '6/18/2026', days: 30, retained: true, arch: 'Kevin', note: 'On LAN — submitting by June 16th.' },
  { c: 'Tim Johnson (Remodel)', a: '1900 20th Ave N', t: 'Remodel', pm: 'Chad', pass: '5/5/2026', sub: '6/18/2026', days: 44, retained: false, arch: 'Drew', note: 'Budget discussion on 6.9.' },
  { c: 'Joy Collura (ADU)', a: '165 21st Ave NE', t: 'ADU', pm: 'Kait', pass: '3/31/2026', sub: '6/30/2026', days: 91, retained: true, pr: 'Third', arch: 'Anna', note: 'June 12th going to permit.' },
  { c: 'Tim and Lisa Johnson', a: '1900 20th Ave N', t: 'ADU', pm: 'Chad', pass: '4/21/2026', sub: '7/14/2026', days: 84, retained: true, pr: 'Third', arch: 'Drew', note: 'Submitted to permit 7.10.' },
]

// P.forEach((p,i)=>p._id="a"+i); COMP.forEach((p,i)=>p._id="c"+i);
const P: Project[] = P_RAW.map((p, i) => ({ ...p, _id: 'a' + i }))

// COMP.forEach(p=>{p.stage="design";p.archived=true; p.j=[…]})
const COMP: Project[] = COMP_RAW.map((p, i) => ({
  ...p,
  _id: 'c' + i,
  stage: 'design' as StageId,
  archived: true,
  j: [
    { s: 'sales' as StageId, st: 'done' as JStatus, m: 'Passed off ' + (p.pass || '—') },
    { s: 'design' as StageId, st: 'done' as JStatus, m: 'Completed ' + p.sub + ' · ' + p.days + ' days' },
  ],
}))

const BYID: Record<string, Project> = {}
;[...P, ...COMP].forEach((p) => {
  BYID[p._id] = p
})

const JOURNEY_ORDER: StageId[] = ['sales', 'design', 'permit', 'bid', 'contract']

// ── Scoped stylesheet ────────────────────────────────────────────────
// Every selector is prefixed with `.precon-root`. Values are the mockup's,
// unchanged — including the dark theme hexes.

const PRECON_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;450;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");

.precon-root{
  --bg:#FFFFFF; --sunken:#F7F8F9; --rail:#FBFBFC;
  --ink:#191C24; --text-2:#565C68; --text-3:#8B909B; --text-4:#AEB2BB;
  --line:#ECEDF0; --line-soft:#F2F3F5; --line-strong:#DFE1E6;
  --s-sales:#7B8593;   --bg-sales:#F1F2F4;
  --s-design:#4A6FA5;  --bg-design:#EBF0F7;
  --s-permit:#3F8B79;  --bg-permit:#E7F2EF;
  --s-bid:#BE8A3D;     --bg-bid:#F8F1E3;
  --s-contract:#4E8A63;--bg-contract:#E9F2EC;
  --alert:#BF4F3E;     --bg-alert:#FBEDEA;
  --hold:#987839;      --edge-ok:#D3E6DA;
  --sh-1:0 1px 2px rgba(20,24,32,.05);
  --sh-2:0 4px 14px rgba(20,24,32,.06),0 1px 2px rgba(20,24,32,.04);
  --sh-pop:0 16px 40px rgba(20,24,32,.12),0 2px 6px rgba(20,24,32,.05);
  --r-sm:7px; --r-md:10px; --r-lg:13px; --r-xl:16px;
  --fd:"Space Grotesk",sans-serif; --fb:"Inter",sans-serif; --fm:"IBM Plex Mono",monospace;
  --ease:cubic-bezier(.4,0,.2,1);
}
.precon-root *{box-sizing:border-box;margin:0;padding:0}
.precon-root{
  flex:1;min-width:0;min-height:0;overflow-y:auto;
  background:var(--bg);color:var(--ink);font-family:var(--fb);font-size:14px;line-height:1.5;
  font-feature-settings:"cv05","ss01";-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.precon-root .num{font-variant-numeric:tabular-nums}
.precon-root .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.precon-root ::selection{background:#DBE3F0}
.precon-root button{font-family:inherit}
.precon-root :focus-visible{outline:2px solid var(--s-design);outline-offset:2px;border-radius:4px}
.precon-root .p-body::-webkit-scrollbar,.precon-root .col-scroll::-webkit-scrollbar{width:8px;height:8px}
.precon-root .p-body::-webkit-scrollbar-thumb,.precon-root .col-scroll::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:8px;border:2px solid var(--bg)}

.precon-root .topbar{display:flex;align-items:center;gap:16px;height:60px;padding:0 30px;border-bottom:1px solid var(--line);
  background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(8px);position:sticky;top:0;z-index:20}
.precon-root .crumb{font-family:var(--fd);font-weight:600;font-size:15px;letter-spacing:-.2px}
.precon-root .search{margin-left:auto;position:relative;width:300px}
.precon-root .search input{width:100%;height:36px;border:1px solid var(--line);border-radius:9px;background:var(--sunken);
  padding:0 62px 0 34px;font-family:var(--fb);font-size:13px;color:var(--ink);transition:border-color .12s,background .12s}
.precon-root .search input:focus{border-color:var(--line-strong);background:#fff;outline:none}
.precon-root .search input::placeholder{color:var(--text-4)}
.precon-root .search .ic{position:absolute;left:11px;top:10px;width:15px;height:15px;stroke:var(--text-4);fill:none;stroke-width:1.8}
.precon-root .search .kbd{position:absolute;right:9px;top:8px;display:flex;gap:3px}
.precon-root .search .kbd span{font-family:var(--fm);font-size:10.5px;color:var(--text-4);background:#fff;border:1px solid var(--line);border-radius:5px;padding:1px 5px;line-height:1.4}
.precon-root .tbtn{width:36px;height:36px;border:1px solid var(--line);background:var(--bg);border-radius:9px;display:grid;place-items:center;
  cursor:pointer;color:var(--text-2);transition:border-color .12s,color .12s}
.precon-root .tbtn:hover{border-color:var(--line-strong);color:var(--ink)}
.precon-root .tbtn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.7}

.precon-root .content{padding:26px 30px 64px;max-width:1500px;width:100%}
.precon-root .head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
.precon-root .head h1{font-family:var(--fd);font-weight:600;font-size:24px;letter-spacing:-.6px}
.precon-root .head .lede{color:var(--text-2);font-size:13.5px;margin-top:4px}
.precon-root .head .sync{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2);
  background:var(--bg-contract);border:1px solid var(--edge-ok);padding:6px 12px;border-radius:20px;white-space:nowrap}
.precon-root .head .sync .d{width:7px;height:7px;border-radius:50%;background:var(--s-contract);box-shadow:0 0 0 3px rgba(78,138,99,.16)}

.precon-root .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:22px}
.precon-root .metric{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:15px 16px;position:relative;overflow:hidden}
.precon-root .metric .lab{font-size:11.5px;color:var(--text-2);font-weight:500}
.precon-root .metric .valrow{display:flex;align-items:flex-end;gap:8px;margin-top:9px}
.precon-root .metric .val{font-family:var(--fd);font-weight:600;font-size:29px;letter-spacing:-1px;line-height:.95}
.precon-root .metric .val u{font-size:14px;font-family:var(--fb);color:var(--text-3);font-weight:400;text-decoration:none;letter-spacing:0}
.precon-root .metric .spark{margin-left:auto;width:60px;height:26px;opacity:.9}
.precon-root .metric .delta{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:500;margin-top:9px;font-variant-numeric:tabular-nums}
.precon-root .metric .delta svg{width:11px;height:11px}
.precon-root .delta.up{color:var(--s-contract)} .precon-root .delta.down{color:var(--alert)} .precon-root .delta.flat{color:var(--text-3)}
.precon-root .metric.attn .val{color:var(--alert)}

.precon-root .flow{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px 20px 16px;margin-bottom:24px}
.precon-root .flow .cap{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.precon-root .flow .cap h2{font-family:var(--fd);font-weight:500;font-size:11.5px;color:var(--text-2);text-transform:uppercase;letter-spacing:1.1px}
.precon-root .flow .cap .tot{font-family:var(--fm);font-size:12px;color:var(--text-3)}
.precon-root .rail{display:flex;gap:4px;height:10px;border-radius:6px;overflow:hidden;margin-bottom:14px}
.precon-root .rail .seg{height:100%;border-radius:3px;transition:filter .15s;cursor:default}
.precon-root .rail .seg:hover{filter:brightness(1.06)}
.precon-root .legend{display:flex;gap:22px;flex-wrap:wrap}
.precon-root .legend .item{display:flex;align-items:center;gap:8px}
.precon-root .legend .sq{width:9px;height:9px;border-radius:3px}
.precon-root .legend .nm{font-family:var(--fd);font-weight:500;font-size:13px}
.precon-root .legend .ct{font-family:var(--fm);font-size:12.5px;color:var(--ink)}
.precon-root .legend .mt{font-size:11px;color:var(--text-3);margin-left:2px}

.precon-root .toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.precon-root .seg{display:inline-flex;background:var(--sunken);border:1px solid var(--line);border-radius:10px;padding:3px}
.precon-root .seg button{border:0;background:transparent;font-size:13px;font-weight:500;color:var(--text-2);padding:7px 14px;
  border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:7px;transition:color .12s}
.precon-root .seg button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7}
.precon-root .seg button.on{background:var(--bg);color:var(--ink);box-shadow:var(--sh-1)}
.precon-root .seg .ct{font-family:var(--fm);font-size:11px;opacity:.7}
.precon-root .filters{margin-left:auto;display:flex;gap:8px;align-items:center}
.precon-root .chip{font-size:12.5px;color:var(--text-2);background:var(--bg);border:1px solid var(--line);padding:7px 12px;border-radius:9px;
  cursor:pointer;display:flex;align-items:center;gap:7px;transition:border-color .12s,color .12s}
.precon-root .chip:hover{border-color:var(--line-strong);color:var(--ink)}
.precon-root .chip.on{border-color:var(--ink);color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.precon-root .chip .av{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:600;font-family:var(--fd);color:#fff}
.precon-root .chip svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.8}

.precon-root .board{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;align-items:start}
.precon-root .col{background:var(--sunken);border:1px solid var(--line);border-radius:var(--r-lg);padding:11px 10px;min-height:180px;
  animation:precon-rise .5s var(--ease) both}
.precon-root .col:nth-child(1){animation-delay:.02s}.precon-root .col:nth-child(2){animation-delay:.06s}.precon-root .col:nth-child(3){animation-delay:.10s}
.precon-root .col:nth-child(4){animation-delay:.14s}.precon-root .col:nth-child(5){animation-delay:.18s}
@keyframes precon-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.precon-root .col-head{display:flex;align-items:center;gap:8px;padding:3px 5px 11px}
.precon-root .col-head .sq{width:8px;height:8px;border-radius:3px}
.precon-root .col-head .nm{font-family:var(--fd);font-weight:600;font-size:12.5px}
.precon-root .col-head .ct{margin-left:auto;font-family:var(--fm);font-size:11.5px;color:var(--text-2);
  background:var(--bg);border:1px solid var(--line);border-radius:20px;padding:1px 9px}

.precon-root .card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 12px 11px;margin-bottom:8px;
  cursor:pointer;position:relative;box-shadow:var(--sh-1);transition:border-color .13s var(--ease),transform .13s var(--ease),box-shadow .13s var(--ease)}
.precon-root .card:hover{border-color:var(--line-strong);transform:translateY(-1.5px);box-shadow:var(--sh-2)}
.precon-root .card:active{transform:translateY(0)}
.precon-root .card .top{display:flex;align-items:flex-start;gap:8px}
.precon-root .card .dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:0 0 7px}
.precon-root .card .cust{font-family:var(--fd);font-weight:600;font-size:13px;letter-spacing:-.2px;line-height:1.28}
.precon-root .card .addr{font-size:11.5px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.precon-root .card .meta{display:flex;align-items:center;gap:8px;margin-top:11px}
.precon-root .ptype{font-size:10.5px;font-weight:500;color:var(--text-2);background:var(--sunken);border:1px solid var(--line);padding:2px 8px;border-radius:6px;white-space:nowrap}
.precon-root .card .pm{margin-left:auto;display:flex;align-items:center}
.precon-root .av-sm{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:600;font-family:var(--fd);color:#fff;box-shadow:0 0 0 2px var(--bg)}
.precon-root .days{font-family:var(--fm);font-size:11px;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}
.precon-root .days.ok{background:var(--sunken);color:var(--text-2);border:1px solid var(--line)}
.precon-root .days.warn{background:var(--bg-bid);color:var(--hold)}
.precon-root .days.bad{background:var(--bg-alert);color:var(--alert)}
.precon-root .tag{position:absolute;top:10px;right:11px;font-size:9px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:20px}
.precon-root .tag.hold{background:var(--bg-bid);color:var(--hold)} .precon-root .tag.pause{background:#EFEEF1;color:#6C6478}
.precon-root .more{text-align:center;font-size:11.5px;color:var(--text-3);padding:7px;cursor:pointer;font-family:var(--fm);border-radius:var(--r-sm)}
.precon-root .more:hover{color:var(--ink);background:var(--bg)}
.precon-root .empty{text-align:center;color:var(--text-4);font-size:12px;padding:16px 8px;font-family:var(--fm)}

.precon-root .tablewrap{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;display:none;box-shadow:var(--sh-1)}
.precon-root table{width:100%;border-collapse:collapse}
.precon-root th{text-align:left;font-size:10.5px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.7px;
  padding:12px 18px;border-bottom:1px solid var(--line);background:var(--sunken)}
.precon-root td{padding:13px 18px;border-bottom:1px solid var(--line-soft);font-size:13px;vertical-align:middle}
.precon-root tr:last-child td{border-bottom:0}
.precon-root tr.trow{cursor:pointer;transition:background .1s}
.precon-root tr.trow:hover td{background:var(--sunken)}
.precon-root .t-cust{font-family:var(--fd);font-weight:600;font-size:13px}
.precon-root .t-addr{font-size:11.5px;color:var(--text-3);margin-top:1px}
.precon-root .spill{font-size:11.5px;font-weight:500;padding:3px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:7px}
.precon-root .spill .sq{width:7px;height:7px;border-radius:2px}
.precon-root .t-pm{display:flex;align-items:center;gap:8px;color:var(--text-2)}
.precon-root .yn{font-size:11.5px;font-weight:500}
.precon-root .yn.y{color:var(--s-contract)} .precon-root .yn.n{color:var(--text-3)}

.precon-root .pmgrid{display:none;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.precon-root .pmcard{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 17px;box-shadow:var(--sh-1)}
.precon-root .pmcard .top{display:flex;align-items:center;gap:11px;margin-bottom:15px}
.precon-root .pmcard .av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-weight:600;font-size:14px;color:#fff}
.precon-root .pmcard .nm{font-family:var(--fd);font-weight:600;font-size:15px}
.precon-root .pmcard .ld{font-size:11.5px;color:var(--text-3);font-family:var(--fm)}
.precon-root .pmbar{display:flex;height:8px;border-radius:5px;overflow:hidden;margin:0 0 15px;background:var(--line-soft);gap:2px}
.precon-root .pmbar i{height:100%;border-radius:2px}
.precon-root .pmstat{display:flex;align-items:center;font-size:12.5px;color:var(--text-2);padding:4px 0}
.precon-root .pmstat .sq{width:8px;height:8px;border-radius:2px;margin-right:10px}
.precon-root .pmstat b{margin-left:auto;font-family:var(--fm);color:var(--ink);font-weight:500}

.precon-root .scrim{position:fixed;inset:0;background:rgba(20,24,32,.34);opacity:0;pointer-events:none;transition:opacity .22s;z-index:40;backdrop-filter:blur(1px)}
.precon-root .scrim.on{opacity:1;pointer-events:auto}
.precon-root .panel{position:fixed;top:0;right:0;bottom:0;width:452px;max-width:93vw;background:var(--bg);z-index:50;
  transform:translateX(101%);transition:transform .3s var(--ease);box-shadow:var(--sh-pop);display:flex;flex-direction:column}
.precon-root .panel.on{transform:none}
.precon-root .p-head{padding:22px 24px 18px;border-bottom:1px solid var(--line);position:relative}
.precon-root .p-head .x{position:absolute;top:18px;right:18px;width:32px;height:32px;border:1px solid var(--line);background:var(--bg);
  border-radius:8px;cursor:pointer;display:grid;place-items:center;color:var(--text-2);transition:border-color .12s,color .12s}
.precon-root .p-head .x:hover{border-color:var(--ink);color:var(--ink)}
.precon-root .p-head .eyebrow{font-family:var(--fm);font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px}
.precon-root .p-head h3{font-family:var(--fd);font-weight:600;font-size:21px;letter-spacing:-.5px;margin-top:7px;padding-right:38px;line-height:1.2}
.precon-root .p-head .sub{color:var(--text-2);font-size:13px;margin-top:4px}
.precon-root .p-head .tags{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.precon-root .p-body{padding:22px 24px;overflow-y:auto;flex:1}
.precon-root .seclab{font-family:var(--fd);font-weight:500;font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.9px;margin-bottom:13px}
.precon-root .kv{display:grid;grid-template-columns:1fr 1fr;gap:15px 14px;margin-bottom:22px}
.precon-root .kv .k{font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:.6px}
.precon-root .kv .v{font-size:14px;margin-top:4px;font-weight:500}
.precon-root .kv .v.mono{font-family:var(--fm);font-weight:400;font-size:13px}
.precon-root .note{background:var(--sunken);border:1px solid var(--line);border-left:2.5px solid var(--s-design);border-radius:0 var(--r-md) var(--r-md) 0;
  padding:12px 14px;font-size:13px;color:var(--text-2);margin-bottom:24px;line-height:1.55}
.precon-root .note .nh{font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
.precon-root .jh{font-family:var(--fd);font-weight:500;font-size:11.5px;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
.precon-root .journey{position:relative}
.precon-root .jstep{position:relative;padding:0 0 20px 28px}
.precon-root .jstep::before{content:"";position:absolute;left:6.5px;top:16px;bottom:-4px;width:2px;background:var(--line)}
.precon-root .jstep:last-child::before{display:none}
.precon-root .jdot{position:absolute;left:0;top:2px;width:15px;height:15px;border-radius:50%;border:3px solid var(--bg)}
.precon-root .jstep.done .jdot{background:var(--s-contract)}
.precon-root .jstep.active .jdot{background:var(--s-design);box-shadow:0 0 0 4px var(--bg-design)}
.precon-root .jstep.pending .jdot{background:var(--line-strong)}
.precon-root .jstep .jn{font-family:var(--fd);font-weight:600;font-size:14px}
.precon-root .jstep.pending .jn{color:var(--text-4)}
.precon-root .jstep .jm{font-size:12px;color:var(--text-2);margin-top:2px}

@media(prefers-reduced-motion:reduce){.precon-root *{animation:none!important;transition:none!important}}
@media(max-width:1140px){.precon-root .metrics{grid-template-columns:repeat(3,1fr)}
  .precon-root .board{grid-template-columns:repeat(5,minmax(200px,1fr));overflow-x:auto}}
@media(max-width:680px){.precon-root .metrics{grid-template-columns:repeat(2,1fr)}.precon-root .search{display:none}
  .precon-root .board{grid-template-columns:repeat(5,minmax(180px,1fr))}}

/* ---------- Sheet view (mirrors the Excel tab) ---------- */
.precon-root .sheetwrap{display:none}
.precon-root .sheet-sec{margin-bottom:22px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--sh-1)}
.precon-root .sheet-cap{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.precon-root .sheet-cap .sq{width:9px;height:9px;border-radius:3px;background:var(--s-design)}
.precon-root .sheet-cap h3{font-family:var(--fd);font-weight:600;font-size:12.5px;letter-spacing:.4px;text-transform:uppercase}
.precon-root .sheet-cap .n{margin-left:auto;font-family:var(--fm);font-size:12px;color:var(--text-3)}
.precon-root .sheet-scroll{overflow-x:auto}
.precon-root .sheet-scroll table{min-width:1200px}
.precon-root .sheet-scroll th,.precon-root .sheet-scroll td{white-space:nowrap}
.precon-root .sheet-scroll td.notes{white-space:normal;min-width:210px;max-width:250px;color:var(--text-2);font-size:12px;line-height:1.45}
.precon-root .stwrap{font-size:11px;font-weight:600;padding:3px 9px;border-radius:6px;white-space:nowrap;display:inline-block}
.precon-root .st-go{background:var(--bg-design);color:var(--s-design)}
.precon-root .st-hold{background:var(--bg-bid);color:var(--hold)}
.precon-root .st-done{background:var(--bg-contract);color:var(--s-contract)}

/* ---------- Dark theme ---------- */
.precon-root[data-theme="dark"]{
  --bg:#0E1015; --sunken:#08090C; --rail:#0B0D11;
  --ink:#E9EBEF; --text-2:#9CA1AC; --text-3:#6B7078; --text-4:#4B505A;
  --line:#232830; --line-soft:#191D24; --line-strong:#2F353F;
  --s-sales:#8B94A2;    --bg-sales:#1A1D23;
  --s-design:#6B93D6;   --bg-design:#15202F;
  --s-permit:#4FB89E;   --bg-permit:#0F241F;
  --s-bid:#D8A24E;      --bg-bid:#241D11;
  --s-contract:#62B078; --bg-contract:#122218;
  --alert:#E0705C;      --bg-alert:#241512;
  --hold:#C79A4E;       --edge-ok:#23402E;
  --sh-1:0 1px 2px rgba(0,0,0,.5);
  --sh-2:0 8px 24px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4);
  --sh-pop:0 24px 56px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.5);
}
.precon-root[data-theme="dark"] .metric,.precon-root[data-theme="dark"] .flow,.precon-root[data-theme="dark"] .tablewrap,
.precon-root[data-theme="dark"] .pmcard,.precon-root[data-theme="dark"] .panel{background:#14171D}
.precon-root[data-theme="dark"] .chip,.precon-root[data-theme="dark"] .tbtn{background:#14171D}
.precon-root[data-theme="dark"] .seg button.on{background:#1B1F27}
.precon-root[data-theme="dark"] .col-head .ct{background:#12151B}
.precon-root[data-theme="dark"] .search input:focus{background:#14171D}
.precon-root[data-theme="dark"] .search .kbd span{background:#171B22}
.precon-root[data-theme="dark"] .topbar{background:rgba(14,16,21,.82)}
.precon-root[data-theme="dark"] .card{background:#16191F;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),var(--sh-1)}
.precon-root[data-theme="dark"] .card:hover{background:#1C2028;box-shadow:inset 0 1px 0 rgba(255,255,255,.045),var(--sh-2)}
.precon-root[data-theme="dark"] .note{background:#0E1015}
.precon-root[data-theme="dark"] .sheet-sec{background:#14171D}
.precon-root[data-theme="dark"] ::selection{background:#22344D}
`

// ── Small presentational helpers (ports of av() / dc() pills) ────────

function Av({ pm, cls }: { pm?: string; cls: string }) {
  const c = (pm && PMC[pm]) || '#6E7480'
  return (
    <span className={cls} style={{ background: c }}>
      {(pm || '?')[0]}
    </span>
  )
}

function DaysPill({ days }: { days: number }) {
  return <span className={`days ${dc(days)}`}>{days}d</span>
}

function SignedPill() {
  return (
    <span className="days ok">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" />
      </svg>
      signed
    </span>
  )
}

function Spill({ stage }: { stage: StageId }) {
  return (
    <span className="spill" style={{ background: `var(--bg-${stage})`, color: SC[stage] }}>
      <span className="sq" style={{ background: SC[stage] }} />
      {SN[stage]}
    </span>
  )
}

function Yn({ retained }: { retained: boolean }) {
  return retained ? <span className="yn y">Retained</span> : <span className="yn n">Not retained</span>
}

function PmCell({ pm }: { pm?: string }) {
  return (
    <span className="t-pm">
      <Av pm={pm} cls="av-sm" />
      {pm || '—'}
    </span>
  )
}

const DASH = <span style={{ color: 'var(--text-4)' }}>—</span>

// ── Page ─────────────────────────────────────────────────────────────

export default function PreconPipelinePage() {
  // Access control — role read from the `users` table (same pattern as
  // src/app/(app)/sessions/[id]/page.tsx).
  const [userRole, setUserRole] = useState('')
  const [roleResolved, setRoleResolved] = useState(false)

  // Mockup state: curPM / curView / curScope, plus theme + open panel id.
  const [curPM, setCurPM] = useState<string>('all')
  const [curView, setCurView] = useState<'pipeline' | 'table' | 'pm' | 'sheet'>('pipeline')
  const [curScope, setCurScope] = useState<'active' | 'completed'>('active')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  // `openId` drives the panel's `.on` class; `shownId` holds the content and is
  // never cleared, so the panel keeps its detail while sliding closed — same as
  // the mockup, which only removed the class and left the innerHTML in place.
  const [openId, setOpenId] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: publicUser } = await supabase
        .from('users')
        .select('role')
        .eq('email', user?.email ?? '')
        .maybeSingle()
      setUserRole(publicUser?.role ?? '')
      setRoleResolved(true)
    }
    loadUser()
  }, [])

  const close = useCallback(() => setOpenId(null), [])
  const open = useCallback((id: string) => {
    setShownId(id)
    setOpenId(id)
  }, [])

  // document.addEventListener("keydown", e => { if(e.key==="Escape") close() })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  // ── Gates ──────────────────────────────────────────────────────────
  if (!roleResolved) {
    return (
      <div className="flex-1 overflow-y-auto p-7">
        <div className="rounded-[10px] h-[120px] shimmer mb-3" style={{ border: '1px solid var(--border)' }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
          <div className="rounded-lg h-[140px] shimmer" style={{ border: '1px solid var(--border)' }} />
        </div>
      </div>
    )
  }

  if (userRole !== 'ai_specialist') {
    return (
      <div className="flex-1 overflow-y-auto p-7">
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Not available
        </div>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>
          You don&apos;t have access to the Preconstruction Pipeline.
        </p>
      </div>
    )
  }

  // ── Derived (ports of vis() and the render() display matrix) ───────
  const vis = P.filter((p) => curPM === 'all' || p.pm === curPM)

  const isSheet = curView === 'sheet'
  const scopeActive = curScope === 'active'
  const activeBoard = scopeActive && !isSheet

  // The stage rail + legend are built from the FULL active set, exactly as the
  // mockup's one-shot IIFE did (never re-filtered by PM).
  const railCounts = STG.map((s) => ({ s, n: P.filter((p) => p.stage === s.id).length }))
  const railTotal = P.length

  const panelOpen = openId !== null
  const openProject = shownId ? BYID[shownId] : null

  // ── Board ──────────────────────────────────────────────────────────
  function ProjectCard({ p }: { p: Project }) {
    const isC = p.stage === 'contract'
    return (
      <div
        className="card"
        tabIndex={0}
        onClick={() => open(p._id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') open(p._id)
        }}
      >
        {p.hold === 'hold' ? (
          <span className="tag hold">On hold</span>
        ) : p.hold === 'pause' ? (
          <span className="tag pause">Paused</span>
        ) : null}
        <div className="top">
          <span className="dot" style={{ background: SC[p.stage] }} />
          <div style={{ minWidth: 0 }}>
            <div className="cust">{p.c}</div>
            <div className="addr">{p.a}</div>
          </div>
        </div>
        <div className="meta">
          <span className="ptype">{p.t}</span>
          {isC ? <SignedPill /> : <DaysPill days={p.days} />}
          <span className="pm">
            <Av pm={p.pm} cls="av-sm" />
          </span>
        </div>
      </div>
    )
  }

  const board = (
    <div className="board" style={{ display: activeBoard && curView === 'pipeline' ? 'grid' : 'none' }}>
      {STG.map((s) => {
        const items = vis.filter((p) => p.stage === s.id)
        const cap = 5
        const shown = items.slice(0, cap)
        return (
          // Keyed by PM filter too, so the rise animation replays on filter
          // change — matching the mockup's innerHTML rebuild.
          <div className="col" key={`${s.id}-${curPM}`}>
            <div className="col-head">
              <span className="sq" style={{ background: s.c }} />
              <span className="nm">{s.nm}</span>
              <span className="ct num">{items.length}</span>
            </div>
            {shown.length ? (
              shown.map((p) => <ProjectCard key={p._id} p={p} />)
            ) : (
              <div className="empty">Nothing here</div>
            )}
            {items.length > cap && <div className="more">+{items.length - cap} more</div>}
          </div>
        )
      })}
    </div>
  )

  // ── Table ──────────────────────────────────────────────────────────
  const tableRows = vis
    .slice()
    .sort((a, b) => STG.findIndex((s) => s.id === a.stage) - STG.findIndex((s) => s.id === b.stage))

  const tablewrap = (
    <div className="tablewrap" style={{ display: activeBoard && curView === 'table' ? 'block' : 'none' }}>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Stage</th>
            <th>Type</th>
            <th>PM</th>
            <th>Days in stage</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((p) => (
            <tr className="trow" key={p._id} onClick={() => open(p._id)}>
              <td>
                <div className="t-cust">{p.c}</div>
                <div className="t-addr">{p.a}</div>
              </td>
              <td>
                <Spill stage={p.stage} />
              </td>
              <td style={{ color: 'var(--text-2)' }}>{p.t}</td>
              <td>
                <PmCell pm={p.pm} />
              </td>
              <td>
                {p.stage === 'contract' ? (
                  <span className="num" style={{ fontFamily: 'var(--fm)', color: 'var(--text-4)' }}>
                    —
                  </span>
                ) : (
                  <DaysPill days={p.days} />
                )}
              </td>
              <td>
                {p.hold === 'hold' ? (
                  <span style={{ color: 'var(--hold)' }}>On hold</span>
                ) : p.hold === 'pause' ? (
                  <span style={{ color: '#6C6478' }}>Paused</span>
                ) : p.stage === 'contract' ? (
                  <span style={{ color: 'var(--s-contract)' }}>Signed</span>
                ) : (
                  <span style={{ color: 'var(--text-2)' }}>On track</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ── By PM ──────────────────────────────────────────────────────────
  const pms = Array.from(new Set(P.map((p) => p.pm).filter(Boolean)))

  const pmgrid = (
    <div className="pmgrid" style={{ display: activeBoard && curView === 'pm' ? 'grid' : 'none' }}>
      {pms.map((pm) => {
        const items = P.filter((p) => p.pm === pm)
        const total = items.length
        const bs = STG.map((s) => ({ s, n: items.filter((p) => p.stage === s.id).length })).filter((o) => o.n)
        return (
          <div className="pmcard" key={pm}>
            <div className="top">
              <Av pm={pm} cls="av" />
              <div>
                <div className="nm">{pm}</div>
                <div className="ld">{total} active</div>
              </div>
            </div>
            <div className="pmbar">
              {bs.map((o) => (
                <i key={o.s.id} style={{ width: `${(o.n / total) * 100}%`, background: o.s.c }} />
              ))}
            </div>
            {bs.map((o) => (
              <div className="pmstat" key={o.s.id}>
                <span className="sq" style={{ background: o.s.c }} />
                {o.s.nm}
                <b className="num">{o.n}</b>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )

  // ── Completed ──────────────────────────────────────────────────────
  const compRows = COMP.filter((p) => curPM === 'all' || p.pm === curPM)
    .slice()
    .sort((a, b) => Date.parse(b.sub ?? '') - Date.parse(a.sub ?? ''))

  const compwrap = (
    <div className="tablewrap" style={{ display: !scopeActive && !isSheet ? 'block' : 'none' }}>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Type</th>
            <th>PM</th>
            <th>Architect</th>
            <th>Days in design</th>
            <th>Completed</th>
            <th>Retained</th>
          </tr>
        </thead>
        <tbody>
          {compRows.map((p) => (
            <tr className="trow" key={p._id} onClick={() => open(p._id)}>
              <td>
                <div className="t-cust">{p.c}</div>
                <div className="t-addr">{p.a}</div>
              </td>
              <td style={{ color: 'var(--text-2)' }}>{p.t}</td>
              <td>
                <PmCell pm={p.pm} />
              </td>
              <td style={{ color: 'var(--text-2)' }}>{p.arch || '—'}</td>
              <td>
                <DaysPill days={p.days} />
              </td>
              <td className="num" style={{ fontFamily: 'var(--fm)', color: 'var(--text-2)' }}>
                {p.sub}
              </td>
              <td>
                <Yn retained={p.retained} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ── Sheet ──────────────────────────────────────────────────────────
  function sheetCells(p: Project, completed: boolean): React.ReactNode[] {
    const st = completed ? (
      <span className="stwrap st-done">Completed</span>
    ) : p.hold === 'hold' ? (
      <span className="stwrap st-hold">On Hold</span>
    ) : (
      <span className="stwrap st-go">On-Going</span>
    )
    const cells: React.ReactNode[] = [
      st,
      p.pr ? p.pr + ' Priority' : DASH,
      <PmCell pm={p.pm} key="pm" />,
      <span className="num" style={{ fontFamily: 'var(--fm)' }} key="pass">{p.pass || '—'}</span>,
    ]
    if (completed) {
      cells.push(
        <span className="num" style={{ fontFamily: 'var(--fm)' }} key="sub">{p.sub || '—'}</span>,
      )
    }
    cells.push(<DaysPill days={p.days} key="days" />)
    cells.push(<Yn retained={p.retained} key="ret" />)
    cells.push(<span className="t-cust" key="cust">{p.c}</span>)
    cells.push(<span style={{ color: 'var(--text-2)' }} key="addr">{p.a}</span>)
    cells.push(<span style={{ color: 'var(--text-2)' }} key="type">{p.t}</span>)
    cells.push(p.note || '')
    cells.push(p.dwg ? p.dwg + '%' : DASH)
    cells.push(p.arch || DASH)
    return cells
  }

  function SheetRow({ p, completed }: { p: Project; completed: boolean }) {
    const cells = sheetCells(p, completed)
    const notesIdx = completed ? 10 : 9
    return (
      <tr className="trow" onClick={() => open(p._id)}>
        {cells.map((c, i) => (
          <td key={i} className={i === notesIdx ? 'notes' : undefined}>
            {c}
          </td>
        ))}
      </tr>
    )
  }

  const sheetOg = P.filter((p) => p.stage === 'design' && (curPM === 'all' || p.pm === curPM))
  const sheetCp = COMP.filter((p) => curPM === 'all' || p.pm === curPM)
  const ogH = ['Status', 'Priority', 'PM', 'Sales PassOff', '# Days in Design', 'Retained', 'Customer', 'Address', 'Type', 'Notes', 'DWGs %', 'Architect']
  const cpH = ['Status', 'Priority', 'PM', 'Sales PassOff', 'Permit Submitted', '# Days', 'Retained', 'Customer', 'Address', 'Type', 'Notes', 'DWGs %', 'Architect']

  const sheetwrap = (
    <div className="sheetwrap" style={{ display: isSheet ? 'block' : 'none' }}>
      <div className="sheet-sec">
        <div className="sheet-cap">
          <span className="sq" />
          <h3>Design — On-Going Projects</h3>
          <span className="n num">{sheetOg.length} rows</span>
        </div>
        <div className="sheet-scroll">
          <table>
            <thead>
              <tr>
                {ogH.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetOg.map((p) => (
                <SheetRow key={p._id} p={p} completed={false} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="sheet-sec">
        <div className="sheet-cap">
          <span className="sq" style={{ background: 'var(--s-contract)' }} />
          <h3>Design — Completed Projects</h3>
          <span className="n num">{sheetCp.length} of ~110 shown</span>
        </div>
        <div className="sheet-scroll">
          <table>
            <thead>
              <tr>
                {cpH.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetCp.map((p) => (
                <SheetRow key={p._id} p={p} completed />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ── Detail panel ───────────────────────────────────────────────────
  let panelKv: [string, React.ReactNode][] = []
  let panelJourney: { sid: StageId; cls: string; m: string }[] = []
  if (openProject) {
    const p = openProject
    const kv: [string, React.ReactNode][] = [['PM', <PmCell pm={p.pm} key="pm" />]]
    if (p.pr) kv.push(['Priority', `${p.pr} priority`])
    kv.push([
      'Days in ' + SN[p.stage].toLowerCase(),
      p.archived ? `${p.days} days` : p.stage === 'contract' ? 'Signed' : `${p.days} days`,
    ])
    if (p.pass) kv.push(['Sales passoff', <span className="mono" key="pass">{p.pass}</span>])
    if (p.sub) kv.push(['Permit submitted', <span className="mono" key="sub">{p.sub}</span>])
    if (p.dwg) kv.push(['Drawings', `${p.dwg}%`])
    if (p.arch) kv.push(['Design architect', p.arch])
    if (p.perm) kv.push(['Permit #', <span className="mono" key="perm">{p.perm}</span>])
    kv.push(['Retained', <Yn retained={p.retained} key="ret" />])
    panelKv = kv

    const jm: Partial<Record<StageId, JStep>> = {}
    ;(p.j || []).forEach((x) => {
      jm[x.s] = x
    })
    panelJourney = JOURNEY_ORDER.map((sid) => {
      const step = jm[sid]
      return { sid, cls: step ? step.st : 'pending', m: step ? step.m : 'Not yet reached' }
    })
  }

  // ── Theme toggle icon ──────────────────────────────────────────────
  const themeIcon =
    theme === 'dark' ? (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4.4" />
        <path d="M12 2v1.6M12 20.4V22M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M2 12h1.6M20.4 12H22M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24">
        <path d="M20 14.4A8 8 0 1 1 9.6 4 6.5 6.5 0 0 0 20 14.4z" />
      </svg>
    )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRECON_CSS }} />
      <div className="precon-root" data-theme={theme}>
        <h2 className="sr-only">CASK Construction preconstruction pipeline</h2>

        <div className="topbar">
          <span className="crumb">Preconstruction</span>
          <div className="search">
            <svg className="ic" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            {/* Visual only for now — no search behaviour in the approved mockup. */}
            <input placeholder="Search projects, customers, addresses…" />
            <span className="kbd">
              <span>⌘</span>
              <span>K</span>
            </span>
          </div>
          <button className="tbtn" title="Toggle theme" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {themeIcon}
          </button>
          {/* Visual only for now. */}
          <button className="tbtn" title="Filter">
            <svg viewBox="0 0 24 24">
              <path d="M3 5h18M6 12h12M10 19h4" />
            </svg>
          </button>
          <button className="tbtn" title="Add project">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="content">
          <div className="head">
            <div>
              <h1>Preconstruction pipeline</h1>
              <div className="lede">Every active project across sales, design, permitting, and bid — one view.</div>
            </div>
            <div className="sync">
              <span className="d" />
              Synced from Excel · Jul 24, 8:04 AM
            </div>
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="lab">Active projects</div>
              <div className="valrow">
                <span className="val num">28</span>
                <svg className="spark" viewBox="0 0 60 26" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--s-design)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points="0,20 12,18 24,19 36,13 48,11 60,7" />
                </svg>
              </div>
              <div className="delta up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M7 14l5-5 5 5" />
                </svg>
                3 new this week
              </div>
            </div>
            <div className="metric">
              <div className="lab">In permitting</div>
              <div className="valrow">
                <span className="val num">12</span>
                <svg className="spark" viewBox="0 0 60 26" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--s-permit)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points="0,14 12,15 24,12 36,14 48,13 60,13" />
                </svg>
              </div>
              <div className="delta flat">avg 138 days in stage</div>
            </div>
            <div className="metric attn">
              <div className="lab">Needs attention</div>
              <div className="valrow">
                <span className="val num">5</span>
                <svg className="spark" viewBox="0 0 60 26" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--alert)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points="0,8 12,10 24,9 36,12 48,13 60,15" />
                </svg>
              </div>
              <div className="delta down">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M17 10l-5 5-5-5" />
                </svg>
                1 cleared
              </div>
            </div>
            <div className="metric">
              <div className="lab">Avg days in stage</div>
              <div className="valrow">
                <span className="val num">
                  99<u> d</u>
                </span>
              </div>
              <div className="delta flat">across active work</div>
            </div>
            <div className="metric">
              <div className="lab">Retained</div>
              <div className="valrow">
                <span className="val num">
                  89<u>%</u>
                </span>
              </div>
              <div className="delta up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M7 14l5-5 5 5" />
                </svg>
                2 pts
              </div>
            </div>
          </div>

          <div className="flow" style={{ opacity: scopeActive || isSheet ? 1 : 0.5 }}>
            <div className="cap">
              <h2>Active by stage</h2>
              <span className="tot num">28 active projects</span>
            </div>
            <div className="rail">
              {railCounts.map((o) => (
                <div
                  className="seg"
                  key={o.s.id}
                  style={{ width: `${(o.n / railTotal) * 100}%`, background: o.s.c }}
                  title={`${o.s.nm}: ${o.n}`}
                />
              ))}
            </div>
            <div className="legend">
              {railCounts.map((o) => (
                <div className="item" key={o.s.id}>
                  <span className="sq" style={{ background: o.s.c }} />
                  <span className="nm">{o.s.nm}</span>
                  <span className="ct num">{o.n}</span>
                  <span className="mt">· {o.s.mt}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <div className="seg" style={{ display: isSheet ? 'none' : 'inline-flex' }}>
              <button className={curScope === 'active' ? 'on' : ''} onClick={() => setCurScope('active')}>
                Active <span className="ct">28</span>
              </button>
              <button className={curScope === 'completed' ? 'on' : ''} onClick={() => setCurScope('completed')}>
                Completed <span className="ct">18</span>
              </button>
            </div>
            <div className="seg" style={{ display: scopeActive || isSheet ? 'inline-flex' : 'none' }}>
              <button className={curView === 'pipeline' ? 'on' : ''} onClick={() => setCurView('pipeline')}>
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="4" height="16" rx="1" />
                  <rect x="10" y="4" width="4" height="10" rx="1" />
                  <rect x="17" y="4" width="4" height="13" rx="1" />
                </svg>
                Pipeline
              </button>
              <button className={curView === 'table' ? 'on' : ''} onClick={() => setCurView('table')}>
                <svg viewBox="0 0 24 24">
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
                Table
              </button>
              <button className={curView === 'pm' ? 'on' : ''} onClick={() => setCurView('pm')}>
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
                </svg>
                By PM
              </button>
              <button className={curView === 'sheet' ? 'on' : ''} onClick={() => setCurView('sheet')}>
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="1.5" />
                  <path d="M3 9h18M3 14h18M9 4v16" />
                </svg>
                Sheet
              </button>
            </div>
            <div className="filters" style={{ visibility: curView !== 'pm' ? 'visible' : 'hidden' }}>
              <span className={`chip${curPM === 'all' ? ' on' : ''}`} onClick={() => setCurPM('all')}>All PMs</span>
              <span className={`chip${curPM === 'Kait' ? ' on' : ''}`} onClick={() => setCurPM('Kait')}>Kait</span>
              <span className={`chip${curPM === 'Chad' ? ' on' : ''}`} onClick={() => setCurPM('Chad')}>Chad</span>
              <span className={`chip${curPM === 'Matteo' ? ' on' : ''}`} onClick={() => setCurPM('Matteo')}>Matteo</span>
              {/* "More" is inert in the approved mockup (no data-pm). */}
              <span className="chip">
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                More
              </span>
            </div>
          </div>

          {board}
          {tablewrap}
          {pmgrid}
          {compwrap}
          {sheetwrap}
        </div>

        <div className={`scrim${panelOpen ? ' on' : ''}`} onClick={close} />
        <div className={`panel${panelOpen ? ' on' : ''}`}>
          {openProject && (
            <>
              <div className="p-head">
                <div className="x" onClick={close}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </div>
                <div className="eyebrow">
                  {openProject.archived ? SN[openProject.stage] + ' · Completed' : SN[openProject.stage]}
                </div>
                <h3>{openProject.c}</h3>
                <div className="sub">{openProject.a}</div>
                <div className="tags">
                  <Spill stage={openProject.stage} />
                  <span className="ptype">{openProject.t}</span>
                  {openProject.retained ? (
                    <span
                      className="ptype"
                      style={{ color: 'var(--s-contract)', borderColor: 'var(--edge-ok)', background: 'var(--bg-contract)' }}
                    >
                      Retained
                    </span>
                  ) : (
                    <span className="ptype">Not retained</span>
                  )}
                </div>
              </div>
              <div className="p-body">
                <div className="seclab">{SN[openProject.stage]} record — all tracker fields</div>
                <div className="kv">
                  {panelKv.map(([k, v], i) => (
                    <div key={i}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ))}
                </div>
                {openProject.note && (
                  <div className="note">
                    <div className="nh">Notes / last contact</div>
                    {openProject.note}
                  </div>
                )}
                <div className="jh">Project journey</div>
                <div className="journey">
                  {panelJourney.map((s) => (
                    <div className={`jstep ${s.cls}`} key={s.sid}>
                      <span className="jdot" />
                      <div className="jn">{SN[s.sid]}</div>
                      <div className="jm">{s.m}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
