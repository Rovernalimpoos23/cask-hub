'use client'

// ── Construction Journey — PREVIEW / DEMO PAGE ───────────────────────────────
//
// A standalone, throwaway-safe preview of the 19-step Construction Journey, built
// so the flow can be demonstrated live before any of it is wired into the real
// client page.
//
// What makes this page safe to leave in the repo:
//   • ZERO Supabase calls — no reads, no writes, no client constructed at all.
//     Every one of the 19 steps is hardcoded in STEPS below.
//   • Nothing here is imported by any existing route. The only shared thing it
//     touches is <TopBar/>, imported read-only and given exactly the props
//     customers/[id] already gives it, so its rendering elsewhere is unaffected.
//     The sidebar and 3-column shell come free from (app)/layout.tsx.
//   • No sidebar nav entry. Reachable only by typing the URL directly.
//   • Every button is inert. Only the tabs, the demo switch and the checkboxes
//     change anything, and all three are local React state — a reload resets them.
//
// Visual language is copied from the real client page's Journey tab
// (customers/[id]/page.tsx) so the preview reads as the Hub rather than a mockup:
// same TopBar, same tab row, same step-row anatomy (number gutter, type colour
// bar, badges, role cards, checkbox treatment).
//
// STRUCTURE (two levels of tabs):
//   Main tabs — Overview | Journey | Communication | Files & Agenda |
//               Construction Journey. The first four are inert placeholders;
//               Construction Journey is locked (padlock, greyed, click is a
//               no-op) until the demo switch marks Pre-Construction complete.
//   Sub-tabs  — inside Construction Journey: Steps (the 19-step list) and
//               Reference Files (three placeholder folders). Styled smaller and
//               as a pill track so the hierarchy against the main row is clear.
//
// NOTE ON REACHABILITY: middleware.ts gates pages for RESTRICTED_ROLES (vp_sales,
// ops_manager, vp_ops, vp_finance, vp_hr, member) against an allowlist, and this
// route is deliberately not on it. Admin roles (president, ea, ai_specialist) can
// open the URL; restricted roles are redirected to /dashboard even if they type it
// exactly. Adding it to the allowlist would mean editing middleware.ts, which is
// out of scope for this task.

import { useState } from 'react'
import { TopBar } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────

type StepType = 'customer' | 'internal' | 'email' | 'window'
type StepStatus = 'done' | 'current' | 'pending'

// Top-level page sections. Mirrors ClientTab in customers/[id]/page.tsx, plus the
// new 'construction' section this preview exists to demonstrate.
type MainTab = 'overview' | 'journey' | 'communication' | 'files' | 'construction'

// Views inside the Construction Journey section.
type CjView = 'steps' | 'files'

interface RoleBlock {
  r: string
  tasks: string[]
  // Indices into `tasks` that start out checked. Seeds local state only.
  done: number[]
}

interface Step {
  n: number
  type: StepType
  title: string
  status: StepStatus
  objective: string
  who: string
  roles: RoleBlock[]
}

// ── The 19 Construction Journey steps (static, verbatim) ─────────────────────

const STEPS: Step[] = [
  {n:1,type:'customer',title:'C1 — Kickoff Meeting with Customer',status:'done',
   objective:'Organize drawings, selections, and changes; set expectations; review BT schedule and field plans; confirm site logistics.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Present Cask and the team','Review BT schedule and upcoming construction journey','Review permitted set of plans and marked-up field set','Review electrical, kitchen, bathroom, plumbing, HVAC, window placement, exterior wall finish','Identify neighbors of concern','Confirm backyard laydown space; coordinate owner to clear area and install temp fencing','Verify construction sign install location with flag','Confirm QR code sheet is in the job box for sub plan review','If demo required — review demo FAQs (utility shutoff, clear space, etc.)','Schedule next meeting (Foundation and Slab on Grade)'],done:[0,1]},
          {r:'super',tasks:['Walk site and confirm all field conditions noted','Mark up field set of plans with 100% of changes'],done:[0]}]},

  {n:2,type:'email',title:'C1 Email — Kickoff Meeting Recap',status:'current',
   objective:'Send kickoff recap to customer; confirm foundation meeting date and site survey date.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include kickoff meeting agenda notes and any changes to field set of plans','Confirm date and time for Foundation and Slab on Grade meeting','Confirm date for site survey'],done:[]}]},

  {n:3,type:'window',title:'Demo (if needed)',status:'pending',
   objective:'If demo required — 3–6 weeks post kickoff; disconnect utilities, contact 811 Dig, prep demo site.',
   who:'Superintendent',
   roles:[{r:'super',tasks:['Disconnect utilities','Contact 811 Dig','Prep demo site (removal of items from area)'],done:[]}]},

  {n:4,type:'window',title:'Site Survey and Layout',status:'pending',
   objective:'Schedule survey and request pinning of building and blue-top elevation; double-check all setbacks.',
   who:'Superintendent',
   roles:[{r:'super',tasks:['Schedule site survey','Request pinning of building and blue-top elevation','Double-check setbacks: side, rear, front; stair setbacks if stairs planned'],done:[]}]},

  {n:5,type:'internal',title:'Internal Sub Meeting — Structure',status:'pending',
   objective:'Email field set of plans; superintendent walks subs and reviews scope of work.',
   who:'Superintendent, subs (framer, concrete, electrician, plumber)',
   roles:[{r:'super',tasks:['Email field set of plans to all subs','Framer — review elevation changes, window/door/garage openings, wall finishes, truss layout','Concrete — review elevation changes, window/door/garage openings, wall finishes','Electrician — install and double-check all underground','Plumber — install and double-check all underground'],done:[]}]},

  {n:6,type:'customer',title:'C2 — Foundation and Slab on Grade Meeting',status:'pending',
   objective:'Review BT schedule; walk site to confirm building corners, setbacks, slab elevation, and sanitary conditions.',
   who:'Superintendent, customer',
   roles:[{r:'super',tasks:['Review BT schedule highlighting structure timeline','Walk site: confirm corners of building, setbacks (rear, side, front), stair setback per zoning','Confirm elevation of slab on grade','Determine sanitary condition; inform owner of replacement if needed'],done:[]}]},

  {n:7,type:'email',title:'C2 Email — Foundation and Slab on Grade Recap',status:'pending',
   objective:'Send meeting recap; outline next stage in customer journey.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include foundation and slab meeting agenda notes and any changes to field set of plans','Outline next stage in customer journey'],done:[]}]},

  {n:8,type:'email',title:'C3 Email — Structure Stage Expectations',status:'pending',
   objective:'Set customer expectations for the structure stage; outline schedule and site activity.',
   who:'Sender: Project manager · CC: Superintendent, framer, concrete subs → to customer',
   roles:[{r:'pm',tasks:['Confirm structure complete celebration meeting date and time','Outline BT schedule and workflow for structure stage','Detail which subs will be on site during structure','Share best practices — notify neighbors of high-traffic period; provide FAQ post-card if needed'],done:[]}]},

  {n:9,type:'customer',title:'C3 Meeting — Structure Complete Celebration',status:'pending',
   objective:'Walk space; celebrate passing structure; prepare for MEP rough-in stage.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT schedule highlighting next steps in construction journey','Walk the completed structure with customer','Confirm rough-in next steps and upcoming MEP work'],done:[]},
          {r:'super',tasks:['Verify construction sign and QR code sheet are in place in job box'],done:[]}]},

  {n:10,type:'email',title:'C4 Email — Structure Complete Celebration Recap',status:'pending',
   objective:'Send celebration meeting recap; outline rough-in stage.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Include celebration meeting agenda notes and any changes to field set of plans','Outline next stage (rough-in) in customer journey'],done:[]}]},

  {n:11,type:'internal',title:'Internal Sub Meeting — Rough-In',status:'pending',
   objective:'Walk subs with updated scope; review MEP layout before installation.',
   who:'Superintendent, subs',
   roles:[{r:'super',tasks:['Review BT schedule highlighting rough-in stage','Review permitted plans and marked-up field plans with subs','Cover: electrical layout, kitchen layout, bathroom lighting and vanity, plumbing, HVAC'],done:[]}]},

  {n:12,type:'customer',title:'C4 Meeting — Rough-In with Customer',status:'pending',
   objective:'Walk space with client to lay out electrical, kitchen, plumbing, and HVAC before MEPs are installed.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT schedule highlighting next steps','Walk and confirm: electrical layout, kitchen layout, bathroom lighting/vanity, plumbing, HVAC','Determine neighbor concerns; coordinate direct communication if needed','Verify construction sign and QR code sheet are in place in job box'],done:[]},
          {r:'super',tasks:['Confirm all marked-up field plans are current'],done:[]}]},

  {n:13,type:'customer',title:'C5 Meeting — Finishes with Customer',status:'pending',
   objective:'Post-drywall re-walk; review and confirm all finishes to be installed; celebrate framing and in-wall inspections passing.',
   who:'Project manager, superintendent, selections manager, customer',
   roles:[{r:'pm',tasks:['Review BT schedule and selections packet','Update field drawings for all finishes to be installed','Celebrate customer passing framing and in-wall inspections','Verify construction sign and QR code sheet with updated link to plans are in job box','Confirm selections packet is in job box'],done:[]},
          {r:'select',tasks:['Walk through all finish selections with customer','Confirm kitchen and bathroom layout decisions','Document any open decisions still to be made and assign due dates'],done:[]},
          {r:'super',tasks:['Confirm field drawings are updated for all finishes'],done:[]}]},

  {n:14,type:'internal',title:'Internal Sub Meeting — Finishes',status:'pending',
   objective:'Walk subs installing finishes; review updated field drawings and selections.',
   who:'Superintendent, subs',
   roles:[{r:'super',tasks:['Review BT schedule and selections packet with subs','Review kitchen and bathroom layout with relevant subs','Update field drawings for all finishes to be installed'],done:[]}]},

  {n:15,type:'email',title:'C5 Email — Finish Meeting Recap',status:'pending',
   objective:'Send finish meeting recap; confirm open decisions and due dates.',
   who:'Sender: Project manager · CC: Superintendent, selections manager, appropriate subs → to customer',
   roles:[{r:'pm',tasks:['Recap bathroom and kitchen selections decisions; include on marked-up drawings','List items discovered during the meeting','List decisions still to be made with due dates'],done:[]}]},

  {n:16,type:'email',title:'C6 Email — Close Out Steps to Customer',status:'pending',
   objective:'Notify customer of punchlist walkthrough availability; outline close-out process.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Provide available dates and times for punchlist walkthrough','Outline close-out process: permitting, punchlist, and turnover'],done:[]}]},

  {n:17,type:'customer',title:'C6 Meeting — Punchlist Walkthrough',status:'pending',
   objective:'Walk punchlist items still to be addressed; receive customer confirmation all concerns are resolved.',
   who:'Project manager, superintendent, customer',
   roles:[{r:'pm',tasks:['Review BT punchlist with customer','Identify items missing or to be repaired','Receive customer confirmation all concerns are addressed by end of meeting'],done:[]},
          {r:'super',tasks:['Walk all punchlist items; note any new items raised by customer'],done:[]}]},

  {n:18,type:'email',title:'C7 Email — Punchlist Walkthrough Recap',status:'pending',
   objective:'Send recap of punchlist walkthrough; outline next steps and send final walkthrough invite if available.',
   who:'Sender: Project manager · CC: Superintendent → to customer',
   roles:[{r:'pm',tasks:['Review punchlist walkthrough agenda notes','Include BT punchlist print view with timestamps of completed items','Outline next steps; include final walkthrough meeting invite if available'],done:[]}]},

  {n:19,type:'customer',title:'C7 Meeting — Final Walkthrough with Customer',status:'pending',
   objective:'Conduct full interior and exterior walkthrough; deliver project to customer; close out certificate of completion.',
   who:'Project manager, superintendent, marketing manager, customer',
   roles:[{r:'pm',tasks:['Review status of Certificate of Completion (CO) and permit closing','Conduct interior walkthrough: doors and windows, appliances, walls and rooms, thermostat','Conduct exterior walkthrough: property perimeter, signage','Verify all punchlist items are complete; note any remaining items','Provide customer with ADU best practices sheet and warranty contact info','Provide CASK blueprint gift','Remove construction sign','Confirm testimonial video date/time; encourage online review'],done:[]},
          {r:'super',tasks:['Confirm punchlist is fully resolved prior to walkthrough'],done:[]},
          {r:'market',tasks:['Coordinate testimonial video recording','Capture project completion photos/video for marketing'],done:[]}]}
]

// ── Display config ───────────────────────────────────────────────────────────

// Local copies rather than imports from lib/workflow-steps.ts: that module is the
// 37-step pre-construction source of truth and is out of scope here. The three
// shared types keep its exact colours so the two journeys look like one system;
// 'email' is new to this journey and takes the blue already used for the recap
// action on the real client page.
const STEP_TYPE_CONFIG: Record<StepType, { bar: string; label: string; badgeBg: string; badgeText: string }> = {
  internal: { bar: '#6366f1', label: 'Internal',    badgeBg: '#eef2ff', badgeText: '#4338ca' },
  window:   { bar: '#f59e0b', label: 'Work Window', badgeBg: '#fffbeb', badgeText: '#92400e' },
  customer: { bar: '#ef4444', label: 'Customer',    badgeBg: '#fef2f2', badgeText: '#b91c1c' },
  email:    { bar: '#3b82f6', label: 'Email',       badgeBg: '#eff6ff', badgeText: '#1d4ed8' },
}

const ROLE_NAMES: Record<string, string> = {
  pm: 'Project Manager',
  super: 'Superintendent',
  select: 'Selections Manager',
  market: 'Marketing Manager',
}

const ROLE_COLORS: Record<string, string> = {
  pm: '#3b82f6',
  super: '#8b5cf6',
  select: '#ec4899',
  market: '#14b8a6',
}

// Same shape as the real client page's workflowActionBtn.
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
  color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)',
  padding: '4px 9px', borderRadius: 5, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
}

const badgeBase: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap',
}

// One key per (step, role, task index) for the local checkbox state.
function taskKey(n: number, role: string, ti: number) {
  return `${n}||${role}||${ti}`
}

function seedChecked(): Set<string> {
  const s = new Set<string>()
  for (const step of STEPS) {
    for (const rb of step.roles) {
      for (const ti of rb.done) s.add(taskKey(step.n, rb.r, ti))
    }
  }
  return s
}

// ── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  checked,
  onToggle,
}: {
  step: Step
  checked: Set<string>
  onToggle: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(step.status === 'current')
  const cfg = STEP_TYPE_CONFIG[step.type]
  const isCurrent = step.status === 'current'
  const isDone = step.status === 'done'
  const showAgenda = step.type === 'customer'
  const showRecap = step.type === 'customer' || step.type === 'internal'

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        borderLeft: isCurrent ? '3px solid #ef4444' : `3px solid ${cfg.bar}`,
        background: 'var(--surface)',
      }}
    >
      {/* Header row — click anywhere to expand/collapse. role="button" rather than a
          real <button> because the action buttons in the body would otherwise nest. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
        className="w-full text-left"
        style={{ display: 'flex', alignItems: 'stretch', gap: 11, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {/* Step number gutter */}
        <span
          className="shrink-0"
          style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}
        >
          {String(step.n).padStart(2, '0')}
        </span>

        {/* Title + who */}
        <span className="flex-1" style={{ padding: '10px 0', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{step.title}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{step.who}</span>
        </span>

        {/* Type badge */}
        <span className="shrink-0 self-center" style={{ ...badgeBase, color: cfg.badgeText, background: cfg.badgeBg }}>
          {cfg.label}
        </span>

        {/* Status badge */}
        {isDone ? (
          <span className="shrink-0 self-center" style={{ ...badgeBase, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--pill-green-border)' }}>
            Done
          </span>
        ) : isCurrent ? (
          <span className="shrink-0 self-center" style={{ ...badgeBase, color: 'var(--fable-red)' }}>
            Current
          </span>
        ) : (
          <span className="shrink-0 self-center" style={{ ...badgeBase, color: 'var(--text3)', border: '1px solid var(--border)' }}>
            Pending
          </span>
        )}

        {/* Chevron */}
        <span className="shrink-0 self-center" style={{ color: 'var(--text3)', fontSize: 11, paddingRight: 12, transition: 'transform 200ms ease', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', padding: '13px 15px 13px 43px' }}>
          {/* Objective */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 3 }}>
              Objective
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text2)' }}>{step.objective}</div>
          </div>

          {/* Who */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--text2)', border: '0.5px solid var(--border)', background: 'var(--surface)', borderRadius: 99, padding: '2px 8px' }}>
              👥 {step.who}
            </span>
          </div>

          {/* Role cards */}
          {step.roles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {step.roles.map(rb => (
                <div
                  key={rb.r}
                  style={{ flex: '1 1 240px', minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[rb.r] ?? 'var(--text3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text2)' }}>
                      {ROLE_NAMES[rb.r] ?? rb.r}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {rb.tasks.map((task, ti) => {
                      const key = taskKey(step.n, rb.r, ti)
                      const on = checked.has(key)
                      return (
                        <button
                          key={ti}
                          type="button"
                          onClick={() => onToggle(key)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <span
                            className="shrink-0"
                            style={{ width: 14, height: 14, borderRadius: 3, border: on ? '1.5px solid var(--checkbox-checked-bg, var(--charcoal))' : '1.5px solid var(--border2)', background: on ? 'var(--checkbox-checked-bg, var(--charcoal))' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'background 120ms ease, border-color 120ms ease' }}
                          >
                            {on && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--checkbox-checked-fg, #fff)' }} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--text)', opacity: on ? 0.5 : 1, textDecoration: on ? 'line-through' : 'none' }}>
                            {task}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action row — visual only. Every button here is deliberately inert. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {showAgenda && (
              <button type="button" title="Preview only — this button does nothing" style={actionBtn}>📋 View Agenda</button>
            )}
            {showRecap && (
              <button type="button" title="Preview only — this button does nothing" style={{ ...actionBtn, color: 'var(--text3)', opacity: 0.5 }}>🎙️ View Recap</button>
            )}
            {step.type === 'email' && (
              <button type="button" title="Preview only — this button does nothing" style={{ ...actionBtn, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)', fontWeight: 600 }}>✉️ Generate Recap Email</button>
            )}
            <button
              type="button"
              title="Preview only — this button does nothing"
              style={{
                ...actionBtn,
                color: isDone ? '#166534' : 'var(--btn-primary-text, #fff)',
                background: isDone ? 'var(--green-bg)' : 'var(--btn-primary-bg, var(--charcoal))',
                border: isDone ? '1px solid var(--pill-green-border)' : '1px solid var(--btn-primary-bg, var(--charcoal))',
                fontWeight: 600,
              }}
            >
              {isDone ? '✓ Completed' : 'Mark Complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lock icon ────────────────────────────────────────────────────────────────

// Inline padlock so the locked tab needs no icon dependency (this page
// deliberately avoids the CDN icon sets the Big Vision pages pull in).
function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: -1 }}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// ── Main tab button (mirrors ClientTabBtn on the real client page) ───────────

// Same geometry, weights and colours as ClientTabBtn in customers/[id]/page.tsx
// (fontSize 12.5, 9px/14px padding, 2px bottom border in --charcoal when active),
// with a locked variant added for the Construction Journey tab.
function TabBtn({
  label,
  active,
  locked = false,
  onSelect,
}: {
  label: string
  active: boolean
  locked?: boolean
  onSelect?: () => void
}) {
  const title = locked
    ? 'Unlocks once Pre-Construction is marked complete'
    : active
      ? undefined
      : 'Preview only — this tab shows a placeholder'

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={locked || undefined}
      title={title}
      // Locked is a no-op click rather than `disabled`, so the tab keeps its
      // tooltip on hover and stays reachable by keyboard during the demo.
      onClick={locked ? undefined : onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0,
        borderBottom: `2px solid ${active ? 'var(--charcoal)' : 'transparent'}`,
        marginBottom: -1, padding: '9px 14px',
        cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        fontSize: 12.5, fontWeight: active ? 700 : 600,
        color: active && !locked ? 'var(--text)' : 'var(--text3)',
        opacity: locked ? 0.45 : 1,
        transition: 'color 150ms ease, opacity 150ms ease',
      }}
    >
      {locked && <LockIcon />}
      {label}
    </button>
  )
}

// ── Sub-tab button (secondary to the row above — pill, not underline) ────────

// Deliberately a different treatment from TabBtn: smaller type on a recessed
// pill track, so the two levels read as page-section vs. view-within-section.
function SubTabBtn({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      style={{
        padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: active ? 700 : 600,
        color: active ? 'var(--text)' : 'var(--text3)',
        background: active ? 'var(--surface)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 150ms ease, color 150ms ease',
      }}
    >
      {label}
    </button>
  )
}

// ── Inert placeholder panel for the four non-Construction tabs ───────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div
      className="rounded-[12px]"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '38px 24px', textAlign: 'center' }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>🗂️</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text3)', maxWidth: 460, margin: '0 auto' }}>
        Preview only — this tab is a placeholder. The live version already runs on the real
        client page; this demo covers the{' '}
        <b style={{ fontWeight: 600, color: 'var(--text2)' }}>Construction Journey</b> tab only.
      </div>
    </div>
  )
}

// ── Reference-file placeholder cards ─────────────────────────────────────────

const REFERENCE_FILES: { icon: string; title: string; note: string }[] = [
  { icon: '📅', title: 'Scheduling', note: 'BT schedule exports and stage timelines the crew works off during construction.' },
  { icon: '📐', title: 'Drawings',   note: 'Permitted set plus the marked-up field set carried through every stage meeting.' },
  { icon: '🎨', title: 'Selections', note: 'The selections packet referenced from the finishes and rough-in walkthroughs.' },
]

function ReferenceFilesPanel() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20 }}>
      {REFERENCE_FILES.map(f => (
        <div
          key={f.title}
          style={{
            flex: '1 1 240px', minWidth: 220, background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 10, padding: '14px 15px',
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{f.title}</div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text3)', marginBottom: 11 }}>{f.note}</div>
          <button type="button" title="Preview only — this button does nothing" style={actionBtn}>
            📎 Open folder
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'journey',       label: 'Journey' },
  { id: 'communication', label: 'Communication' },
  { id: 'files',         label: 'Files & Agenda' },
  { id: 'construction',  label: 'Construction Journey' },
]

export default function ConstructionJourneyPreviewPage() {
  // Which top-level tab is selected. Starts on Overview to match the real client
  // page's default, and because Construction Journey is locked on first load.
  const [tab, setTab] = useState<MainTab>('overview')

  // The demo switch. Off by default, so the locked tab is what a viewer sees first.
  const [preComplete, setPreComplete] = useState(false)

  // Which view inside the Construction Journey tab.
  const [cjView, setCjView] = useState<CjView>('steps')

  const [checked, setChecked] = useState<Set<string>>(seedChecked)

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const locked = !preComplete
  // Derived rather than synced with an effect: flipping the demo switch back off
  // while Construction Journey is open falls back to Overview, with no stale state.
  const activeTab: MainTab = tab === 'construction' && locked ? 'overview' : tab

  const doneCount = STEPS.filter(s => s.status === 'done').length
  const pct = Math.round((doneCount / STEPS.length) * 100)

  return (
    <>
      <TopBar title="Active Clients" subtitle="Sample Client" />

      <div className="flex-1 overflow-y-auto animate-page-in" style={{ scrollbarGutter: 'stable' }}>
        <div style={{ maxWidth: 1180, padding: '28px 36px 90px' }}>

          {/* Preview notice — this page looks exactly like the real client page, so it
              says plainly that it is not one. */}
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18,
              padding: '9px 13px', borderRadius: 8,
              background: 'var(--amber-bg)', border: '1px solid var(--badge-open-border)',
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1.3 }}>⚠️</span>
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text2)' }}>
              <b style={{ fontWeight: 700, color: 'var(--text)' }}>Preview only.</b>{' '}
              Static demo of the 19-step Construction Journey. Not connected to any client
              record — no data is read or saved. Everything except the demo switch, the tabs
              and the checkboxes is inert, and all state resets on reload.
            </span>
          </div>

          {/* Breadcrumb — visual match for the real page's back link, intentionally not
              a real link so this page navigates nowhere. */}
          <div
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-[18px]"
            style={{ color: 'var(--text3)' }}
          >
            ← Active Clients
          </div>

          {/* Demo controls — the only stateful control outside the journey itself.
              Gates the locked/unlocked state of the Construction Journey tab. */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 14, flexWrap: 'wrap', marginBottom: 18,
              padding: '10px 14px', borderRadius: 9,
              background: 'var(--surface2)', border: '1px dashed var(--border2)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 3 }}>
                Demo controls
              </div>
              <label htmlFor="cj-pre-complete" style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                Simulate: Pre-Construction marked complete?
              </label>
            </div>

            {/* Switch */}
            <button
              id="cj-pre-complete"
              type="button"
              role="switch"
              aria-checked={preComplete}
              onClick={() => setPreComplete(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, background: 'none',
                border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 34, height: 19, borderRadius: 99, padding: 2, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  justifyContent: preComplete ? 'flex-end' : 'flex-start',
                  background: preComplete ? 'var(--green)' : 'var(--border2)',
                  transition: 'background 150ms ease',
                }}
              >
                <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', display: 'block' }} />
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: preComplete ? 'var(--green)' : 'var(--text3)', minWidth: 62, textAlign: 'left' }}>
                {preComplete ? 'Unlocked' : 'Locked'}
              </span>
            </button>
          </div>

          {/* ── Main tab row (page sections) ── */}
          <div
            role="tablist"
            aria-label="Client profile views"
            style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 20 }}
          >
            {MAIN_TABS.map(t => (
              <TabBtn
                key={t.id}
                label={t.label}
                active={activeTab === t.id}
                locked={t.id === 'construction' && locked}
                onSelect={() => setTab(t.id)}
              />
            ))}
          </div>

          {/* ── Inert placeholder tabs ── */}
          {activeTab !== 'construction' && (
            <PlaceholderPanel label={MAIN_TABS.find(t => t.id === activeTab)?.label ?? ''} />
          )}

          {/* ── Construction Journey ── */}
          {activeTab === 'construction' && (
            <>
              {/* Sub-tab row (views within Construction Journey) */}
              <div style={{ marginBottom: 16 }}>
                <div
                  role="tablist"
                  aria-label="Construction Journey views"
                  style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                  <SubTabBtn label="Steps" active={cjView === 'steps'} onSelect={() => setCjView('steps')} />
                  <SubTabBtn label="Reference Files" active={cjView === 'files'} onSelect={() => setCjView('files')} />
                </div>
              </div>

              <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                {/* Section head */}
                <div className="flex items-baseline justify-between" style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--text3)' }}>
                    {cjView === 'steps' ? 'Construction Journey' : 'Reference Files'}
                  </h2>
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                    {cjView === 'steps' ? `${doneCount} of ${STEPS.length} steps` : `${REFERENCE_FILES.length} folders`}
                  </span>
                </div>

                {cjView === 'steps' ? (
                  <>
                    {/* Progress */}
                    <div className="flex items-center" style={{ gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <b style={{ fontWeight: 600, color: 'var(--text)' }}>{doneCount} of {STEPS.length}</b> steps complete
                      </span>
                      <span className="flex-1 overflow-hidden" style={{ height: 4, borderRadius: 99, background: 'var(--surface2)' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 200ms ease' }} />
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                    </div>

                    {/* Steps */}
                    <div>
                      {STEPS.map(step => (
                        <StepRow key={step.n} step={step} checked={checked} onToggle={toggle} />
                      ))}
                    </div>
                  </>
                ) : (
                  <ReferenceFilesPanel />
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
