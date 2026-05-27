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

function buildSystemPrompt(
  userName: string,
  userRole: string,
  meetingsContext: string,
  clientsContext: string,
  calendarContext: string,
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
- Be conversational, warm, and address the user by first name naturally
- Keep responses concise — 2–4 sentences unless a list or detailed answer is clearly needed
- Use bullet points for lists of 3 or more items`
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userName, userRole } = await req.json()
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

    console.log('[chat] Calling Claude API with', claudeMessages.length, 'messages...')
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildSystemPrompt(userName ?? '', userRole ?? '', meetingsContext, clientsContext, calendarContext),
      messages: claudeMessages as { role: 'user' | 'assistant'; content: string }[],
      max_tokens: 600,
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
