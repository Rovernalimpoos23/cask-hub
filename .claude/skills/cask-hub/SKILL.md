---
name: cask-hub
description: "Use this skill whenever working on the CASK Hub project — a Next.js 14 AI-powered platform for CASK Construction. Triggers include: any request to add a feature, fix a bug, build a new page, connect Supabase, update the AI panel, modify the sidebar, work on API routes, or anything touching the cask-hub codebase. Also use when the user mentions CASK Hub, ActionCOACH, the dashboard, sessions, action items, generate agenda, or any component of the platform. Do NOT use for unrelated Next.js projects or general React questions."
---

# CASK Hub — Project Skill for Claude Code

## What This Project Is

CASK Hub is an AI-powered leadership intelligence platform for CASK Construction (St. Petersburg, Florida). It tracks ActionCOACH coaching sessions, generates meeting agendas with Claude AI, and manages action items. Built by Rovern Alimpoos (AI Workflow Specialist).

**Company goal:** $20M revenue in 2026.
**Coach:** Juliet from ActionCOACH Tampa Bay.
**Sessions:** 6 recorded sessions, Feb–Apr 2026.

---

## Tech Stack

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Database:   Supabase (PostgreSQL + Realtime)
AI:         Claude API — model: claude-sonnet-4-20250514
Hosting:    Vercel
Auth:       Supabase Auth (Phase 2)
Automation: Make.com + Fireflies AI (Phase 3)
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                  ← All pages inside the 3-column shell
│   │   ├── layout.tsx          ← App shell: Sidebar + Main + AI Panel
│   │   ├── dashboard/page.tsx  ← Dashboard with stats + recent sessions
│   │   ├── sessions/page.tsx   ← Sessions list with filter tabs
│   │   ├── sessions/[id]/page.tsx ← Session detail page
│   │   ├── generate/page.tsx   ← Generate Agenda with Claude AI
│   │   └── actions/page.tsx    ← Action Items CRUD
│   ├── api/
│   │   ├── chat/route.ts       ← Claude AI chat endpoint
│   │   ├── generate-agenda/route.ts ← Agenda generation endpoint
│   │   └── seed/route.ts       ← Seeds Supabase with real data
│   ├── layout.tsx              ← Root layout with fonts
│   ├── page.tsx                ← Redirects to /dashboard
│   └── globals.css             ← CSS variables + global styles
├── components/
│   ├── sidebar/Sidebar.tsx     ← Left nav (dark charcoal)
│   ├── ai-panel/AIPanel.tsx    ← Right Claude chat panel
│   └── ui/index.tsx            ← All shared components
├── lib/
│   ├── supabase.ts             ← Supabase client
│   ├── meetings.ts             ← Data access layer
│   └── seed-data.ts            ← All 6 real meetings + action items
└── types/index.ts              ← TypeScript types
```

---

## Design System

**ALWAYS match this exactly. Never deviate from these values.**

### Colors (CSS variables in globals.css)
```css
--bg: #f9f8f7          /* page background */
--surface: #ffffff      /* card background */
--surface2: #f4f3f1    /* secondary surface */
--border: #e8e5e1      /* default border */
--border2: #d4d0ca     /* hover border */
--text: #1a1917        /* primary text */
--text2: #3a3834       /* secondary text */
--text3: #a8a29e       /* muted text */
--red: #c8311a         /* CASK red / primary action */
--red-soft: #fdf2f0    /* red background tint */
--red-border: #f5c9c2  /* red border */
--charcoal: #1a1917    /* dark elements, buttons */
--sidebar: #1c1c1e     /* sidebar background */
--green: #166534       /* success */
--green-bg: #f0fdf4    /* success background */
--amber: #92400e       /* warning / due dates */
--amber-bg: #fffbeb    /* warning background */
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

### Meeting Type Colors
```
leadership → red     (#c8311a)
planning   → green   (#059669)
coaching   → amber   (#d97706)
education  → purple  (#7c3aed)
```

---

## Key Components — How to Use Them

All shared components are in `src/components/ui/index.tsx`. Import like:
```tsx
import { TopBar, StatCard, MeetingCard, ActionItemRow, SectionLabel, FilterBar, PillGreen, PillRed } from '@/components/ui'
```

### TopBar
```tsx
<TopBar title="Page Name" subtitle="Section Name">
  <PillGreen>Claude AI Active</PillGreen>
  <PillRed>6 Sessions</PillRed>
</TopBar>
```

### StatCard
```tsx
<StatCard value={6} label="Total Sessions" hint="Feb – Apr 2026" variant="default" index={0} />
// variants: "default" | "alert" (red) | "success" (green)
// index 0-3 controls staggered animation delay
```

### MeetingCard
```tsx
<MeetingCard meeting={meeting} />
// meeting must be type Meeting from @/types
// renders date, title, attendees, type tag, hover arrow
// links to /sessions/[id]
```

### ActionItemRow
```tsx
<ActionItemRow item={item} onToggle={(id, done) => handleToggle(id, done)} />
// item must be type ActionItem from @/types
// checkbox toggles done state
// shows owner + due date
```

---

## TypeScript Types

```typescript
// src/types/index.ts

type MeetingType = 'leadership' | 'planning' | 'coaching' | 'education'

interface ActionItem {
  id: string
  meeting_id?: string
  task: string
  owner: string
  due_date: string
  done: boolean
}

interface Meeting {
  id: string
  title: string
  date: string           // 'YYYY-MM-DD'
  time_start: string
  time_end: string
  attendees: string[]
  summary: string[]      // 3 bullet points
  action_items: ActionItem[]
  key_decisions: string[]
  full_transcript: string
  meeting_type: MeetingType
  owner: string
  module: string
}
```

---

## Supabase Schema

```sql
meetings (
  id uuid PK,
  title text,
  date date,
  time_start text,
  time_end text,
  attendees text[],
  summary text[],
  action_items jsonb,
  key_decisions text[],
  full_transcript text,
  meeting_type text,
  owner text,
  module text,
  created_at timestamptz
)

action_items (
  id uuid PK,
  meeting_id uuid FK → meetings(id),
  task text,
  owner text,
  due_date date,
  done boolean,
  created_at timestamptz
)
```

### Data Access Pattern
```typescript
// Always try Supabase first, fall back to seed data
import { supabase } from '@/lib/supabase'
import { MEETINGS } from '@/lib/seed-data'

const { data, error } = await supabase.from('meetings').select('*')
if (error || !data?.length) return MEETINGS // fallback
```

---

## Claude API Pattern

```typescript
// All AI calls go through /api/chat or /api/generate-agenda
// Never call the Anthropic API directly from client components
// Always use server-side API routes

const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
})
const data = await res.json()
// data.content = Claude's response text
```

### Claude System Context (always include in prompts)
```
You are CASK Hub AI for CASK Construction's ActionCOACH program.
Company goal: $20M revenue in 2026.
Coach: Juliet (ActionCOACH Tampa Bay).
6 sessions recorded: Feb–Apr 2026.
Key people: Calin (President), Chad (VP Ops), Lamont (VP Finance),
Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Kai (EA), Rovern (AI Specialist).
```

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase project settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase API keys
SUPABASE_SERVICE_ROLE_KEY=       # secret — server only
ANTHROPIC_API_KEY=               # from console.anthropic.com
```

---

## Key Business Data

### People
| Name | Role | Notes |
|------|------|-------|
| Calin Noonan | President + Co-Founder | Doesn't attend 4th Wed Ops session |
| Chad Holman | VP Operations + Co-Founder | Co-leads all sessions |
| Lamont Gilyot | VP Finance | |
| Jeff Azcona | VP Sales & Marketing | |
| Kaitlyn Grunenberg | VP Human Resources | |
| Matteo Carpani | Operations Manager | |
| Kai Mapoy | Executive Assistant | Manages Calin's workflow |
| Rovern Alimpoos | AI Workflow Specialist | Builds CASK Hub |
| Juliet | ActionCOACH Facilitator | Tampa Bay |

### Coaching Schedule
```
2nd Wed 1:30–2:30pm  Owner/Working On Business (Calin, Chad, Juliet)
2nd Wed 3–4pm        Owner/Big Vision (Calin, Chad, Scott)
3rd Wed 3–4pm        Leadership Conference
3rd Wed 2–3pm        Personal/Leadership Dev Coaching
4th Wed 3–4pm        CASK Ops (Chad, Matteo, Scott — Calin NOT here)
```

### Upcoming Meeting
```
May 28, 2026 — CASK Leadership Meeting
Time: 11:00 AM – 3:00 PM
Attendees: Calin, Chad, Lamont, Jeff, Matteo, Kait, Juliet
```

---

## Phase Roadmap

```
Phase 1 ✅  Core — all pages, seed data, Supabase schema
Phase 2     AI Features — Claude chat live, agenda generation, action items CRUD in Supabase
Phase 3     Automation — Make.com + Fireflies → Claude → Supabase pipeline
Phase 4     Advanced — Calendar sync, Estimates module, KPI Dashboard
```

---

## Code Style Rules

1. Always use TypeScript — no `any` types
2. Use Tailwind for layout/spacing, CSS variables for colors
3. Client components get `'use client'` at the top
4. Server components fetch data directly (no useEffect)
5. All Claude API calls go through `/api/` routes, never from client
6. Seed data fallback pattern for all Supabase queries
7. Keep components in `src/components/`, pages in `src/app/(app)/`
8. Import shared components from `@/components/ui`
9. Match the HTML prototype design exactly — don't redesign

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
