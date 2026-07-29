// src/app/api/big-vision/chat/route.ts
//
// Big Vision AI agent chat, powered by Claude Opus 4.8. Admin-only
// (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/big-vision/files/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup and hub_memory read use the SERVICE-ROLE client so they
//    bypass RLS.
//
// The agent answers strictly from the files in its hub_memory category, injected as
// a system-prompt context block. Every failure path returns JSON { error: '<reason>' }
// — never an unhandled throw. The Anthropic API key is never logged.
//
// ── RAG (Voyage AI similarity search) ────────────────────────────────────────
// File retrieval uses pgvector similarity search via the match_hub_memory RPC. The
// question is embedded (input_type: 'query') and the RPC returns the top matches by
// cosine similarity. If embedding is unavailable (no VOYAGE_API_KEY / request fails)
// we fall back to the previous layer/recency ordering.
//
// The RPC must exist in the database. Run this in the Supabase SQL editor:
//
// -- Run this in Supabase SQL editor. The DROP is required — Postgres refuses to change
// -- an existing function's return type via CREATE OR REPLACE alone:
// -- DROP FUNCTION IF EXISTS public.match_hub_memory(vector, text, int);
// -- CREATE OR REPLACE FUNCTION
// --   match_hub_memory(
// --     query_embedding vector(1024),
// --     match_category text,
// --     match_count int DEFAULT 15
// --   )
// -- RETURNS TABLE (
// --   id uuid,
// --   title text,
// --   content text,
// --   summary text,
// --   source_type text,
// --   layer smallint,
// --   categories hub_category[],
// --   leader text,
// --   source_ref text,
// --   chunk_index int,
// --   chunk_total int,
// --   similarity float
// -- )
// -- LANGUAGE plpgsql
// -- AS $$
// -- BEGIN
// --   RETURN QUERY
// --   SELECT
// --     h.id, h.title, h.content,
// --     h.summary, h.source_type,
// --     h.layer, h.categories,
// --     h.leader,
// --     h.source_ref::text,
// --     h.chunk_index::int,
// --     h.chunk_total::int,
// --     1 - (h.embedding <=>
// --       query_embedding) AS similarity
// --   FROM hub_memory h
// --   WHERE h.is_active = true
// --   AND h.categories &&
// --     ARRAY[match_category::hub_category]
// --   AND h.embedding IS NOT NULL
// --   ORDER BY h.embedding <=>
// --     query_embedding
// --   LIMIT match_count;
// -- END;
// -- $$;
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import { generateEmbeddings } from '@/lib/embeddings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Roles permitted to use the agents — same admin set the files/upload routes enforce.
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
}

// Per-agent system instruction. Keyed by the same slug as AGENT_CATEGORY.
const AGENT_INSTRUCTIONS: Record<string, string> = {
  pit:
    "You are the PIT (Process Improvement) agent for CASK Construction, a custom home builder in St. Petersburg, Florida. Answer ONLY from the files in memory below. Focus on each department's PIT direction, last-reviewed date, and how it compares to the company-level PIT focus (the AI Hub rollout). Flag anything not reviewed this quarter. Be concise and direct — Calin needs actionable intelligence, not lengthy summaries. When citing information, mention which file it came from.",
  'ai-hub':
    "You are the AI Hub Rollout agent for CASK Construction, a custom home builder in St. Petersburg, Florida. Answer ONLY from the files in memory below. Focus on rollout progress across departments, milestones hit vs missed, and what's blocking the construction phase from starting. Be specific and flag risks. When citing information, mention which file it came from.",
  'design-center':
    "You are the Design Center agent for CASK Construction, a custom home builder in St. Petersburg, Florida. Answer ONLY from the files in memory below. Focus on launch timeline toward start of 2027, readiness milestones, and any dependencies at risk. Flag anything slipping against the launch date. When citing information, mention which file it came from.",
  'dept-alignment':
    "You are the Department Alignment agent for CASK Construction, a custom home builder in St. Petersburg, Florida. Answer ONLY from the files in memory below. Focus on each leader's Dev Plan and Personal Plan status, what's been reviewed vs not reviewed this quarter, and what Calin needs to follow up on. Flag anyone not yet on a Dev Plan. When citing information, mention which file it came from.",
  jeff:
    "IMPORTANT: You are briefing CALIN NOONAN (President of CASK Construction) about this person. Always address your response TO Calin, not to the leader themselves. Say 'Jeff' or 'he/she' — never 'you' when referring to the leader. Say 'Calin' or 'you' when addressing the person reading this. " +
    "You are Jeff Azcona's intelligence agent for CASK Construction. Jeff is VP of Sales & Marketing. Answer ONLY from the files in memory below. Focus on sales pipeline health, revenue tracking vs targets, and how to communicate effectively with Jeff (high D/I DISC — direct, fast-paced, big picture thinker, motivated by results and recognition). Flag any pipeline risks or missed targets. When citing information, mention which file it came from.",
  lamont:
    "IMPORTANT: You are briefing CALIN NOONAN (President of CASK Construction) about this person. Always address your response TO Calin, not to the leader themselves. Say 'Lamont' or 'he/she' — never 'you' when referring to the leader. Say 'Calin' or 'you' when addressing the person reading this. " +
    "You are Lamont Gilyot's intelligence agent for CASK Construction. Lamont is VP of Finance. Answer ONLY from the files in memory below. Focus on financial health, cash position, budget variances, and how to communicate with Lamont (high D/C DISC — data-driven, precise, process-oriented, needs facts not feelings, respects preparation). Flag any budget concerns or financial risks. When citing information, mention which file it came from.",
  chad:
    "IMPORTANT: You are briefing CALIN NOONAN (President of CASK Construction) about this person. Always address your response TO Calin, not to the leader themselves. Say 'Chad' or 'he/she' — never 'you' when referring to the leader. Say 'Calin' or 'you' when addressing the person reading this. " +
    "You are Chad Holman's intelligence agent for CASK Construction. Chad is VP of Operations and Co-Owner. Answer ONLY from the files in memory below. Focus on operational health, WIP status, project timelines, and how to communicate with Chad (needs detail and clear reasoning, methodical, values process). Flag any operational blockers or at-risk projects. When citing information, mention which file it came from.",
  matteo:
    "IMPORTANT: You are briefing CALIN NOONAN (President of CASK Construction) about this person. Always address your response TO Calin, not to the leader themselves. Say 'Matteo' or 'he/she' — never 'you' when referring to the leader. Say 'Calin' or 'you' when addressing the person reading this. " +
    "You are Matteo Carpani's intelligence agent for CASK Construction. Matteo is Operations Manager. Answer ONLY from the files in memory below. Focus on active client projects, customer journey completion rates, and how to communicate with Matteo. Flag any at-risk clients or overdue customer journey steps. When citing information, mention which file it came from.",
  kaitlyn:
    "IMPORTANT: You are briefing CALIN NOONAN (President of CASK Construction) about this person. Always address your response TO Calin, not to the leader themselves. Say 'Kaitlyn' or 'he/she' — never 'you' when referring to the leader. Say 'Calin' or 'you' when addressing the person reading this. " +
    "You are Kaitlyn Grunenberg's intelligence agent for CASK Construction. Kaitlyn is VP of HR. Answer ONLY from the files in memory below. Focus on team alignment, HR pipeline, hiring status, and how to communicate with Kaitlyn. Flag any people concerns or open HR items. When citing information, mention which file it came from.",
}

// Cap the injected memory context so a large file set can't blow past the model's
// context window (or run up cost).
const MAX_CONTEXT_CHARS = 180000
// (FILE_LIMIT removed — retrieval caps at match_count: 40 in the RAG RPC and 25 in the
// layer/recency fallback, so the old 50-row limit is no longer used. Both count chunk
// ROWS; MAX_CONTEXT_CHARS above is the real ceiling once chunks expand to documents.)

// A single conversation turn coming from the client.
interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// A hub_memory row as used for context building. Shared by both retrieval paths:
// the match_hub_memory RPC (RAG) and the layer/recency fallback query. The RPC also
// returns `similarity`, which we don't need for context assembly.
interface MemoryFile {
  id: string
  title: string | null
  content: string | null
  summary: string | null
  source_type: string | null
  layer: number | null
  categories: string[] | null
  leader: string | null
  // Chunking: long documents are stored as several hub_memory rows sharing one
  // source_ref. chunk_total is 1 (or null, for rows written before chunking) when the
  // document is a single row.
  source_ref: string | null
  chunk_index: number | null
  chunk_total: number | null
  similarity?: number
}

// Columns every hub_memory retrieval path selects. Kept in one place so the paths
// can't drift — the chunk columns must be present on all of them for grouping to work.
const MEMORY_SELECT =
  'id, title, content, summary, source_type, layer, categories, leader, source_ref, chunk_index, chunk_total'

// Question embeddings come from the shared client in @/lib/embeddings, called with
// input_type: 'query' (documents are stored with 'document') — using the matching
// input_type is important for Voyage AI retrieval accuracy. Best-effort: a missing
// VOYAGE_API_KEY or any failure returns null so the caller can fall back to
// layer/recency ordering, but the reason is now logged rather than swallowed.

export async function POST(req: Request) {
  try {
    // ── 1. Require a signed-in session ───────────────────────────────
    const authClient = createServerSupabase()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    const sessionEmail = user?.email
    if (!sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // ── 2. Service-role client for ALL Supabase ops ──────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 })
    }
    const supabaseService = createServiceSupabase(supabaseUrl, serviceKey)

    // ── 3. Admin role check (by session email) ───────────────────────
    const { data: userRow, error: userErr } = await supabaseService
      .from('users')
      .select('role')
      .eq('email', sessionEmail)
      .maybeSingle()

    if (userErr) {
      console.error('[big-vision-chat] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 4. Parse + validate the request body ─────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    const agent = (body as { agent?: unknown }).agent
    const question = (body as { question?: unknown }).question
    const rawHistory = (body as { conversationHistory?: unknown }).conversationHistory
    const rawMentionedFileIds = (body as { mentionedFileIds?: unknown }).mentionedFileIds

    if (typeof agent !== 'string' || !agent) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }
    if (typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'missing_question' }, { status: 400 })
    }

    const category = AGENT_CATEGORY[agent]
    const agentInstruction = AGENT_INSTRUCTIONS[agent]
    if (!category || !agentInstruction) {
      return NextResponse.json({ error: 'invalid_agent' }, { status: 400 })
    }

    // Sanitize conversation history into the shape Claude expects. Non-conforming
    // entries are dropped rather than trusted.
    const conversationHistory: HistoryMessage[] = Array.isArray(rawHistory)
      ? rawHistory
          .filter(
            (m): m is HistoryMessage =>
              !!m &&
              typeof m === 'object' &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string',
          )
          .map((m) => ({ role: m.role, content: m.content }))
      : []

    // UI-selected @mention file IDs — the client sends these when the user picks
    // files from the mention dropdown. Sanitized to a string[] (non-strings dropped).
    const mentionedFileIds: string[] = Array.isArray(rawMentionedFileIds)
      ? rawMentionedFileIds.filter((x): x is string => typeof x === 'string')
      : []

    // ── 5. Fetch this agent's files from hub_memory ──────────────────
    // RAG: embed the question and pull the top matches by vector similarity via the
    // match_hub_memory RPC. Fall back to layer/recency ordering whenever RAG yields
    // nothing — embedding unavailable (no VOYAGE_API_KEY / failure), the RPC not yet
    // created, embeddings not generated yet, or a genuine no-match — so the agent
    // always has something to work with.
    let files: MemoryFile[] = []

    // Expand any chunked document in `rows` to its COMPLETE set of chunks. Retrieval
    // matches individual chunk rows, but the agent needs whole documents — so for every
    // row with chunk_total > 1 we pull all siblings sharing its source_ref and merge in
    // the ones that are missing (deduped by id, input order preserved).
    // Best-effort: a failed query returns the input unchanged rather than throwing.
    const expandChunkGroups = async (rows: MemoryFile[]): Promise<MemoryFile[]> => {
      const chunkedSourceRefs = Array.from(
        new Set(
          rows
            .filter((f) => f.chunk_total && f.chunk_total > 1 && f.source_ref)
            .map((f) => f.source_ref as string),
        ),
      )
      if (chunkedSourceRefs.length === 0) return rows

      const { data: allChunks, error: expandErr } = await supabaseService
        .from('hub_memory')
        .select(MEMORY_SELECT)
        .eq('is_active', true)
        .in('source_ref', chunkedSourceRefs)
        .not('content', 'is', null)

      if (expandErr) {
        // Non-fatal — keep the un-expanded rows rather than failing the whole request.
        console.error('[big-vision-chat] chunk expansion failed:', expandErr.message, expandErr.code)
        return rows
      }

      const siblings = (allChunks as MemoryFile[] | null) ?? []
      return [...rows, ...siblings.filter((c) => !rows.find((f) => f.id === c.id))]
    }

    const [queryEmbedding] = await generateEmbeddings([question], 'query')

    if (queryEmbedding !== null) {
      // ── Step A: vector similarity search via Supabase RPC ──
      const { data: similarFiles, error: rpcErr } = await supabaseService.rpc(
        'match_hub_memory',
        {
          query_embedding: queryEmbedding,
          match_category: category,
          // Raised from 25: rows are now chunks rather than whole documents, so a long
          // transcript can occupy several slots. The real ceiling on what reaches the
          // model is MAX_CONTEXT_CHARS after full-document expansion below.
          match_count: 40,
        },
      )

      if (rpcErr) {
        console.error('[big-vision-chat] match_hub_memory RPC failed:', rpcErr.message, rpcErr.code)
      }
      files = (similarFiles as MemoryFile[] | null) ?? []
    }

    // ── Fallback: layer/recency ordering to top up sparse RAG results ──
    // Runs when RAG returned fewer than 10 results — embedding unavailable (RAG
    // skipped), the RPC errored, embeddings not generated yet for most files, or a
    // sparse match. The fallback rows are merged AFTER the RAG results (deduped) so
    // vector matches keep priority and the fallback only tops up.
    if (files.length < 10) {
      const { data: fallbackFiles, error: queryErr } = await supabaseService
        .from('hub_memory')
        .select(MEMORY_SELECT)
        .eq('is_active', true)
        .overlaps('categories', [category])
        .not('content', 'is', null)
        .order('layer', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(25)

      if (queryErr) {
        // Non-fatal: the fallback now only tops up RAG results, so keep whatever RAG
        // already returned rather than failing the whole request.
        console.error('[big-vision-chat] hub_memory query failed:', queryErr.message, queryErr.code)
      }
      // Merge — RAG results first, then fallback (deduped by id).
      const fallback = (fallbackFiles as MemoryFile[] | null) ?? []
      files = [...files, ...fallback.filter((f) => !files.find((rf) => rf.id === f.id))]
    }

    // ── 5-i. Expand matched chunks into their full documents ─────────
    // A vector match hits one chunk; the surrounding chunks of that document carry the
    // rest of the meaning, so pull them all in before context assembly.
    files = await expandChunkGroups(files)

    // ── 5a. Always include Foundation files (Layer 0 + 1) ────────────
    // The $1B strategy and 2-year direction are shared context for every agent,
    // regardless of which agent is being asked. Fetched separately and merged ahead
    // of the agent's own files (de-duped by id).
    const { data: foundationFiles, error: foundationErr } = await supabaseService
      .from('hub_memory')
      .select(MEMORY_SELECT)
      .eq('is_active', true)
      .lte('layer', 1)
      .not('content', 'is', null)
      .order('layer', { ascending: true })
      .limit(5)

    if (foundationErr) {
      // Non-fatal — the agent still answers from its own files if this fails.
      console.error('[big-vision-chat] foundation query failed:', foundationErr.message, foundationErr.code)
    }

    // Expanded too: the .limit(5) above counts chunk ROWS, so a chunked strategy doc
    // would otherwise arrive truncated — and these layer 0/1 files are the shared
    // context every agent depends on.
    const foundation = await expandChunkGroups((foundationFiles as MemoryFile[] | null) ?? [])

    // ── 5a-i. Exact @mention by file ID (UI-selected files) ──────────
    // When the client sends mentionedFileIds (files picked from the mention
    // dropdown), fetch those exact rows by ID and force them ahead of the retrieved
    // set. This is precise — no title matching — so it handles duplicate titles and
    // cross-category files the title-based path below can't. The title-based block
    // still runs afterwards as a fallback for @mentions typed directly into the text.
    if (mentionedFileIds.length > 0) {
      const { data: mentionedById } = await supabaseService
        .from('hub_memory')
        .select(MEMORY_SELECT)
        .eq('is_active', true)
        .in('id', mentionedFileIds)
        .not('content', 'is', null)

      // Expanded: the UI sends the id of ONE chunk row, but naming a document means
      // the whole document, not just the part that happened to be clicked.
      const mentionedFiles = await expandChunkGroups((mentionedById as MemoryFile[] | null) ?? [])
      if (mentionedFiles.length > 0) {
        // Force mentioned files first, then the regular files (de-duped by id).
        files = [
          ...mentionedFiles,
          ...files.filter((f) => !mentionedFiles.find((mf) => mf.id === f.id)),
        ]
      }
    }

    // ── 5a-bis. @mention detection ───────────────────────────────────
    // When the user references a file with @ (e.g. "@Q3 sales plan"), force the
    // matching file(s) into context ahead of the retrieved set — even if RAG /
    // fallback didn't surface them — so the agent always sees what was named.
    // Runs after retrieval + foundation but BEFORE allFiles is assembled, so the
    // reordered `files` flows into the context builder below.
    const mentionRegex = /@([^@\n]+)/g
    const rawMentions = Array.from(question.matchAll(mentionRegex)).map((m) =>
      m[1].trim().toLowerCase(),
    )

    if (rawMentions.length > 0) {
      // Pull ALL of this agent's files (not just the top 15) so a mentioned file
      // outside the retrieved set can still be found.
      const { data: allAgentFiles } = await supabaseService
        .from('hub_memory')
        .select(MEMORY_SELECT)
        .eq('is_active', true)
        .overlaps('categories', [category])
        .not('content', 'is', null)
        .order('layer', { ascending: true })
        .limit(200)

      // Find files whose title contains any @mention. Guard against null titles
      // (MemoryFile.title is `string | null`) so this can't throw.
      const mentionedFiles = ((allAgentFiles as MemoryFile[] | null) ?? []).filter((f) =>
        rawMentions.some((mention) => (f.title ?? '').toLowerCase().includes(mention)),
      )

      if (mentionedFiles.length > 0) {
        // Force mentioned files first, then the regular files (de-duped by id).
        files = [
          ...mentionedFiles,
          ...files.filter((f) => !mentionedFiles.find((mf) => mf.id === f.id)),
        ]
      }
    }

    // Titles of the @mentioned files that made it into context — returned to the
    // frontend so it can indicate which files were pulled in by @mention.
    // One entry per DOCUMENT, not per chunk row: chunk titles carry a "(part N of M)"
    // suffix, so strip it and de-dupe by source_ref before reporting.
    const mentionedFileTitles: string[] =
      rawMentions.length > 0
        ? Array.from(
            new Map<string, string>(
              files
                .filter((f) =>
                  rawMentions.some((m) => (f.title ?? '').toLowerCase().includes(m)),
                )
                .map((f) => [
                  f.source_ref ?? f.id,
                  (f.title ?? '').replace(/\s*\(part \d+ of \d+\)$/i, ''),
                ]),
            ).values(),
          ).filter((t) => t.length > 0)
        : []

    const allFiles: MemoryFile[] = [
      ...foundation,
      ...files.filter((f) => !foundation.find((ff) => ff.id === f.id)),
    ]

    // ── 5b. Build the memory context string ──────────────────────────
    // Lower-layer files (more strategic) come first since we ORDER BY layer ASC.
    const filesWithContent = allFiles.filter((f) => f.content)
    const fileCount = filesWithContent.length

    // Group chunk rows back into documents, keyed by source_ref (falling back to the row
    // id for unchunked rows, which are each their own single-chunk document). Document
    // order follows first appearance, preserving the retrieval priority established above
    // (@mentions → foundation → RAG → fallback); chunks within a document are ordered by
    // chunk_index so the text reads in sequence.
    const docOrder: string[] = []
    const docGroups = new Map<string, MemoryFile[]>()
    for (const f of filesWithContent) {
      const docKey = f.source_ref ?? f.id
      const group = docGroups.get(docKey)
      if (group) {
        group.push(f)
      } else {
        docGroups.set(docKey, [f])
        docOrder.push(docKey)
      }
    }
    for (const group of Array.from(docGroups.values())) {
      group.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
    }

    // A document is included WHOLE or not at all: if its chunks together don't fit the
    // remaining budget the document is skipped entirely. The previous per-row skip could
    // admit parts 1, 2 and 5 of a transcript and drop 3-4, leaving the model reading
    // across a gap with nothing to signal the omission.
    let memoryContext = ''
    let totalChars = 0
    let chunkRowsUsed = 0
    const skippedSourceRefs = new Set<string>()

    for (const docKey of docOrder) {
      const group = docGroups.get(docKey) ?? []
      let groupText = ''
      for (const f of group) {
        groupText += `--- ${f.title} (${f.source_type}, layer ${f.layer}) ---\n${f.content}\n\n`
      }

      if (totalChars + groupText.length > MAX_CONTEXT_CHARS) {
        skippedSourceRefs.add(docKey)
        continue
      }

      memoryContext += groupText
      totalChars += groupText.length
      chunkRowsUsed += group.length
    }

    // Counts reported to the model and the UI are DOCUMENTS, not chunk rows.
    const distinctDocsAvailable = docOrder.length
    const distinctDocsUsed = distinctDocsAvailable - skippedSourceRefs.size

    console.log(
      `[big-vision-chat] context: ${distinctDocsUsed}/${distinctDocsAvailable} documents | ${chunkRowsUsed}/${fileCount} chunk rows | ${totalChars} chars`,
    )

    // ── 6. Assemble the system prompt ────────────────────────────────
    // When the user @mentioned files, tell the model to prioritize them by name.
    const mentionNote =
      mentionedFileTitles.length > 0
        ? `\n\nThe user specifically mentioned these files with @: ${mentionedFileTitles.join(', ')}. Prioritize answering from those files first. Mention them by name in your response.`
        : ''

    const systemPrompt = `${agentInstruction}

FILES IN MEMORY (${distinctDocsUsed} of ${distinctDocsAvailable} total files loaded — some files were too large to include in this context):

${
  memoryContext ||
  'No files have been uploaded to this agent yet. Let the user know they need to upload files first using the Upload button on the left panel.'
}${mentionNote}`

    // ── 7. Call the Anthropic API (Claude Opus 4.8) ──────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[big-vision-chat] ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    let answer: string
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-5',
          // Raised from 6000: on Opus 5 this budget covers thinking tokens as
          // well as the response text.
          max_tokens: 8000,
          system: systemPrompt,
          messages: [...conversationHistory, { role: 'user', content: question }],
        }),
      })

      if (!response.ok) {
        // Log status only — never the key or full response body.
        console.error('[big-vision-chat] Anthropic API error status:', response.status)
        return NextResponse.json({ error: 'ai_error' }, { status: 502 })
      }

      const data = await response.json()
      // Opus 5 runs adaptive thinking by default, so content[0] is a thinking
      // block (empty text — `display` defaults to "omitted"). Find the text
      // block instead of indexing, matching what email/ai/route.ts already does.
      answer =
        data?.content?.find((b: { type?: string }) => b.type === 'text')?.text ??
        'Unable to generate a response. Please try again.'
    } catch (err) {
      console.error('[big-vision-chat] Anthropic call failed:', err instanceof Error ? err.message : 'unknown')
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    // ── 8. Return the answer ─────────────────────────────────────────
    return NextResponse.json(
      {
        answer,
        // Document counts, not chunk-row counts — this drives the "Drawn from N files"
        // citation in the UI, which must not multiply when a document is chunked.
        filesUsed: distinctDocsUsed,
        totalFilesAvailable: distinctDocsAvailable,
        agent,
        mentionedFiles: mentionedFileTitles,
      },
      { status: 200 },
    )
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-chat] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'ai_error' }, { status: 502 })
  }
}
