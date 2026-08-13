// src/lib/workflow-steps.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared definition of the 37-step CASK Customer Journey workflow.
//
// This is the single source of truth for the workflow step data. The customer
// detail page (src/app/(app)/customers/[id]/page.tsx), the Dashboard's "Active
// Clients — Customer Journey" section, the OKR dashboard and my-project all
// import from here, so step titles and per-role tasks stay in sync.
// ──────────────────────────────────────────────────────────────────────────────

export type WorkflowRole =
  | 'sales_pm' | 'architect' | 'estimator'
  | 'selection_mgr' | 'construction_pm' | 'permit_dept'

export type StepType = 'internal' | 'window' | 'customer'

export interface WorkflowRoleTasks { role: WorkflowRole; color: string; tasks: string[] }

export interface WorkflowStepDef {
  step: number
  type: StepType
  title: string
  subtitle: string
  timeWindow: string | null
  hasEmail?: boolean
  roles: WorkflowRoleTasks[]
}

// Display names for each role used in the workflow.
// NOTE: `sales_pm` is the persisted identifier (journey_checklists.role) — the key
// must never be renamed. Only its display label changed to "Client Solution Manager".
export const ROLE_NAMES: Record<string, string> = {
  sales_pm: 'Client Solution Manager',
  architect: 'Architect',
  estimator: 'Estimator',
  selection_mgr: 'Selection Manager',
  construction_pm: 'Construction PM',
  permit_dept: 'Permit Dept',
}

// Per-type badge styling.
export const STEP_TYPE_CONFIG: Record<StepType, { bar: string; label: string; badgeBg: string; badgeText: string }> = {
  internal: { bar: '#6366f1', label: 'Internal',    badgeBg: '#eef2ff', badgeText: '#4338ca' },
  window:   { bar: '#f59e0b', label: 'Work Window', badgeBg: '#fffbeb', badgeText: '#92400e' },
  customer: { bar: '#ef4444', label: 'Customer',    badgeBg: '#fef2f2', badgeText: '#b91c1c' },
}

// meeting_code used to persist checklist state for a given step (e.g. "step_07").
export function stepCode(step: number) {
  return `step_${String(step).padStart(2, '0')}`
}

// Build the lookup key used to match a workflow task to its per-client checklist row.
export function checklistKey(meetingCode: string, role: string, taskText: string) {
  return `${meetingCode}||${role}||${taskText}`
}

export const WORKFLOW_STEPS: WorkflowStepDef[] = [
  { step: 1, type: 'internal', title: 'Internal Sales-to-Precon Pass-Off', subtitle: 'Internal meeting · handoff', timeWindow: null, roles: [] },
  { step: 2, type: 'window', title: 'After Internal Pass-Off', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create a set of plans for the alignment meeting'] }
  ]},
  { step: 3, type: 'window', title: 'Before Customer Alignment', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Fill Your Project Customer Journey Booklet with dates & contact info; staple business card', 'Print contract template', 'Print Contract Alignment Guide', 'Prefill timeline / contract price on the Contract Alignment Guide from the internal pass-off'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Prefill the design portion of the Alignment Meeting agenda with info from the internal pass-off', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 4, type: 'customer', title: 'Customer Alignment Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present Cask and the team', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Run through the Architect Guide Agenda', 'Inform Customer about Sewer Survey'] }
  ]},
  { step: 5, type: 'window', title: 'After Alignment', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Client Solution Manager (12 hr)', 'Work on 1st design set of plans', 'Send 1st design set to Estimator', 'Request sanitary survey'] }
  ]},
  { step: 6, type: 'window', title: 'Before 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Client Solution Manager (48 hr before)'] }
  ]},
  { step: 7, type: 'customer', title: '1st Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule flag meeting & 2nd design meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Present Alignment Meeting Plans', 'Run through the Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 8, type: 'window', title: 'After 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Client Solution Manager (12 hr)', 'Work on 2nd design set of plans', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 9, type: 'customer', title: 'Flag Meeting', subtitle: 'Customer meeting · on site', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Present latest design set of plans (2nd/3rd)', 'Run through the Architect Guide Agenda'] }
  ]},
  { step: 10, type: 'window', title: 'After Flag Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to customer with photos & notes (24 hr)', 'Mark up plans with technical info from flag', 'Send plans to Estimator for permit set prep'] }
  ]},
  { step: 11, type: 'window', title: 'Before 2nd Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Client Solution Manager (48 hr before)'] }
  ]},
  { step: 12, type: 'customer', title: '2nd Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting (possible 3rd design, or contract review + permit submission). If a 3rd design meeting is needed, repeat the same steps as the 2nd design'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Drawing questions agenda; present 2nd design set of plans'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 13, type: 'window', title: 'After 2nd Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Client Solution Manager (12 hr)', 'Incorporate 2nd design meeting revisions'] }
  ]},
  { step: 14, type: 'window', title: 'Before 3rd Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Client Solution Manager (48 hr before)'] }
  ]},
  { step: 15, type: 'customer', title: '3rd Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Confirm final design; schedule contract review + permit submission'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Drawing questions agenda; present 3rd design set of plans'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 16, type: 'window', title: 'After Last Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to Client Solution Manager', 'Prepare permit set of drawings with engineer details (bid-ready)'] }
  ]},
  { step: 17, type: 'window', title: 'Permit Prep', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create a 99% set of plans', 'Energy calc requested'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Draft permit application'] }
  ]},
  { step: 18, type: 'window', title: 'Project Buildability', subtitle: 'Work window', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send permit set of plans to Construction PM', 'Make modifications from Construction PM red marks', 'Finalize the set that goes out for estimate and permit'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Red-mark the permit set of plans for buildability', 'Return marked-up plans to Architect'] }
  ]},
  { step: 19, type: 'window', title: 'Bid', subtitle: 'Work window', timeWindow: null, roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Send finalized (post-buildability) set out for bid'] }
  ]},
  { step: 20, type: 'window', title: 'Permit Submission', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Email customer that plans are in for permit'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Send permit set & energy calc to Permit Dept'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Submit for permit', 'Email Client Solution Manager confirming permit submission'] }
  ]},
  { step: 21, type: 'window', title: 'Contract Draft & Permit Tracking', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create 3D walkthrough with included selections'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Draft contract and review bid; send for scope-revision VA', 'Schedule contract review meeting with Client Solution Manager'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Check permit status', 'Send RFC to Architect, Sales & Estimator', 'Resubmit for permit (own the resubmission turnaround)', 'Receive permit approval'] }
  ]},
  { step: 22, type: 'window', title: 'Contract Finalization', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Finalize contract', 'Send finalized contract to Client Solution Manager'] }
  ]},
  { step: 23, type: 'internal', title: 'Contract Review Estimator/Client Solution Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review contract with Estimator'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Explain Contract', 'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work.'] }
  ]},
  { step: 24, type: 'window', title: 'After Contract Review with Estimator', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Call client to confirm price alignment ahead of execution'] }
  ]},
  { step: 25, type: 'customer', title: 'Contract Review', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review Alignment Guide', 'Review boilerplate', 'Review scope', 'Sign contract', 'Discuss timeline & schedule tentative kick-off (~6 weeks out)', 'Schedule selection meeting', 'If they don\'t sign, schedule a signature meeting'] }
  ]},
  { step: 26, type: 'window', title: 'After Contract Review', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email with executed contract (or, if unsigned, the decision made in the meeting — separate workflow to follow)'] }
  ]},
  { step: 27, type: 'internal', title: 'Before Selection Meeting (Selection Internal Alignment)', subtitle: 'Internal meeting · before selection meeting', timeWindow: null, roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Meet with Selection Manager to decide needed selections and allowances (e.g., $3.50/sqft for tile)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Update the selection template with the necessary items'] }
  ]},
  { step: 28, type: 'customer', title: 'Selection Meeting 1', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Assist with walkthrough and any plan markups (set rules for when modifications carry a cost implication)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 29, type: 'window', title: 'After Selection Meeting', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send red markups to Construction Manager for any needed change orders'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send email to Client Solution Manager if we are out of price'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer'] }
  ]},
  { step: 30, type: 'window', title: 'Before Next Selection Meeting', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Contact homeowner if selections and contract price are misaligned'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Work on change order', 'Email Client Solution Manager & Selection if modifications exceed $4k', 'Request sub card, create PO, organize field pass-off, reconcile change-order allowances before breaking ground'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Email Estimator and Client Solution Manager only if customer chooses items outside the allowance'] }
  ]},
  { step: 31, type: 'customer', title: 'Selection Meeting 2', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 32, type: 'window', title: 'After / Before Next Selection Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'] }
  ]},
  { step: 33, type: 'customer', title: 'Selection Meeting Final', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 34, type: 'window', title: 'After Selection Meeting', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Client Solution Manager only if customer chooses items outside the allowance'] }
  ]},
  { step: 35, type: 'window', title: 'Before Estimator to Construction Manager Pass-Off', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send change-order reconciliation allowance to Customer for approval'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send change-order reconciliation allowance to Client Solution Manager', 'Internal CM-to-Super pass-off'] }
  ]},
  { step: 36, type: 'internal', title: 'Pass-Off: Estimator to Construction Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present customer info and purpose statement'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Run the meeting to hand off scope of work and contract info to the Construction PM'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Go through the Selection choice from the customer'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Learn as much as possible about the project'] }
  ]},
  { step: 37, type: 'customer', title: 'Kick-Off Meeting', subtitle: 'Customer meeting · construction begins', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Introduce CM and Super'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Take over and run the agenda'] }
  ]}
]

export const TOTAL_WORKFLOW_STEPS = WORKFLOW_STEPS.length

// The next step after `currentStepNumber` that is an actual meeting rather than a
// work period — i.e. the first later step whose type is not 'window' ('customer' or
// 'internal'). Returns null when no later meeting step exists (e.g. from step 37, or
// from any step followed only by work windows). Pure; reads WORKFLOW_STEPS only.
export function getNextMeetingStep(currentStepNumber: number): WorkflowStepDef | null {
  return WORKFLOW_STEPS.find(s => s.step > currentStepNumber && s.type !== 'window') ?? null
}

// ── Due-date / timeline helpers (NEW, additive) ──────────────────────────────
// Shared by the customer detail page and the dashboard so both compute task due
// dates and overdue states the same way. All pure — no side effects, no I/O.

// Map a step's timeWindow string to a number of days. Customer/internal meetings
// have no time window (null) and therefore no derived due date.
export function timeWindowDays(timeWindow: string | null): number | null {
  if (timeWindow === '½ week') return 3
  if (timeWindow === '1 week') return 7
  return null
}

// Offset (in days) from a step's start to a task's due date. Specific timing
// mentioned in the task text takes precedence over the step's timeWindow.
export function taskDueOffsetDays(taskText: string, timeWindow: string | null): number | null {
  const t = taskText.toLowerCase()
  if (t.includes('24 hr') || t.includes('24 hours')) return 1
  if (t.includes('12 hr') || t.includes('12 hours')) return 0.5
  if (t.includes('48 hr') || t.includes('48 hours')) return 2
  // Likely dead code after the 33 -> 37 step migration: the only task that ever
  // mentioned "4 days" was old step 10's "Send plans to Estimator (4 days before
  // 2nd design meeting)", now reworded to "Send plans to Estimator for permit set
  // prep". No task in the current WORKFLOW_STEPS matches this branch. Left in place
  // deliberately — remove only after confirming no other caller feeds it task text.
  if (t.includes('4 days')) return 4
  return timeWindowDays(timeWindow)
}

// Compute a task's due date from when its step started. Returns null when the
// step hasn't been timestamped yet or the task/step has no time window.
export function computeTaskDueDate(
  startedAt: Date | null,
  timeWindow: string | null,
  taskText: string,
): Date | null {
  if (!startedAt) return null
  const offset = taskDueOffsetDays(taskText, timeWindow)
  if (offset == null) return null
  return new Date(startedAt.getTime() + offset * 24 * 60 * 60 * 1000)
}

export type TaskDueState = 'done' | 'none' | 'overdue' | 'soon' | 'ok'

// Color state for a task's due-date indicator.
// done → completed (no indicator) · none → no due date · overdue (red) ·
// soon (amber, within 24h) · ok (green, more than 24h away).
export function getTaskDueState(dueDate: Date | null, completed: boolean): TaskDueState {
  if (completed) return 'done'
  if (!dueDate) return 'none'
  const diffMs = dueDate.getTime() - Date.now()
  if (diffMs < 0) return 'overdue'
  if (diffMs <= 24 * 60 * 60 * 1000) return 'soon'
  return 'ok'
}

// Whole days remaining until a due date (ceil), for "Due in X days" labels.
export function daysUntilDue(dueDate: Date): number {
  return Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}
