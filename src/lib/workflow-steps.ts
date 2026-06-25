// src/lib/workflow-steps.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared definition of the 33-step CASK Customer Journey workflow.
//
// This mirrors the WORKFLOW_STEPS data originally defined inline in
// src/app/(app)/customers/[id]/page.tsx. It is extracted here so the Dashboard's
// "Active Clients — Customer Journey" section can display the same step titles and
// per-role tasks without duplicating the data in that page.
//
// NOTE: The customers/[id] page still keeps its own copy for now; if you refactor
// it later, import from this module instead to keep a single source of truth.
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
export const ROLE_NAMES: Record<string, string> = {
  sales_pm: 'Sales PM',
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
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Fill Customer Journey Booklet with dates & contact info; staple business card', 'Print contract template', 'Print Contract Alignment Guide', 'Prefill timeline / contract price on the Contract Alignment Guide from the internal pass-off'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Prefill the design portion of the Alignment Meeting agenda with info from the internal pass-off', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 4, type: 'customer', title: 'Customer Alignment Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present CASK and the team', 'Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Run through the Architect Guide Agenda', 'Inform customer about Sewer Survey'] }
  ]},
  { step: 5, type: 'window', title: 'After Alignment', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Sales PM (12 hr)', 'Work on 1st design set of plans', 'Send 1st design set to Estimator', 'Request sanitary survey'] }
  ]},
  { step: 6, type: 'window', title: 'Before 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Sales PM (48 hr before)'] }
  ]},
  { step: 7, type: 'customer', title: '1st Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule flag meeting & 2nd design meeting'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Present Alignment Meeting Plans', 'Run through the Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 8, type: 'window', title: 'After 1st Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Recap email to Sales PM (12 hr)', 'Work on 2nd design set of plans', 'Print Plans and Architect Guide Agenda'] }
  ]},
  { step: 9, type: 'customer', title: 'Flag Meeting', subtitle: 'Customer meeting · on site', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Present 1st Design Meeting Plans', 'Run through the Architect Guide Agenda'] }
  ]},
  { step: 10, type: 'window', title: 'After Flag Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to customer with photos & notes (24 hr)', 'Mark up plans with technical info from flag', 'Send plans to Estimator (4 days before 2nd design meeting)'] }
  ]},
  { step: 11, type: 'window', title: 'Before 2nd Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review budget update'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Print Plans and Architect Guide Agenda'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Create budget update with assumption selections (Assumption Magazine), budget comparison sheet, and any clarifications needed from the architect (48 hr)', 'Send budget update to Sales PM (48 hr before)'] }
  ]},
  { step: 12, type: 'customer', title: '2nd Design Meeting', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Project Alignment Guide (purpose statement, feasibility, finance, budget update)', 'Timeline', 'Schedule next meeting (possible 3rd design, or contract review + permit submission)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Drawing questions agenda; present 2nd design set of plans'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Join the meeting if more than 30% over their budget', 'Bring Value Engineering options to align the budget update with the customer\'s budget'] }
  ]},
  { step: 13, type: 'window', title: 'After Last Design Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email to customer with architect\'s portion (24 hr)'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Technical recap email to Sales PM', 'Prepare permit set of drawings with engineer details (bid-ready)'] }
  ]},
  { step: 14, type: 'window', title: 'Permit Prep & Bid', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send plans to Estimator & Permit Dept', 'Energy calc and engineer sign & seal'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send out for bid'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Draft permit application'] }
  ]},
  { step: 15, type: 'window', title: 'Permit Submission', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Email customer that plans are in for permit'] },
    { role: 'architect', color: '#8b5cf6', tasks: ['Send permit set & energy calc to Permit Dept'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Submit for permit', 'Email Sales PM confirming permit submission'] }
  ]},
  { step: 16, type: 'window', title: 'Contract Draft & Permit Tracking', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Create 3D walkthrough with included selections'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Draft contract and review bid; send for scope revision', 'Schedule contract review meeting with Sales PM'] },
    { role: 'permit_dept', color: '#6366f1', tasks: ['Check permit status', 'Send RFC to Architect, Sales & Estimator', 'Resubmit for permit (own the resubmission turnaround)', 'Receive permit approval'] }
  ]},
  { step: 17, type: 'window', title: 'Contract Finalization', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Finalize contract', 'Send finalized contract to Sales PM'] }
  ]},
  { step: 18, type: 'internal', title: 'Contract Review — Estimator / Sales PM', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review contract with Estimator'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Explain contract', 'Go through detail comparing Architect Agenda Notes, Drawing and Scope of work'] }
  ]},
  { step: 19, type: 'window', title: 'After Contract Review with Estimator', subtitle: 'Work window · 1 week', timeWindow: '1 week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Call client to confirm price alignment ahead of execution'] }
  ]},
  { step: 20, type: 'customer', title: 'Contract Review', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Review Alignment Guide', 'Review boilerplate', 'Review scope', 'Sign contract', 'Discuss timeline & schedule tentative kick-off (~6 weeks out)', 'Schedule selection meeting'] }
  ]},
  { step: 21, type: 'window', title: 'After Contract Review', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send recap email with executed contract (or, if unsigned, the decision made in the meeting)'] }
  ]},
  { step: 22, type: 'internal', title: 'Selection Internal Alignment', subtitle: 'Internal meeting · before selection meeting', timeWindow: null, roles: [
    { role: 'estimator', color: '#f59e0b', tasks: ['Meet with Selection Manager to decide needed selections and allowances (e.g., $3.50/sqft for tile)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Update the selection template with the necessary items'] }
  ]},
  { step: 23, type: 'internal', title: 'Pass-Off: Estimator to Construction Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present customer info and purpose statement'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Run the meeting to hand off scope of work and contract info to the Construction PM'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Begin learning the project'] }
  ]},
  { step: 24, type: 'customer', title: 'Selection Meeting 1', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Assist with walkthrough and any plan markups (set rules for when modifications carry a cost implication)'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 25, type: 'window', title: 'After Selection Meeting 1', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'architect', color: '#8b5cf6', tasks: ['Send red markups to Construction Manager for any needed change orders'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send email to Sales PM if we are out of price'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer'] }
  ]},
  { step: 26, type: 'window', title: 'Before Selection Meeting 2', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Contact homeowner if selections and contract price are misaligned'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Work on change order', 'Email Sales PM & Selection if modifications exceed $4k', 'Request sub card, create PO, organize field pass-off, reconcile change-order allowances before breaking ground'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Email Estimator and Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 27, type: 'customer', title: 'Selection Meeting 2', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 28, type: 'window', title: 'After / Before Next Selection Meeting', subtitle: 'Work window · 1 week', timeWindow: '1 week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 29, type: 'customer', title: 'Selection Meeting Final', subtitle: 'Customer meeting', timeWindow: null, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Run selection meeting', 'Schedule next meeting'] }
  ]},
  { step: 30, type: 'window', title: 'After Final Selection Meeting', subtitle: 'Work window · ½ week', timeWindow: '½ week', hasEmail: true, roles: [
    { role: 'selection_mgr', color: '#10b981', tasks: ['Send recap email to customer', 'Email Estimator & Sales PM only if customer chooses items outside the allowance'] }
  ]},
  { step: 31, type: 'window', title: 'Before Final Pass-Off', subtitle: 'Work window · ½ week', timeWindow: '½ week', roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Send change-order reconciliation allowance to customer for approval'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Send change-order reconciliation allowance to Sales PM', 'Internal CM-to-Super pass-off'] }
  ]},
  { step: 32, type: 'internal', title: 'Final Pass-Off: Estimator to Construction Manager', subtitle: 'Internal meeting', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Present customer info and purpose statement'] },
    { role: 'estimator', color: '#f59e0b', tasks: ['Run the meeting to hand off scope of work and contract info to the Construction PM'] },
    { role: 'selection_mgr', color: '#10b981', tasks: ['Go through the selection choices from the customer'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Learn as much as possible about the project'] }
  ]},
  { step: 33, type: 'customer', title: 'Kick-Off Meeting', subtitle: 'Customer meeting · construction begins', timeWindow: null, roles: [
    { role: 'sales_pm', color: '#3b82f6', tasks: ['Introduce Construction Manager and Superintendent'] },
    { role: 'construction_pm', color: '#ef4444', tasks: ['Take over and run the agenda'] }
  ]}
]

export const TOTAL_WORKFLOW_STEPS = WORKFLOW_STEPS.length
