# CASK Hub

**AI-powered leadership intelligence platform for CASK Construction**

Built with Next.js 14, TypeScript, Tailwind CSS, Supabase, and Claude AI.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project API keys
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project API keys (secret)
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### 3. Set up Supabase

1. Go to your Supabase project → SQL Editor
2. Run `supabase-schema.sql` to create all tables
3. Seed data: `POST /api/seed` (run once)

```bash
# After the dev server is running:
curl -X POST http://localhost:3000/api/seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

```bash
# Push to GitHub, then connect repo to Vercel
# Add all environment variables in Vercel project settings
vercel deploy
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # App routes (with sidebar layout)
│   │   ├── dashboard/      # Dashboard page
│   │   ├── sessions/       # Sessions list + detail
│   │   ├── generate/       # Generate Agenda
│   │   └── actions/        # Action Items
│   └── api/
│       ├── chat/           # Claude AI chat endpoint
│       ├── generate-agenda/ # Agenda generation endpoint
│       └── seed/           # Database seed endpoint
├── components/
│   ├── sidebar/            # Left navigation
│   ├── ai-panel/           # Right AI chat panel
│   └── ui/                 # Shared components
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── meetings.ts         # Data access layer
│   └── seed-data.ts        # All real meeting data
└── types/
    └── index.ts            # TypeScript types
```

---

## Phase Roadmap

- **Phase 1** ✅ Core — Next.js app, all pages, Supabase connected, real data
- **Phase 2** — AI Features — Claude API connected, Generate Agenda working, AI chat
- **Phase 3** — Automation — Make.com + Fireflies → Claude → Supabase
- **Phase 4** — Advanced — Calendar, Estimates, KPI Dashboard

---

*Built by Rovern Alimpoos — AI Workflow Specialist, CASK Construction*
*May 2026*
