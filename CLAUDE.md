# CASK Hub — Project Context for Claude Code

This file is read automatically at the start of every Claude Code session in this repo.
It exists so sessions don't start cold — read it fully before making any changes.

## What this is

CASK Hub is an internal AI-powered operating system for CASK Construction (custom home
builder, St. Petersburg, Florida), built and maintained solo by Rovern Alimpoos.

- Live: cask-hub.vercel.app
- GitHub: github.com/Rovernalimpoos23/cask-hub
- Stack: Next.js 14 (App Router), TypeScript, Tailwind, Supabase (Postgres), Vercel,
  Claude API, Voyage AI (`voyage-3` embeddings for the hub_memory RAG), Microsoft Graph
  API (Outlook calendar + email), Fireflies.ai (meeting transcription webhook),
  Twilio (SMS morning briefing + meeting reminders, cron-driven via `vercel.json`)
- **Model usage is mixed, not uniform.** `claude-opus-5` runs in 5 call sites
  (Fireflies webhook ×3, `/api/extract-meeting`, `/api/big-vision/chat`).
  `claude-sonnet-4-6` runs in 6 (`/api/chat`, `/api/chat/client`,
  `/api/big-vision-chat`, `/api/big-vision-upload-chat`, `/api/generate-agenda`,
  `/api/generate-event-agenda`). Check which model a route actually uses before
  assuming — it changes the response-parsing rules (see gotchas).

## How to work in this repo — standing rules

1. **Always include explicit SAFETY RULES at the top of any task**: list exactly which
   files are in scope and which are off-limits. End every task with "if unsure, leave a
   comment and do not modify." Do not touch files outside the stated scope even if a fix
   seems related.
2. **Minimal, surgical changes only.** Fix at the boundary/root cause, not by patching
   every downstream symptom. If a schema-level fix would be cleaner but touches many
   files, flag it as a separate, deliberately-scoped follow-up rather than doing it
   inline.
3. **Typecheck after every change**: `npx tsc --noEmit`
   Note: this rewrites `tsconfig.tsbuildinfo`. On a strictly read-only/audit task, skip
   it and say you skipped it rather than dirtying the tree.
4. **Confirm scope after every change**: `git status --porcelain` — should only show the
   files you intended to touch.
5. **Test on Vercel, not localhost** — environment variables are not available locally.
   (`.claude/skills/cask-hub/SKILL.md` still says the opposite; this file wins.)
6. **Read-only / audit tasks must stay read-only.** No ALTER TABLE, no schema changes, no
   writes, unless explicitly asked. If credentials or access don't allow a requested check
   (e.g. no direct Postgres/catalog access), say so and propose the SQL for the user to
   run themselves rather than guessing.
7. **Flag deviations and judgment calls explicitly** rather than silently improvising.
   This has caught real bugs before shipping in the past (sort-then-skip logic flaws,
   ID/reference inconsistencies, placeholder-leak bugs, RPC return-type mismatches,
   content-array extraction bugs after model upgrades).
8. If a write-probe or test could actually mutate real data and there's no safe rollback
   mechanism confirmed (e.g. `Prefer: tx=rollback` not honored), do NOT run it — stop and
   report the limitation instead of risking production data.
9. **Don't trust inline comments about security posture — verify the client.** At least
   one comment in this repo asserts a service-role client where the code actually
   constructs an anon-key one (see the Fireflies gotcha). Trace `createClient` to its
   import before believing any claim about RLS bypass.

## Recurring gotchas — know these before touching auth or data

- **`auth.users` IDs ≠ `public.users` IDs.** Always match users by email with
  `.maybeSingle()`, never by ID across these two tables. (`/api/auth/microsoft/callback`
  is the reference implementation — `.ilike('email', …)` with `%`/`_` escaped, then
  `.maybeSingle()`.)
- **Supabase RLS is currently weak in most tables** (open `USING(true)` policies from the
  MVP sprint) — a security hardening pass is in progress. Do not assume RLS is protecting
  anything unless a table has been explicitly confirmed hardened (see Known Issues below).
  The anon key is public by design (ships in the browser bundle) — never treat "requires
  the anon key" as a real access control.
- **`users.role` is the sole authorization primitive for the whole app** — `middleware.ts`,
  `role-filter.ts`, `Sidebar.tsx`, `AIPanel.tsx`, 5 pages, and **23 API routes** all key
  off this column (31 files total). Any change touching the `users` table or role logic
  needs extra caution and should default to service-role-only writes.
  Role vocabulary: `RESTRICTED_ROLES` = `vp_sales`, `ops_manager`, `vp_ops`, `vp_finance`,
  `vp_hr`, `member`; `ADMIN_ROLES` = `president`, `ea`, `ai_specialist`. `ea` (Kai) is
  deliberately NOT restricted. Both lists are duplicated in `middleware.ts` and
  `role-filter.ts` — keep them in sync.
- **Opus 5 (and later models) return thinking blocks first in the response `content`
  array by default.** Never assume `content[0].text` — always extract with
  `content.find(b => b.type === 'text')?.text`. This broke 5 routes silently in the past
  (HTTP 200, empty/fallback output, no visible error).
  **Six routes still use the unsafe `content[0]` pattern** — safe only because they're
  on `claude-sonnet-4-6`. They break the moment any of them is bumped to Opus 5:
  `api/chat/route.ts:779`, `api/chat/client/route.ts:45`,
  `api/big-vision-chat/route.ts:60`, `api/big-vision-upload-chat/route.ts:99`,
  `api/generate-agenda/route.ts:72`, `api/generate-event-agenda/route.ts:33`.
  Migrating a route's model and migrating its extraction are one change, never two.
  (Was seven — `api/webhooks/fireflies/test/route.ts` came off the list when that route
  was deleted on 2026-08-07.)
- **Model-generated JSON fields should never be trusted as strictly typed.** Prefer
  `typeof x === 'string' ? x : fallback` over `x ?? fallback` — a bad model response could
  return a non-null, non-string value that `??` won't catch. Note `src/types/index.ts`
  declares `ActionItem.owner: string` (non-nullable), so TypeScript will *not* warn you
  about the null owners that actually land in `meetings.action_items` JSONB. The types
  are aspirational here; the fetch-boundary normalization is what makes them true.
- **The Fireflies webhook (`/api/webhooks/fireflies`) is public and unauthenticated**, and
  **still writes via the anon-key client** — `route.ts:305` calls `createClient()` from
  `@/lib/supabase-server`, which builds a cookie-based **anon-key** client
  (`supabase-server.ts:10`). The comment on `route.ts:304` claiming "using service role key
  (bypasses RLS)" is **wrong** — do not rely on it. With no session cookie on a webhook
  POST, every write runs as `anon`. Do not tighten RLS on `meetings`, `clients`,
  `client_meetings`, `client_email_drafts`, or `hub_memory` without first migrating this
  webhook to a real service-role client — tightening RLS first will silently break meeting
  ingestion (the whole handler swallows errors and always returns 200).
- **`lib/meetings.ts` / `meetings-client.ts` silently fall back to hardcoded seed data.**
  `getMeetings()` returns the 18KB `MEETINGS` array from `lib/seed-data.ts` on *any*
  Supabase error **or** an empty result — no error surfaced. Dashboard, All Sessions,
  Session Detail, Daily Meetings, and `ModuleMeetingsList` all read through it, so a
  broken query or an RLS lockout looks exactly like working data. When debugging "wrong
  meetings showing", rule this out first.
- **`hub_memory` has three independent writers with duplicated chunking logic** — the
  Fireflies webhook, `/api/big-vision/migrate`, and `/api/big-vision/upload`. `CHUNK_SIZE`
  and `chunkText()` are copy-pasted, not imported (there is no shared module today). Change
  one and you must change all three, or chunk boundaries drift between ingestion paths.
- **`supabase-schema.sql` in this repo is badly stale** — it documents exactly **3** tables
  (`meetings`, `action_items`, `users`), all with `USING(true)` "Allow all" policies, from
  the May 2026 MVP. The application code alone references **32** distinct tables and the
  live database has more. Do not treat this file as authoritative for schema. Confirm live
  schema via Supabase directly when it matters.

## Key files / structure

**Pages — General Meetings & Dashboard**
- `src/app/(app)/layout.tsx` — 3-column app shell (sidebar | main | AI panel)
- `src/app/(app)/dashboard/page.tsx` — main dashboard
- `src/app/(app)/sessions/` — meeting sessions (All Sessions, Session Detail, New)
- `src/app/(app)/actions/page.tsx` — Action Items (has its own independent
  `meetings.action_items` fetch — separate from dashboard's fetch, learned the hard way)
- `src/app/(app)/generate/page.tsx` — Generate Agenda
- `src/app/(app)/daily-meetings/page.tsx` — Daily Meetings Recap

**Pages — Customers, Command Center, Design Center**
- `src/app/(app)/customers/` — Active Clients, Client Detail (`[id]` + per-meeting views),
  New Client Setup, OKR Dashboard, Templates. Shared agenda/email template data lives in
  `customers/_agendaData.ts` — **also imported by the Fireflies webhook** for email-draft
  generation, so edits there change webhook output. Note `/customers/templates` still
  exists but is no longer linked from the sidebar.
- `src/app/(app)/command-center/` — department dashboards (executive, finance, hr,
  operations, sales + sales KPI dashboard), incl. Precon Pipeline (Operations) —
  **currently static/sample data, NOT yet connected to the real Excel/SharePoint tracker**
  (data is hardcoded `P_RAW`/`COMP_RAW`; no Supabase or fetch call on the page), badge
  language should reflect this honestly
- `src/app/(app)/design-center/page.tsx`
- `src/app/(app)/my-project/page.tsx` — customer portal preview, allowed for ALL roles

**Pages — Big Vision (two distinct surfaces — don't confuse them)**
- `src/app/(app)/big-vision/` + `[agent]/` — Big Vision AI agents (flagship feature) +
  `hub_memory` RAG system (Voyage embeddings). Sidebar: "Big Vision" under CASK Operating
  System. CSS is scoped under `.bv-root` because the mockup's variable names collide with
  `globals.css`; pulls IBM Plex Mono + Tabler icons from CDN.
- `src/app/(app)/presidents-workflow/big-vision/` — a **separate, much larger** static
  vision-document tree (~19 pages: manifesto, 1yr/3yr/5yr, pit, roadmap, charters,
  meeting-cadence, documents, design-center, the-big-vision, department-alignment with
  finance/hr/operations/sales-marketing sub-pages) plus `_components/`
  (`FloatingVisionAI`, `VisionContent`, `VisionSubPageShell`). Sidebar: "CASK Big Vision"
  under President's Workflow.
- `src/app/(app)/president/` — President's Meeting Agendas (`overview`), `calendar`,
  `inbox`, `daily`, `coaching`, `alignment`, `pit-goals` + its own `layout.tsx`
- `src/app/(app)/my-workspace/{calendar,email}/` — My Calendar + My Emails; explicitly
  allowlisted for restricted roles in middleware

**Auth, roles, shared lib**
- `src/middleware.ts` — route gating for restricted roles. Allowlist for restricted roles:
  `/dashboard`, `/sessions/*`, `/generate/*`, `/actions/*`, `/customers/*`, `/my-project/*`,
  `/my-workspace/*`. Everything else redirects to `/dashboard`. **API routes, webhooks,
  and auth pages are all exempt from gating.** (The `isSeedRoute` exemption was removed
  on 2026-08-07 along with `/api/seed` itself.)
- `src/lib/role-filter.ts` — role-based meeting filtering by attendee first-name match
  (client-side; do not assume this is a real security boundary)
- `src/lib/supabase.ts` (browser, anon) / `src/lib/supabase-server.ts` (server cookie
  client, **anon key — not service-role, despite what some call sites claim**)
- `src/lib/meetings.ts`, `src/lib/meetings-client.ts` — meeting fetches with silent
  seed-data fallback (see gotcha)
- `src/lib/seed-data.ts` — 18KB hardcoded `MEETINGS`. Since `/api/seed` was deleted its
  only importers are `meetings.ts` / `meetings-client.ts`, i.e. the silent fallback
- `src/lib/workflow-steps.ts` — customer-journey step definitions (used by customer detail,
  OKR dashboard, dashboard, my-project)
- `src/lib/theme-context.tsx` — light/dark theme provider (6 importers)
- `src/types/index.ts` — `Meeting`, `ActionItem`, `User`, `Priority`, `AIMessage`
- `src/db/migrations/` — `department_files.sql`, `sales_kpi_data.sql`, `sales_kpi_seed.sql`
  (hand-run migrations; not a migration framework)

**Components**
- `src/components/sidebar/Sidebar.tsx` — `NAV_SECTIONS` is the nav source of truth
- `src/components/ai-panel/AIPanel.tsx` + `artifacts.tsx` — right-hand AI panel
- `src/components/ui/`, `add-meeting-modal/`, `module-page/`, `new-button/`,
  `theme-toggle.tsx`

**API routes**
- `src/app/api/auth/microsoft/` — OAuth flow for per-user Microsoft Graph tokens, stored
  in `user_integrations` (unique on `user_id, provider`, upsert-based reconnect flow).
  CSRF `state` in an httpOnly cookie, validated in the callback; callback uses service-role
  because the email-based user lookup isn't tied to the caller's session.
- `src/app/api/email/**` (12 routes: inbox, president-inbox, compose, ai, attachments,
  download-attachment, and `[id]/{route,read,reply,forward,flag,archive}`) +
  `src/app/api/email-drafts/send/` — all service-role, all role-gated on `users.role`
- `src/app/api/calendar/{my-events,president-events,add-event}/`
- `src/app/api/big-vision/{chat,upload,files,delete,history,stats,migrate}/` — the
  `hub_memory` RAG surface. Legacy siblings `api/big-vision-chat/` and
  `api/big-vision-upload-chat/` still exist and are still on `claude-sonnet-4-6`.
- `src/app/api/{chat,chat/client,generate-agenda,generate-event-agenda,extract-meeting,
  generate-occurrences,fix-dates,speak}/`
- `src/app/api/sms/{morning-briefing,meeting-reminder}/` — Twilio; gated on
  `Bearer ${CRON_SECRET}` **only when `NODE_ENV === 'production'`**. `vercel.json`
  crons `morning-briefing` at 11:30 UTC daily.
- `src/app/api/webhooks/fireflies/route.ts` — public, unauthenticated, anon-key writes
  (see gotcha above)
- **DELETED 2026-08-07 — do not recreate:** `src/app/api/seed/route.ts` and
  `src/app/api/webhooks/fireflies/test/route.ts`. Both were public, unauthenticated,
  middleware-exempt and wrote with the service-role key (`meetings` and `client_meetings`
  respectively); the test route also forwarded arbitrary unauthenticated request bodies
  straight to the Anthropic API, so it was a metered-spend vector as well as a data one.
  Neither had a caller anywhere in application code. Both were briefly secured with an
  admin-session gate, then deleted outright instead — dead surface area beats guarded
  dead surface area. The `isSeedRoute` reference in `middleware.ts` went with them.

**Repo-level**
- `.claude/skills/cask-hub/SKILL.md` — older project skill. **Partly stale**: names
  `claude-opus-4-8`, lists a `user_analytics` table, and says "test on localhost before
  pushing" (contradicts rule 5). Useful for the design system / department colors /
  sidebar conventions; do not trust its model IDs, table list, or workflow rules.
- `.claude/skills/cask-agenda/SKILL.md` — agenda formatting skill
- `supabase-schema.sql` — 3-table MVP relic (see gotcha)
- Cruft, safe to ignore, do not "fix" as a side effect of unrelated work: empty
  brace-expansion artifact directories from a Windows `mkdir` (`src/app/{dashboard,...}`,
  `src/app/api/{chat,generate-agenda,seed}`, `src/components/{sidebar,ai-panel,ui}`), an
  empty `scripts/`, and an empty nested `cask-hub/` at the repo root.

## Known open issues (as of last update)

- **RLS security hardening in progress.** Full audit previously completed: 16+ tables
  anon-readable including `users` (role column). *That audit's findings are DB-side and
  cannot be re-verified from the repo — treat the counts as last-known, not current.*
  Code-side status of the fix order:
  1. Confirm whether the legacy `USING(true)` policy on `users` still permits UPDATE —
     **ANSWERED 2026-08-06: yes.** A direct query returned a single policy on `users`:
     "Allow all", `roles={public}`, `cmd=ALL`, `qual=true`, `with_check=true` — i.e. the
     anon key alone could read *and* write any row, `role` column included. Resolved by
     step 2.
  2. Lock `users` writes to service-role + fix/remove `/api/seed` — **DONE 2026-08-07.**
     "Allow all" was dropped and replaced with `users_select_own` (SELECT, `TO
     authenticated`, `lower(email) = lower(auth.jwt() ->> 'email')`). No INSERT/UPDATE/
     DELETE policy exists, so writes are service-role-only; table GRANTs for those three
     commands were also revoked from `anon`/`authenticated` as defence in depth.
     *DB-side — cannot be re-verified from the repo; treat as last-known.*
     Code-side facts established before the change, which are re-verifiable: all `users`
     call sites are `.select()` — **nothing in the app writes to `users` at all** — and
     each of the 9 anon-key readers fetches only its own row through a session-carrying
     client (`lib/supabase.ts` → `createBrowserClient`, `middleware.ts:8` →
     `createServerClient`, both cookie-backed), so the JWT-email policy matches them.
     No admin read-all policy was added — nothing needs one yet, and the naive version
     self-recurses (`42P17`) unless routed through a `SECURITY DEFINER` helper.
     `/api/seed` was deleted rather than secured.
  3. Migrate the Fireflies webhook to service-role + add signature verification —
     **not done.** It still builds an anon-key client (and carries a comment falsely
     claiming otherwise). No signature check exists. The `/api/webhooks/fireflies/test`
     half of this step is closed — that route was deleted on 2026-08-07; only the main
     `route.ts` remains, and it is still the blocker for step 4.
  4. Tighten RLS on `meetings`/`clients`/`client_meetings`/`client_email_drafts`/
     `hub_memory` as one coordinated change (not before step 3).
  5. Add RLS enforcement for `chat_history`, and regenerate `supabase-schema.sql` from the
     live DB. **Correction to the earlier note:** per-user scoping already exists at the
     *query* level in all 23 files that touch `chat_history` (every read, insert, and
     delete filters `.eq('user_email', …)` + `.eq('page_context', …)`). The remaining gap
     is that nothing *enforces* it — the queries run under the public anon key, so any
     authenticated user could read another user's rows by changing the filter. This is an
     RLS task, not a query-rewrite task.
- **Precon Pipeline badge is misleading** — `command-center/operations/precon/page.tsx:1055`
  renders a literal `Synced from Excel · Jul 24, 8:04 AM` next to a live-status dot, but
  the page makes no Supabase or `fetch` call at all; every row comes from the hardcoded
  `P_RAW` (line 102) and `COMP_RAW` (line 253) arrays. Needs to honestly say
  "preview/sample data" until the real tracker connection ships.
- **Action Items `owner` field can be `null`** (Opus 5 migration made this nullable to
  follow the "don't invent data" extraction rule). **The fetch-boundary normalization is
  in place** — `actions/page.tsx:584` and `dashboard/page.tsx:1309` both apply
  `typeof a.owner === 'string' ? a.owner : ''`, and `actions/page.tsx:31` defines the
  shared `ownerMatches()` helper used by the toggle and priority handlers;
  `api/chat/route.ts:478` has its own equivalent guard. If you add a new place that reads
  `meetings.action_items` directly, apply the same normalization at the fetch boundary and
  use `ownerMatches()` for any toggle/update logic that matches raw JSONB against
  normalized state. Remember `src/types/index.ts` types `owner` as non-nullable `string`,
  so the compiler will not catch a missed boundary.
- **Model usage is split between `claude-opus-5` and `claude-sonnet-4-6`** across 11 call
  sites, with 6 of them still on the unsafe `content[0]` extraction pattern. Not a bug
  today, but it is a loaded gun for the next model bump — see the gotcha for the full list.

## Who's who (for context in prompts/data, not for access decisions)

Calin Noonan (President, admin), Kai Mapoy (EA, admin, PH-based), Rovern Alimpoos
(AI-Native Developer, admin, this repo's builder), Joseph Estelloso (Data Analyst,
peer to Rovern, different responsibilities — Rovern builds the platform, Joseph
analyzes data inside it), Kaitlyn Grunenberg (VP HR), Jeff Azcona (VP Sales), Matteo
Carpani (Ops Manager), Chad Holman (VP Ops), Lamont Gilyot (VP Finance).

Note: the Fireflies webhook hardcodes attendee-email → tag mappings for Jeff, Lamont,
Chad, Matteo, and Kaitlyn, and deliberately skips Calin, Kai, and Rovern (they attend
everything, so their presence shouldn't tag a meeting). Personnel changes require editing
`ATTENDEE_TAG_MAP` / `SKIP_ATTENDEES` in `api/webhooks/fireflies/route.ts` and the
first-name equivalents in `api/big-vision/migrate/route.ts`.
