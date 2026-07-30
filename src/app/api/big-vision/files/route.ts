// src/app/api/big-vision/files/route.ts
//
// Lists hub_memory rows for a specific Big Vision agent (by category). Admin-only
// (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/big-vision/upload/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup and hub_memory query use the SERVICE-ROLE client so they
//    bypass RLS.
//
// This is a list view: the large `content` column is intentionally NOT selected.
//
// It returns DOCUMENTS, not rows. hub_memory rows are CHUNKS — a long document is
// stored as several rows sharing one source_ref (see api/big-vision/upload and the
// fireflies webhook) — so this route groups the rows it reads back into documents,
// using the same `source_ref ?? id` key api/big-vision/chat groups on.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// No sensitive values are logged (status codes only).
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Roles permitted to read hub memory — same admin set the upload route enforces.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Agent slug → hub_category value. Only these slugs are valid.
const AGENT_CATEGORY: Record<string, string> = {
  pit: 'pit',
  'ai-hub': 'ai_hub',
  'design-center': 'design_center',
  'dept-alignment': 'alignment',
  jeff: 'jeff',
  lamont: 'lamont',
  chad: 'chad',
  matteo: 'matteo',
  kaitlyn: 'kaitlyn',
  'big-vision': 'big_vision',
  strategy: 'strategy',
}

// `limit` is a DOCUMENT limit, applied after grouping.
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

// Row-fetch budget. Grouping is only correct if every chunk of a reported document is
// read, so the fetch has to over-read relative to the document limit — a long fireflies
// transcript runs to ~20 chunk rows. Paged because Supabase caps a single response at
// the project's max-rows setting (1000 by default), which would otherwise truncate a
// category mid-document with no error. MAX_FETCH_ROWS is the backstop so one huge
// category can't pull an unbounded payload; hitting it is logged, never silent.
// `content` is not selected, so these rows are small.
const PAGE_SIZE = 1000
const MAX_FETCH_ROWS = 3000

// Max meeting ids per `.in()` when resolving fireflies meeting dates — keeps the request
// URL well inside limits now that the document count is no longer bounded by `limit`.
const MEETING_ID_BATCH = 200

// The suffix all three hub_memory writers add to chunk titles. Same pattern
// api/big-vision/chat strips when it reports document titles.
const CHUNK_SUFFIX_RE = /\s*\(part \d+ of \d+\)$/i

// Shape of the rows this route reads. No generated Supabase types in this project, so
// the query result is cast to this — the same approach api/big-vision/chat uses.
interface MemoryRow {
  id: string
  title: string | null
  source_type: string | null
  layer: number | null
  categories: string[] | null
  leader: string | null
  file_path: string | null
  // Chunking: rows of one document share a source_ref. It is null on legacy manual
  // uploads and on fireflies rows whose meetings insert returned no id.
  source_ref: string | null
  chunk_index: number | null
  chunk_total: number | null
  created_at: string
}

export async function GET(req: Request) {
  try {
    console.log('[files] step: starting')
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    console.log('[files] step: auth passed')

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      // Missing env vars are the most common Vercel misconfiguration — name which.
      console.error('[files] service client config missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      })
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    let supabaseService
    try {
      supabaseService = createServiceSupabase(supabaseUrl, serviceKey)
      console.log('[files] service client created')
    } catch (err) {
      console.error('[files] service client error:', err)
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }

    // ── 3. Admin role check (by session email) ───────────────────────
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[big-vision-files] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    console.log('[files] step: admin passed')

    // ── 4. Parse + validate query params ─────────────────────────────
    const { searchParams } = new URL(req.url)

    const agent = searchParams.get('agent')
    if (!agent) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }
    const category = AGENT_CATEGORY[agent]
    if (!category) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }

    // limit: optional, default 50. Clamp to a sane range; ignore non-numeric input.
    let limit = DEFAULT_LIMIT
    const limitRaw = searchParams.get('limit')
    if (limitRaw !== null) {
      const parsed = parseInt(limitRaw, 10)
      if (Number.isInteger(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT)
      }
    }

    // ── 5. Query hub_memory (list view — no `content` column) ────────
    // categories is text[]; `.overlaps` maps to the && array-overlap operator so a
    // row matches when it carries this agent's category among any of its categories.
    // Rows are chunks — the display limit is applied to documents in step 6, not here.
    console.log('[files] step: querying hub_memory')
    console.log('[files] querying for category:', category)

    const rows: MemoryRow[] = []
    for (let from = 0; from < MAX_FETCH_ROWS; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE, MAX_FETCH_ROWS) - 1
      const { data: page, error: queryErr } = await supabaseService
        .from('hub_memory')
        .select(
          'id, title, source_type, layer, categories, leader, file_path, source_ref, chunk_index, chunk_total, created_at',
        )
        .eq('is_active', true)
        .overlaps('categories', [category])
        .order('layer', { ascending: true })
        .order('created_at', { ascending: false })
        // Stable tiebreak — without it, rows sharing a layer/created_at could repeat or
        // be skipped across page boundaries.
        .order('id', { ascending: true })
        .range(from, to)

      if (queryErr) {
        console.error('[files] query error:', queryErr.message, queryErr.code)
        return NextResponse.json({ error: 'query_failed' }, { status: 500 })
      }

      const batch = (page as MemoryRow[] | null) ?? []
      rows.push(...batch)
      // Short page = end of the result set.
      if (batch.length < to - from + 1) break
    }

    if (rows.length >= MAX_FETCH_ROWS) {
      // Never truncate silently: past this point some documents are simply not reported,
      // and any document whose chunks straddled the cut would report a low chunk_count.
      console.warn(
        `[files] row fetch cap hit (${MAX_FETCH_ROWS}) for category ${category} — document list may be incomplete`,
      )
    }
    console.log('[files] step: query done')

    // ── 6. Group chunk rows back into documents ──────────────────────
    // Key is `source_ref ?? id` — the same document key api/big-vision/chat groups on.
    // The `?? id` fallback is load-bearing: source_ref is null on legacy manual uploads
    // and on fireflies rows whose meetings insert returned no id, so a plain group-by
    // source_ref would merge all of those unrelated rows into one bogus document.
    // First-appearance order is preserved, so the layer/created_at ordering above still
    // decides document order (the date sort below then refines it).
    const docOrder: string[] = []
    const docGroups = new Map<string, MemoryRow[]>()
    for (const r of rows) {
      const key = r.source_ref ?? r.id
      const group = docGroups.get(key)
      if (group) {
        group.push(r)
      } else {
        docGroups.set(key, [r])
        docOrder.push(key)
      }
    }

    const files = docOrder.map((key) => {
      const group = docGroups.get(key) ?? []
      // Lowest chunk_index is the document's head row — the writers insert chunk 0 first.
      // Rows written before chunking have chunk_index null; treated as 0.
      group.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
      const head = group[0]

      // Strip the chunk suffix so the card shows the document's real title. The `||`
      // guards the degenerate case of a title that is nothing but a suffix.
      const rawTitle = head.title ?? ''
      const title = rawTitle.replace(CHUNK_SUFFIX_RE, '') || rawTitle

      return {
        // The head chunk's row id — the same id api/big-vision/upload returns after an
        // upload. /delete resolves the whole document from it, and /chat expands an
        // @mentioned chunk id to its siblings, so one id is enough to act on the document.
        id: head.id,
        title,
        source_type: head.source_type,
        layer: head.layer,
        // Identical across a document's chunks by construction (all writers insert the
        // same categories/leader for every chunk of one file).
        categories: head.categories,
        leader: head.leader ?? null,
        file_path: head.file_path ?? null,
        source_ref: head.source_ref ?? null,
        created_at: head.created_at,
        // Derived from the rows actually present, NOT from the chunk_total column: every
        // writer tolerates a partial insert, so chunk_total can claim more parts than
        // exist. This number is what the UI displays.
        chunk_count: group.length,
        // Every row id in this document, so the client can drop the whole group from
        // local state after a delete.
        chunk_ids: group.map((c) => c.id),
      }
    })

    // ── 7. Enrich, sort, then apply the document display limit ───────
    // Enrich fireflies-sourced files with the actual meeting date. hub_memory's
    // created_at is when the row was inserted (e.g. migration time), not when the
    // meeting happened — the real date lives on the linked meetings row.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const meetingIds = files
      .filter((f) => f.source_type === 'fireflies' && f.source_ref && uuidRegex.test(f.source_ref))
      .map((f) => f.source_ref as string)

    // Batched: this used to see at most `limit` rows, so a single .in() was safe. Grouping
    // lifted that ceiling (up to MAX_FETCH_ROWS documents when nothing is chunked), and a
    // few hundred UUIDs in one .in() builds a URL long enough to be rejected.
    const meetingDateMap: Record<string, string> = {}
    for (let i = 0; i < meetingIds.length; i += MEETING_ID_BATCH) {
      const { data: meetings, error: meetingsErr } = await supabaseService
        .from('meetings')
        .select('id, date')
        .in('id', meetingIds.slice(i, i + MEETING_ID_BATCH))

      if (meetingsErr) {
        // Non-fatal — fall back to created_at (the client uses meeting_date || created_at).
        console.error('[files] meeting date lookup failed:', meetingsErr.message, meetingsErr.code)
        continue
      }
      for (const m of meetings ?? []) {
        if (m.date) meetingDateMap[m.id] = m.date
      }
    }

    const filesWithDate = files.map((f) => ({
      ...f,
      meeting_date: f.source_ref && meetingDateMap[f.source_ref] ? meetingDateMap[f.source_ref] : null,
    }))

    // Sort newest-first by effective date (real meeting date, else upload date).
    // The DB ORDER BY above is now just a stable fallback for equal dates.
    filesWithDate.sort((a, b) => {
      const dateA = a.meeting_date || a.created_at
      const dateB = b.meeting_date || b.created_at
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    // The limit lands here — on documents, after sorting — so a chunked document can no
    // longer eat several slots and push whole files out of the list.
    const paged = filesWithDate.slice(0, limit)

    return NextResponse.json(
      {
        files: paged,
        // `total` stays the count of what's in `files` (documents returned), which is what
        // existing callers read. The other two are diagnostic: how many documents matched
        // before the limit, and how many chunk rows they were assembled from.
        total: paged.length,
        documentsAvailable: filesWithDate.length,
        chunkRows: rows.length,
      },
      { status: 200 },
    )
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-files] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
