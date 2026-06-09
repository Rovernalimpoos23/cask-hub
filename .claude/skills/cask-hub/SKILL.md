---
name: cask-hub
description: "Use this skill whenever working on the CASK Hub project — a Next.js 14 AI-powered platform for CASK Construction. Triggers include: any request to add a feature, fix a bug, build a new page, connect Supabase, update the AI panel, modify the sidebar, work on API routes, or anything touching the cask-hub codebase. Also use when the user mentions CASK Hub, ActionCOACH, the dashboard, sessions, action items, generate agenda, or any component of the platform. Do NOT use for unrelated Next.js projects or general React questions."
---

# CASK Hub — Project Skill for Claude Code
## Updated: June 2026

## What This Project Is

CASK Hub is an AI-powered business intelligence platform for CASK Construction (St. Petersburg, Florida).
Built by Rovern Alimpoos (AI Workflow Specialist).
Company goal: $20M revenue in 2026.
Live URL: cask-hub.vercel.app
GitHub: github.com/Rovernalimpoos23/cask-hub

---

## Tech Stack

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Database:   Supabase (PostgreSQL)
AI Models:  claude-sonnet-4-6 (meeting recaps, general AI)
            claude-opus-4-8 (email drafts, profile updates)
Hosting:    Vercel (auto-deploys from GitHub)
Auth:       Supabase Auth
Automation: Make.com + Fireflies AI
SMS:        Twilio (infrastructure built, pending credentials)
Email:      Microsoft 365 via Make.com webhook
```

---

## People

| Name | Role | Email |
|------|------|-------|
| Calin Noonan | President | c.noonan@caskconstruction.com |
| Kai Mapoy | Executive Assistant | k.mapoy@caskconstruction.com |
| Chad Holman | VP Operations | — |
| Lamont Gilyot | VP Finance | — |
| Jeff Azcona | VP Sales | — |
| Kaitlyn Grunenberg | VP HR | — |
| Matteo Carpani | Operations Manager | — |
| Joseph Estelloso | Data Analyst | — |
| Rovern Alimpoos | AI Workflow Specialist | r.alimpoos@caskconstruction.com |
| Jeff Reinertsen | IT | help@AmericanTechSystems.com |

---

## Current Sidebar Structure

```
CASK OPERATING SYSTEM
  Command Center             → /command-center

GENERAL MEETINGS
  All Sessions               → /sessions
  Generate Agenda            → /generate
  Action Items               → /actions

PRESIDENT'S WORKFLOW
  President's Meeting Agendas → /president/overview
  President's Calendar       → /president/calendar
  Daily Meetings             → /daily-meetings

CUSTOMER JOURNEY
  Active Clients             → /customers
  Client Templates           → /customers/templates
  New Client Setup           → /customers/new

DESIGN CENTER
  Design Center              → /design-center

MEETING INTELLIGENCE (SOON)
  AI Notetaker
  Transcripts
```

---

## Supabase Tables

```
meetings            — all recorded sessions
action_items        — separate table (migrated from JSON)
calendar_events     — Calin's Microsoft calendar
clients             — active construction clients
client_meetings     — per-client meeting journey progress
client_email_drafts — auto-generated emails pending send
chat_history        — persistent AI chat per page per user
user_analytics      — page view tracking (Rovern only)
client_priorities   — client key priorities
```

---

## AI Channels (Right Panel)

| Context | Focus |
|---------|-------|
| Dashboard AI | General AI |
| Command Center AI | Departments & reports |
| Sales AI | Pipeline & revenue |
| Operations AI | Projects & WIP |
| Finance AI | Cash flow & P&L |
| HR AI | Team & compliance |
| Executive AI | Company overview |
| Calendar AI | Schedule & meetings |
| Daily Meetings AI | Team meeting summaries |
| Design Center AI | DC files & clients |
| Action Items AI | Tasks & owners |
| Customer Journey AI | Templates & phases |
| President AI | Meetings & agendas |

---

## Key Features Built

- Fireflies webhook → Claude AI → meeting recap auto-save
- Meeting title format: `"PR1m Meeting Title: Client Name"` — matches client + phase → saves to `client_meetings`
- Living Client Profile — Claude auto-updates after every meeting
- Email draft auto-generation using `claude-opus-4-8`
- Email send via Make.com → Microsoft 365 Outlook
- Per-client AI chat with full context
- Persistent chat history per page per user
- Morning Briefing dashboard with real-time ET clock
- Microsoft 365 calendar sync via Make.com (every 15 mins)
- CASK Operating System — 5 department framework pages
- Command Center with Sales, Operations, Finance, HR, Executive

---

## Design System

**ALWAYS match this exactly. Never deviate from these values.**

### Colors (CSS variables in globals.css)
```css
--bg: #f9f8f7
--surface: #ffffff
--surface2: #f4f3f1
--border: #e8e5e1
--border2: #d4d0ca
--text: #1a1917
--text2: #3a3834
--text3: #a8a29e
--red: #c8311a
--red-soft: #fdf2f0
--red-border: #f5c9c2
--charcoal: #1a1917
--sidebar: #1c1c1e
--green: #166534
--green-bg: #f0fdf4
--amber: #92400e
--amber-bg: #fffbeb
```

### Fonts
```
Instrument Serif  → headings (font-serif class)
Geist             → body/UI (font-sans class, default)
Geist Mono        → code/transcripts (font-mono class)
```

### Layout
```
3-column grid: 232px sidebar | 1fr main | 300px AI panel
All inside: .app-shell { display: grid; grid-template-columns: 232px 1fr 300px; height: 100vh; }
```

---

## Department Colors (Command Center)

```
Sales & Marketing:        #3B82F6  (blue)
Operations:               #F59E0B  (orange)
Finance:                  #10B981  (green)
Human Resources:          #8B5CF6  (purple)
Executive Command Center: #F59E0B  (gold)
```

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY           # Calin's key
FIREFLIES_API_KEY           # Calin's key
MAKE_EMAIL_WEBHOOK_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=+19285887853
CRON_SECRET
```

---

## Claude Code Rules

1. Always use TypeScript — no `any` types
2. Use Tailwind for layout/spacing, CSS variables for colors
3. Client components get `'use client'` at the top
4. All Claude API calls go through `/api/` routes, never from client
5. Match the existing design system exactly — do not redesign
6. DO NOT touch unrelated files
7. Always test on localhost before pushing
8. Use `claude-sonnet-4-6` for simple tasks, `claude-opus-4-8` for complex
9. Push to GitHub after confirming localhost works
10. Windows/PowerShell environment

---

## Common Tasks

### Add a new page
1. Create `src/app/(app)/[pagename]/page.tsx`
2. Add `'use client'` if it needs interactivity
3. Start with `<TopBar title="..." subtitle="..." />`
4. Add the route to `src/components/sidebar/Sidebar.tsx` NAV_SECTIONS

### Add a new API route
1. Create `src/app/api/[routename]/route.ts`
2. Export `async function POST(req: NextRequest)`
3. Use `process.env.ANTHROPIC_API_KEY` for Claude calls
4. Always wrap in try/catch with meaningful error messages

### Add a new Supabase query
1. Add the function to `src/lib/meetings.ts`
2. Try Supabase first, fall back to `MEETINGS` seed data
3. Type the return value with types from `@/types`

### Supabase data access pattern
```typescript
import { supabase } from '@/lib/supabase'
import { MEETINGS } from '@/lib/seed-data'

const { data, error } = await supabase.from('meetings').select('*')
if (error || !data?.length) return MEETINGS // fallback
```

### Claude API pattern
```typescript
// All AI calls go through /api/chat or /api/generate-agenda
// Never call the Anthropic API directly from client components
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
})
const data = await res.json()
// data.content = Claude's response text
```
