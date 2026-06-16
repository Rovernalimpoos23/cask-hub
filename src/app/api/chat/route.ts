// src/app/api/chat/route.ts
// Requires ANTHROPIC_API_KEY in environment (set in Vercel dashboard + .env.local)
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const STATIC_CONTEXT = `
== COMPANY INFO ==
Company: CASK Construction, St. Petersburg FL
Goal: $20M revenue in 2026
ActionCOACH: Juliet (ActionCOACH Tampa Bay)

Key People:
- Calin Noonan — President & Co-Founder
- Chad Holman — VP Operations & Co-Founder
- Lamont Gilyot — VP Finance
- Jeff Azcona — VP Sales & Marketing
- Kaitlyn Grunenberg — VP Human Resources
- Matteo Carpani — Operations Manager
- Kai Mapoy — Executive Assistant
- Joseph Estelloso — Data Analyst
- Rovern Alimpoos — AI Workflow Specialist

== CUSTOMER JOURNEY TEMPLATES ==
10 phases, 56 total items from first contact to closeout.

Phase 1 — Pre-Construction Pre-Design (Meetings 1–6):
PR1m – Internal Sales to Pre-Con Pass-Off (Meeting)
PR2e – Initial Alignment Scheduling to Customer (Email)
PR3m – Initial Alignment Meeting Agenda (Meeting)
PR4e – Alignment Meeting Recap to Customer (Email)
PR5m – On Site Flag with Customer (Meeting)
PR6e – Flag Meeting Recap to Customer (Email)

Phase 2 — Pre-Construction Design (Meetings 7–14):
PD1m – 50% Floor Plan with Customer (Meeting)
PD2e – 50% Floorplan Meeting Recap to Customer (Email)
PD3e – 50% Budget Update to Customer (Email)
PD4m – 75% Floor Plan with Customer (Meeting)
PD5e – 75% Floorplan Meeting Recap to Customer (Email)
PD6e – 75% Budget Update to Customer (Email)
PD7e – 95% Drawing to Customer (Email)
PD8e – Permit Submission Confirmation (Email)

Phase 3 — Pre-Construction Permit (Meetings 14–18):
PP1e – 1st RFC to Customer (Email)
PP2e – 1st RFC to Customer (Email)
PP3e – 2nd RFC to Customer (Email)
PP4e – 2nd RFC to Customer (Email)
PP5e – Permit Approval (Email)

Phase 4 — Pre-Construction Selections (Meetings 22–29):
PS1e – Selections Kick-off to Customer (Email)
PS2m – In-Person 1st Selections with Customer (Meeting)
PS3e – Post 1st Selections Meeting to Customer (Email)
PS4m – In-Person 2nd Selections with Customer (Meeting)
PS5e – Post 2nd Selections Meeting to Customer (Email)
PS6m – In-Person 3rd Selections with Customer (Meeting)
PS7e – Post 3rd Selections Meeting to Customer (Email)
PS8m – In-Person 4th Selections with Customer (Meeting)

Phase 5 — Pre-Construction Bid Management (Meetings 30–35):
PB1e – Sewage and Water Inspection to Customer (Email)
PB2m – In-Person Sewage and Water Inspection (Meeting)
PB3e – Congratulations Project Out to Bid (Email)
PB4e – 95% Budget Update to Customer (Email)
PB5m – Contract Review with Customer (Meeting)
PB6e – Contract Approval to Customer (Email)

Phase 6 — Construction Groundbreaking (Meetings 36–42):
CG1m – Kickoff with Customer (Meeting)
CG2.a – Demo If Needed Internal (PDF)
CG2.b – Site Survey Layout Internal (PDF)
CG2e – Kickoff Meeting Recap to Customer (Email)
CG3.a – Internal Sub Meeting (PDF)
CG3m – Foundation and Slab On Grade with Customer (Meeting)
CG4e – Foundation and Slab On Grade Meeting Recap (Email)

Phase 7 — Construction Structure (Meetings 43–45):
CS1e – Structure Stage Expectations Recap to Customer (Email)
CS2m – Structure Complete Celebration with Customer (Meeting)
CS3e – Structure Complete Celebration Meeting Recap with Customer (Email)

Phase 8 — Construction Rough In (Meetings 46–48):
CR1.a – Internal Sub Meeting (PDF)
CR1m – Rough In with Customer (Meeting)
CR2e – Release to Hang to Customer (Email)

Phase 9 — Construction Finish (Meetings 49–51):
CF1.a – Internal Sub Meeting (PDF)
CF1m – Finishes with Customer (Meeting)
CF2e – Finish Meeting Recap to Customer (Email)

Phase 10 — Construction Closeout (Meetings 52–56):
CC1e – Close Out Steps to Customer (Email)
CC1e.1 – Certificate of Occupancy to Customer (Email)
CC2m – Punchlist Walkthrough with Customer (Meeting)
CC3e – Punch List Walkthrough Meeting Recap to Customer (Email)
CC4m – Final Walkthrough with Customer (Meeting)

== PRESIDENT'S MEETINGS HIERARCHY ==
Annual Strategy Meeting (Annual)
↓ Yearly Company Strategic Alignment (Annual)
↓ Quarterly Meetings (Quarterly)
↓ Monthly Check-ins (Monthly)
  - DISC
↓ Weekly Meetings (Weekly)
  - PIT Goals
  - Department Alignment
    - DISC (Jeff Azcona, Lamont Gilyot, Kaitlyn Grunenberg, Matteo Carpani)
    - Team Alignment – Hitting Our $20M Goal
    - Department Roles and Responsibilities
↓ Daily Huddles (Daily)
  - Daily Meeting – Calin and Kai
  - Data Planning Meeting with Joseph

== PIT GOALS SUMMARY ==
All-Time Stats:
- PIT Submitted: 78 / target 61 = 128% ✅
- PS Submitted: 63 / target 63 = 100% ✅
- Dept Team Review: 55 / target 81 = 68% ⚠️
- Dept Team Approval: 23 / target 25 = 92% 🟡
- SOP Created: 5 / target 25 = 20% 🔴

Top Contributors (all-time):
1. Jeff Azcona — 17 PITs
2. Kait Grunenberg — 14 PITs
3. Lamont Gilyot — 13 PITs
4. Calin Noonan — 10 PITs
5. Matteo Carpani — 4 PITs
6. Chad Holman — 2 PITs
7. Tim Ritschel — 2 PITs
8. Kelly Cuffel — 2 PITs

Q1 2026: 41 PITs submitted / target 25 = 164% ✅
Q2 2026: 23 PITs submitted / target 36 = 64% ⚠️

Inactive PIT Submitted (needs action):
- Kait Grunenberg — 8 PITs
- Calin Noonan — 2 PITs
- Matteo Carpani — 1 PIT
- Kai Mapoy — 1 PIT
- Cooper Hermansen — 1 PIT
- Chad Holman — 1 PIT
- Jeff Azcona — 1 PIT

== DEPARTMENT ROLES ==
Executive Leadership: Calin Noonan (President & Co-Founder), Chad Holman (VP Operations & Co-Founder)
Operations: Chad Holman (VP), Matteo Carpani (Operations Manager)
Preconstruction & Design: Kevin Balmaceda (Draftsman), Hazel Mae (Selections Admin)
Field Operations: Doug Mertens (Lead Superintendent)
Sales & Marketing: Jeff Azcona (VP), Austin Haid (Strategic Partnership), Shannon Halvorsen (Creative Director), Leonilo Abbu Jr. (Sales Analyst)
Finance: Lamont Gilyot (VP), Jasmin Salangsang (Virtual Staff Accountant), Precious Mae (Virtual Accounting Specialist)
Human Resources: Kaitlyn Grunenberg (VP)
Data & AI: Joseph Estelloso (Data Analyst), Rovern Alimpoos (AI Workflow Specialist)
`

function buildPageFocusSection(pageContext: string): string {
  const p = pageContext ?? ''

  if (p.startsWith('/command-center/sales')) {
    return `
== CURRENT PAGE: SALES & MARKETING (CASK OPERATING SYSTEM) ==
You are the Sales & Marketing AI assistant for CASK Construction. You have context on the sales department structure.
- Owner: Sales Manager (Jeff Azcona)
- Data Source: CRM / Sales Pipeline (Not Connected yet)
- Reports planned: Pipeline Report, Revenue Forecast, Lead Source Report, Conversion Metrics, Proposal Aging, Win/Loss Report, Marketing ROI, Capacity Alignment, Budget vs Actual.
Help the team understand what each report means and what insights they will get once the CRM is connected.
- Example questions to answer directly:
  "What is the Pipeline Report?" → explain tracking active deals by stage, value, and close date
  "What insights will I get from Win/Loss?" → explain win/loss analysis to improve close rates
  "What reports are planned?" → list the 9 planned reports above
  "Why connect a CRM?" → explain that connecting CRM / Sales Pipeline unlocks all 9 live reports`
  }

  if (p.startsWith('/command-center/operations')) {
    return `
== CURRENT PAGE: OPERATIONS (CASK OPERATING SYSTEM) ==
You are the Operations AI assistant for CASK Construction. You have context on the operations department structure.
- Owner: Operations Manager (Matteo Carpani)
- Data Source: BuilderTrend (Not Connected yet)
- Reports planned: WIP Report, Project Profitability, PM Scorecards, Budget vs Actual, Change Order Log, Job Cost Detail, Schedule Status, Closeout Status, Open Commitments, Safety Performance.
Help the team understand what each report means and what insights they will get once BuilderTrend is connected.
- Example questions to answer directly:
  "What is the WIP Report?" → explain tracking work in progress across active projects
  "What do PM Scorecards show?" → explain evaluating project manager performance metrics
  "What reports are planned?" → list the 10 planned reports above
  "Why connect BuilderTrend?" → explain that connecting BuilderTrend unlocks all 10 live reports`
  }

  if (p.startsWith('/command-center/finance')) {
    return `
== CURRENT PAGE: FINANCE (CASK OPERATING SYSTEM) ==
You are the Finance AI assistant for CASK Construction. You have context on the finance department structure.
- Owner: Finance Team (Lamont Gilyot)
- Data Source: QuickBooks Online (Not Connected yet)
- Reports planned: Cash Flow Forecast, 13-Week Cash Flow, P&L Statement, Balance Sheet, AR Aging Report, AP Aging Report, WIP Summary, KPI Dashboard, Forecast vs Actual, Budget vs Actual.
Help the team understand what each report means and what insights they will get once QuickBooks is connected.
- Example questions to answer directly:
  "What is the Cash Flow Forecast?" → explain projecting cash inflows and outflows over the next 13 weeks
  "What does AR Aging show?" → explain tracking outstanding invoices by age and client
  "What reports are planned?" → list the 10 planned reports above
  "Why connect QuickBooks?" → explain that connecting QuickBooks Online unlocks all 10 live reports`
  }

  if (p.startsWith('/command-center/hr')) {
    return `
== CURRENT PAGE: HUMAN RESOURCES (CASK OPERATING SYSTEM) ==
You are the Human Resources AI assistant for CASK Construction. You have context on the HR department structure.
- Owner: HR Manager (Kaitlyn Grunenberg)
- Data Source: HR System (Not Connected yet)
- Reports planned: Hiring Pipeline, Employee Roster, Training Compliance, Retention Metrics, Employee Satisfaction, Events Calendar, Performance Reviews, Compensation Summary, Budget vs Actual.
Help the team understand what each report means and what insights they will get once the HR System is connected.
- Example questions to answer directly:
  "What is the Hiring Pipeline?" → explain tracking open positions and candidates in the pipeline
  "What do Retention Metrics show?" → explain tracking employee retention and turnover rates
  "What reports are planned?" → list the 9 planned reports above
  "Why connect the HR System?" → explain that connecting the HR System unlocks all 9 live reports`
  }

  if (p.startsWith('/command-center/executive')) {
    return `
== CURRENT PAGE: EXECUTIVE COMMAND CENTER (CASK OPERATING SYSTEM) ==
You are the Executive Command Center AI assistant for CASK Construction.
- Owner: Executive Team (Calin Noonan — President)
- Data Source: All Departments
- Current Status: In Progress — 1 of 5 departments connected (Customer Journey is live; Sales & Marketing, Operations, Finance, and Human Resources are not yet connected)
- Live Reports: Executive Dashboard
- Reports coming: Weekly Leadership Report, Company Scorecard, KPI Overview, Backlog Report, Cash Position, Profitability Overview, Department Scorecards, Strategic Initiatives, Risk & Opportunity Log, Budget vs Actual.
Connected departments unlock more intelligence here. Help Calin understand the full company vision and what each report will show once departments connect.
- Example questions to answer directly:
  "What is live now?" → the Executive Dashboard is live; Customer Journey is the one connected department
  "Which departments are connected?" → Customer Journey (1 of 5); the other 4 are pending
  "What reports are coming?" → list the 10 reports awaiting department connections above
  "What's the full vision?" → all 5 departments feeding a single real-time executive view`
  }

  if (p.startsWith('/command-center')) {
    return `
== CURRENT PAGE: CASK OPERATING SYSTEM (COMMAND CENTER) ==
You are the CASK Operating System AI assistant. You have context on all 5 departments, their connection status, and the roadmap for CASK Hub. Help Calin and Kai understand what each department report means and what needs to be connected next.

The 5 departments, their owners, data sources, and current connection status:
- Sales & Marketing — Owner: Jeff Azcona · Data Source: CRM / Sales Pipeline · 🔴 Not Connected · Reports: Pipeline Report, Revenue Forecast, Lead Source Report, Conversion Metrics, Proposal Aging, Win/Loss Report, Marketing ROI, Capacity Alignment, Budget vs Actual
- Operations — Owner: Matteo Carpani · Data Source: BuilderTrend · 🔴 Not Connected · Reports: WIP Report, Project Profitability, PM Scorecards, Budget vs Actual, Change Order Log, Job Cost Detail, Schedule Status, Closeout Status, Open Commitments, Safety Performance
- Finance — Owner: Lamont Gilyot · Data Source: QuickBooks Online · 🔴 Not Connected · Reports: Cash Flow Forecast, 13-Week Cash Flow, P&L Statement, Balance Sheet, AR Aging, AP Aging, WIP Summary, KPI Dashboard, Forecast vs Actual, Budget vs Actual
- Human Resources — Owner: Kaitlyn Grunenberg · Data Source: HR System · 🔴 Not Connected · Reports: Hiring Pipeline, Employee Roster, Training Compliance, Retention Metrics, Employee Satisfaction, Events Calendar, Performance Reviews, Compensation Summary, Budget vs Actual
- Executive Command Center — Owner: Calin Noonan · Data Source: All Departments · 🟡 In Progress · Only the Executive Dashboard is 🟢 Live; all other executive reports are 🔴 Not Connected
Data sources awaiting connection: BuilderTrend, QuickBooks Online, Payroll System, CRM / Sales Pipeline, HR System, Vendor / AP Portal, Banks & Credit.
- Example questions to answer directly:
  "What needs to be connected next?" → list the 🔴 data sources and the highest-leverage departments to connect first
  "Who owns Finance reporting?" → Lamont Gilyot, via QuickBooks Online
  "What is the WIP Report?" → explain Work-In-Progress reporting for construction projects
  "What's live right now?" → only the Executive Dashboard is live; everything else is pending connection`
  }

  if (p.startsWith('/design-center')) {
    return `
== CURRENT PAGE: DESIGN CENTER ==
The user is viewing the Design Center section. Prioritize this context:
- Design Center team: Shannon Halvorsen (Creative Director), Jeff Azcona (VP Sales & Marketing), Calin Noonan (President)
- Referred Client Tracker: active referred clients with assigned designers and project stages — use LIVE CLIENT DATA above
- Design Center materials include Leadership Briefing, Discoveries, and Lamont's Agenda
- When asked about a specific client or designer, look up from the client data above
- Example questions to answer directly:
  "Who are Ana Filippone's clients?" → find clients assigned to that designer in client data
  "What stage is Jess Resch?" → find that client and report their status/stage
  "How many design center clients do we have?" → count from client data
  "What's Shannon working on?" → summarize Creative Director's clients and pipeline`
  }

  if (p.startsWith('/president/calendar')) {
    return `
== CURRENT PAGE: PRESIDENT'S CALENDAR ==
The user is viewing Calin's calendar. Focus exclusively on calendar data:
- Lead every answer with specific times (ET) and event titles from CALIN'S CALENDAR above
- Today's schedule is the primary focus; surface it proactively
- Example questions to answer directly:
  "What's on my calendar today?" → list all Today events with exact ET times
  "When is my next meeting?" → first event after current time in Today section
  "What meetings do I have this week?" → list the This Week section
  "Do I have anything this afternoon?" → filter Today events after 12 PM ET
  "Am I free at 2pm?" → check if any event overlaps 2 PM ET today`
  }

  if (p.startsWith('/president/overview') || p === '/president') {
    return `
== CURRENT PAGE: PRESIDENT'S MEETINGS ==
The user is on the President's Meetings overview. Prioritize:
- Full meeting hierarchy: Annual → Quarterly → Monthly → Weekly → Daily (see PRESIDENT'S MEETINGS HIERARCHY above)
- DISC profiles for all department VPs (Jeff Azcona, Lamont Gilyot, Kaitlyn Grunenberg, Matteo Carpani)
- PIT Goals data and tracking (see PIT GOALS SUMMARY above)
- All agendas and recurring meeting structures
- Example questions to answer directly:
  "What's on the quarterly agenda?" → describe quarterly meeting structure from hierarchy
  "What is Jeff's DISC profile?" → provide Jeff Azcona's DISC information
  "How are we tracking on PITs?" → compare submitted vs targets from PIT GOALS SUMMARY
  "What happens at the weekly meeting?" → detail weekly meeting components from hierarchy`
  }

  if (p.startsWith('/sessions')) {
    return `
== CURRENT PAGE: SESSIONS ==
The user is browsing coaching sessions. Focus on session data:
- All session data is in LIVE SESSION & MEETING DATA above (6 sessions, Feb–Apr 2026, with Juliet from ActionCOACH Tampa Bay)
- Surface summaries, key decisions, and action items from specific sessions when asked
- Example questions to answer directly:
  "What were the action items from last week?" → find the most recent session's open action items
  "Summarize the last leadership meeting" → use the most recent meeting entry above
  "What decisions were made in the last coaching session?" → find latest coaching-type meeting
  "What are the recurring themes across sessions?" → analyze summaries across all meetings`
  }

  if (p.startsWith('/actions')) {
    return `
== CURRENT PAGE: ACTION ITEMS ==
The user is on the Action Items page. Focus on action item data:
- Default view shows Calin, Kai, and Rovern's items only; "View All" shows everyone
- Action items come from LIVE SESSION & MEETING DATA above — look in Open/Completed Action Items for each meeting
- Example questions to answer directly:
  "What are my open action items?" → list open items for the logged-in user from the meeting data above
  "What's due this week?" → filter action items with due dates within the next 7 days
  "How many open items do I have?" → count open items assigned to the logged-in user
  "What action items are overdue?" → items with past due dates that are still open`
  }

  // /dashboard or any other page — full context (default behavior)
  return `
== CURRENT PAGE: DASHBOARD ==
The user is on the main dashboard. You have full context on all CASK data — sessions, calendar, clients, action items, PIT goals, templates, and more. Answer any question about any part of CASK Hub.`
}

function buildSystemPrompt(
  userName: string,
  userRole: string,
  meetingsContext: string,
  clientsContext: string,
  calendarContext: string,
  pageContext: string,
) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return `You are CASK Intelligence — the AI assistant embedded in CASK Hub for CASK Construction. Today is ${today}.

== LOGGED-IN USER ==
Name: ${userName || 'a CASK team member'}
Role: ${userRole || 'CASK team member'}

Always address the user by their first name (${userName || 'there'}). If they ask "what is my name", "who am I", or similar personal questions, answer directly — do not say you don't know.

${STATIC_CONTEXT}

== LIVE SESSION & MEETING DATA (from Supabase) ==
${meetingsContext}

== LIVE CLIENT DATA (from Supabase) ==
${clientsContext}

== CALIN'S CALENDAR (Microsoft 365 — Eastern Time) ==
${calendarContext}
${buildPageFocusSection(pageContext)}

== RESPONSE BEHAVIOR ==
- You have full knowledge of everything above — never say you don't have access to this data
- Answer any question about CASK Hub: templates, PIT goals, team members, meetings, clients, president's meetings, department roles, and more
- Answer ANY calendar question directly and confidently using the calendar data above:
  "What's on my calendar today?" → list today's events with times
  "When is my next meeting?" → find the first event after current time today
  "Do I have any meetings this afternoon?" → check today's events after 12 PM ET
  "What time is my meeting with [person]?" → search by organizer or attendee name
  "Am I free at 2pm today?" → check if any event overlaps 2 PM ET
  "What meetings do I have this week?" → list This Week section
  "When is my next quarterly meeting?" → search upcoming for quarterly/quarterly in title
  "How many meetings do I have today?" → count today's events
  "What's my first meeting tomorrow?" → first event in Tomorrow section
  "Do I have anything after 3pm today?" → filter today's events after 3 PM ET
  "When is my next 1:1 with [person]?" → search attendees/organizer across all dates
  "What's the busiest day this week?" → count events per day this week
  "Do I have any Teams meetings today?" → filter today's events where Teams: Yes
  "What meetings can I join from Teams this week?" → filter week events where Teams: Yes
  "How much free time do I have today?" → total duration of today's meetings vs 8-hour day
  "What's on Friday?" → find events on the upcoming Friday date
  "When is the next Department Alignment meeting?" → search upcoming for "alignment" in title
  "Do I have the quarterly meeting this month?" → search next 30 days for quarterly events
- For each calendar event you know: title, start/end time (ET), duration, organizer, attendees, Teams link availability
- Answer personal questions (name, role, action items) directly and confidently
- Reference specific meeting data and dates when relevant
- For action items, clearly distinguish open vs completed
- For client questions, include happiness status and project context
- Address the user by their first name when natural, without casual greetings

## Response formatting
- No markdown headers (## or ###)
- No markdown bold (**text**)
- Use plain text with CAPS for section headers
- Use - for bullet points
- Use plain colons for labels like "Time: 9:00 AM"
- No markdown tables
- No emojis
- No casual greetings
- Keep responses concise

Example of correct format:

TODAY — TUESDAY, JUNE 16

- 9:00 AM — Review Internal Ops Workflow
- 9:30 AM — Joseph Data Planning

HEADS UP
- Conflict at 9:00-9:30 AM`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userName, userRole, pageContext, fileName, fileData, fileType, fileMimeType, userMessage } = await req.json()
    console.log('[chat] POST hit — user:', userName, '| role:', userRole, '| messages:', messages?.length)

    // Initialise client inside handler so env var is always resolved at request time
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[chat] ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }
    const anthropic = new Anthropic({ apiKey })

    const supabase = createClient()

    const now = new Date()
    const ET = 'America/New_York'

    // Compute exact UTC start of today in Eastern Time (handles DST automatically)
    const etNowApprox = new Date(now.toLocaleString('en-US', { timeZone: ET }))
    const etOffsetMs = now.getTime() - etNowApprox.getTime()
    const etTodayStr = now.toLocaleDateString('en-CA', { timeZone: ET })
    const [ey, em, ed] = etTodayStr.split('-').map(Number)
    const etDayStartISO = new Date(Date.UTC(ey, em - 1, ed, 0, 0, 0) + etOffsetMs).toISOString()
    const et30DaysISO = new Date(Date.UTC(ey, em - 1, ed, 0, 0, 0) + etOffsetMs + 30 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: meetings }, { data: clients }, { data: calendarEvents }] = await Promise.all([
      supabase
        .from('meetings')
        .select('title, date, summary, action_items, key_decisions, attendees, meeting_type, module')
        .order('date', { ascending: false })
        .limit(30),
      supabase
        .from('clients')
        .select('name, happiness, project_type, project_value, start_date')
        .order('name'),
      supabase
        .from('calendar_events')
        .select('title, start_time, end_time, organizer, attendees, location, meeting_link, is_all_day')
        .gte('start_time', etDayStartISO)
        .lte('start_time', et30DaysISO)
        .order('start_time', { ascending: true })
        .limit(200),
    ])

    const meetingsContext = meetings?.length
      ? meetings.map(m => {
          const openItems = Array.isArray(m.action_items)
            ? m.action_items.filter((a: { done: boolean }) => !a.done).map((a: { task: string; owner: string }) => `${a.task} (${a.owner})`)
            : []
          const doneItems = Array.isArray(m.action_items)
            ? m.action_items.filter((a: { done: boolean }) => a.done).map((a: { task: string; owner: string }) => `${a.task} (${a.owner})`)
            : []
          return [
            `Meeting: ${m.title}`,
            `Date: ${m.date}`,
            `Type: ${m.meeting_type ?? 'unknown'} | Module: ${m.module ?? 'unknown'}`,
            `Attendees: ${Array.isArray(m.attendees) ? m.attendees.join(', ') : m.attendees ?? 'unknown'}`,
            `Summary: ${Array.isArray(m.summary) ? m.summary.join(' ') : m.summary ?? ''}`,
            `Key Decisions: ${Array.isArray(m.key_decisions) && m.key_decisions.length ? m.key_decisions.join('; ') : 'none'}`,
            openItems.length ? `Open Action Items: ${openItems.join('; ')}` : 'Open Action Items: none',
            doneItems.length ? `Completed Action Items: ${doneItems.join('; ')}` : '',
          ].filter(Boolean).join('\n')
        }).join('\n---\n')
      : 'No meetings recorded yet.'

    const clientsContext = clients?.length
      ? clients.map(c => {
          const happiness = c.happiness === 'red' ? '🔴 At Risk' : c.happiness === 'yellow' ? '🟡 Needs Attention' : '🟢 Healthy'
          return `${c.name} — ${c.project_type ?? 'project'} | ${happiness} | Value: $${c.project_value?.toLocaleString() ?? 'TBD'} | Started: ${c.start_date ?? 'TBD'}`
        }).join('\n')
      : 'No active clients on record.'

    type CalRow = {
      title: string; start_time: string; end_time: string | null
      organizer: string | null; attendees: unknown; location: string | null
      meeting_link: string | null; is_all_day: boolean | null
    }

    const fmtET = (iso: string) =>
      new Date(iso).toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit', hour12: true })

    const fmtETDate = (iso: string, opts: Intl.DateTimeFormatOptions = {}) =>
      new Date(iso).toLocaleDateString('en-US', { timeZone: ET, ...opts })

    const getETDateStr = (iso: string) =>
      new Date(iso).toLocaleDateString('en-CA', { timeZone: ET })

    const durStr = (start: string, end: string | null): string => {
      if (!end) return ''
      const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
      if (mins <= 0) return ''
      if (mins < 60) return `${mins}m`
      const h = Math.floor(mins / 60), m = mins % 60
      return m ? `${h}h ${m}m` : `${h}h`
    }

    const fmtEvent = (e: CalRow): string => {
      const timeRange = e.is_all_day
        ? 'All Day'
        : `${fmtET(e.start_time)}${e.end_time ? ` – ${fmtET(e.end_time)}` : ''}`
      const dur = durStr(e.start_time, e.end_time)
      const names = Array.isArray(e.attendees)
        ? (e.attendees as unknown[]).map(a => typeof a === 'string' ? a : (a as Record<string, string>)?.name ?? '').filter(Boolean).join(', ')
        : ''
      return [
        `  • ${timeRange}${dur ? ` (${dur})` : ''} — ${e.title}`,
        e.organizer ? `Organizer: ${e.organizer}` : '',
        names ? `Attendees: ${names}` : '',
        e.location ? `Location: ${e.location}` : '',
        e.meeting_link ? 'Teams: Yes' : 'Teams: No',
      ].filter(Boolean).join(' | ')
    }

    const rows = (calendarEvents ?? []) as CalRow[]
    const etTodayLabel = fmtETDate(now.toISOString(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const etTomorrowISO = new Date(now.getTime() + 86_400_000).toISOString()
    const etTomorrowStr = getETDateStr(etTomorrowISO)
    const etTomorrowLabel = fmtETDate(etTomorrowISO, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const et7DaysStr = getETDateStr(new Date(now.getTime() + 7 * 86_400_000).toISOString())

    const todayEvts = rows.filter(e => getETDateStr(e.start_time) === etTodayStr)
    const tomorrowEvts = rows.filter(e => getETDateStr(e.start_time) === etTomorrowStr)
    const weekEvts = rows.filter(e => { const d = getETDateStr(e.start_time); return d > etTomorrowStr && d <= et7DaysStr })
    const laterEvts = rows.filter(e => getETDateStr(e.start_time) > et7DaysStr)

    const groupByDay = (evts: CalRow[]): string => {
      const byDay: Record<string, CalRow[]> = {}
      for (const e of evts) {
        const d = getETDateStr(e.start_time)
        ;(byDay[d] ??= []).push(e)
      }
      return Object.entries(byDay).map(([d, es]) => {
        const label = fmtETDate(d + 'T12:00:00Z', { weekday: 'long', month: 'long', day: 'numeric' })
        return `${label}:\n${es.map(fmtEvent).join('\n')}`
      }).join('\n\n')
    }

    const calendarContext = [
      `Today — ${etTodayLabel} (Eastern Time):`,
      todayEvts.length ? todayEvts.map(fmtEvent).join('\n') : '  No meetings today.',
      '',
      `Tomorrow — ${etTomorrowLabel}:`,
      tomorrowEvts.length ? tomorrowEvts.map(fmtEvent).join('\n') : '  No meetings tomorrow.',
      '',
      'This Week (next 7 days):',
      weekEvts.length ? groupByDay(weekEvts) : '  No meetings this week.',
      '',
      'Next 30 Days (upcoming):',
      laterEvts.length ? groupByDay(laterEvts) : '  No meetings in the next 30 days.',
    ].join('\n')

    // Claude requires the conversation to start with a 'user' turn.
    // Strip any leading 'assistant' messages (e.g. the greeting) before sending.
    const rawMessages: { role: string; content: string }[] = (messages ?? []).slice(-12)
    const firstUserIdx = rawMessages.findIndex(m => m.role === 'user')
    const claudeMessages = firstUserIdx > 0
      ? rawMessages.slice(firstUserIdx)
      : rawMessages

    if (!claudeMessages.length) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 })
    }

    // Build processedMessages — inject file content into the last user turn when a file is attached
    type MsgContent = string | { type: 'text'; text: string }[] | { type: string; source?: unknown; text?: string }[]
    type ProcessedMsg = { role: 'user' | 'assistant'; content: MsgContent }

    let processedMessages: ProcessedMsg[]

    if (fileData && fileName && claudeMessages.length > 0) {
      const lastIdx = claudeMessages.length - 1
      const prior = claudeMessages.slice(0, lastIdx) as ProcessedMsg[]
      const cleanText = (userMessage as string | undefined) || 'Please analyze this file.'

      if (fileType === 'pdf') {
        processedMessages = [
          ...prior,
          {
            role: 'user' as const,
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
              { type: 'text', text: cleanText },
            ],
          },
        ]
      } else if (fileType === 'text') {
        processedMessages = [
          ...prior,
          {
            role: 'user' as const,
            content: `[Attached file: ${fileName}]\n\n${fileData}\n\n---\n\n${cleanText}`,
          },
        ]
      } else {
        // binary (docx / xlsx) — base64 encoded; Claude will extract readable content best-effort
        processedMessages = [
          ...prior,
          {
            role: 'user' as const,
            content: `[Attached file: ${fileName} (${fileMimeType as string})]\n\nBase64-encoded binary content below — extract and analyse any readable text:\n\n${fileData}\n\n---\n\n${cleanText}`,
          },
        ]
      }
    } else {
      processedMessages = claudeMessages as ProcessedMsg[]
    }

    console.log('[chat] Calling Claude API with', processedMessages.length, 'messages...', fileData ? `+ file: ${fileName}` : '')
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildSystemPrompt(userName ?? '', userRole ?? '', meetingsContext, clientsContext, calendarContext, pageContext ?? ''),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: processedMessages as any,
      max_tokens: fileData ? 2000 : 600,
    })

    const content = completion.content[0].type === 'text' ? completion.content[0].text : ''
    console.log('[chat] Claude responded, length:', content.length)
    return NextResponse.json({ content })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const status = (error as { status?: number })?.status ?? 500
    console.error('[chat] Claude API error:', status, message)
    return NextResponse.json(
      { error: `Claude API error: ${message}` },
      { status: 500 }
    )
  }
}
