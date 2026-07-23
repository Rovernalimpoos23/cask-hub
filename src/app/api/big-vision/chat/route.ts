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
// -- Run this in Supabase SQL editor:
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
const MAX_CONTEXT_CHARS = 100000
// (FILE_LIMIT removed — retrieval now caps at match_count: 15 in both the RAG RPC
// and the layer/recency fallback, so the old 50-row limit is no longer used.)

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
  similarity?: number
}

// Generate a Voyage AI embedding for a QUESTION. Note input_type: 'query' (documents
// are embedded with input_type: 'document' on upload) — using the matching input_type
// is important for Voyage AI retrieval accuracy. Best-effort: a missing VOYAGE_API_KEY
// or any failure returns null so the caller can fall back to layer/recency ordering.
async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!process.env.VOYAGE_API_KEY) {
      return null
    }
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: [text.slice(0, 32000)],
        model: 'voyage-3',
        input_type: 'query',
      }),
    })
    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[chat] embedding error:', err)
    return null
  }
}

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

    // ── 5. Fetch this agent's files from hub_memory ──────────────────
    // RAG: embed the question and pull the top matches by vector similarity via the
    // match_hub_memory RPC. Fall back to layer/recency ordering whenever RAG yields
    // nothing — embedding unavailable (no VOYAGE_API_KEY / failure), the RPC not yet
    // created, embeddings not generated yet, or a genuine no-match — so the agent
    // always has something to work with.
    let files: MemoryFile[] = []

    const queryEmbedding = await generateQueryEmbedding(question)

    if (queryEmbedding !== null) {
      // ── Step A: vector similarity search via Supabase RPC ──
      const { data: similarFiles, error: rpcErr } = await supabaseService.rpc(
        'match_hub_memory',
        {
          query_embedding: queryEmbedding,
          match_category: category,
          match_count: 15,
        },
      )

      if (rpcErr) {
        console.error('[big-vision-chat] match_hub_memory RPC failed:', rpcErr.message, rpcErr.code)
      }
      files = (similarFiles as MemoryFile[] | null) ?? []
    }

    // ── Fallback: layer/recency ordering when RAG found nothing ──
    // Runs when embedding was unavailable (RAG skipped), the RPC errored, embeddings
    // haven't been generated yet, or there was a genuine no-match.
    if (files.length === 0) {
      const { data: fallbackFiles, error: queryErr } = await supabaseService
        .from('hub_memory')
        .select('id, title, content, summary, source_type, layer, categories, leader')
        .eq('is_active', true)
        .overlaps('categories', [category])
        .order('layer', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(15)

      if (queryErr) {
        console.error('[big-vision-chat] hub_memory query failed:', queryErr.message, queryErr.code)
        return NextResponse.json({ error: 'query_failed' }, { status: 500 })
      }
      files = (fallbackFiles as MemoryFile[] | null) ?? []
    }

    // ── 5a. Always include Foundation files (Layer 0 + 1) ────────────
    // The $1B strategy and 2-year direction are shared context for every agent,
    // regardless of which agent is being asked. Fetched separately and merged ahead
    // of the agent's own files (de-duped by id).
    const { data: foundationFiles, error: foundationErr } = await supabaseService
      .from('hub_memory')
      .select('id, title, content, summary, source_type, layer, categories, leader')
      .eq('is_active', true)
      .lte('layer', 1)
      .not('content', 'is', null)
      .order('layer', { ascending: true })
      .limit(5)

    if (foundationErr) {
      // Non-fatal — the agent still answers from its own files if this fails.
      console.error('[big-vision-chat] foundation query failed:', foundationErr.message, foundationErr.code)
    }

    const foundation = (foundationFiles as MemoryFile[] | null) ?? []
    const allFiles: MemoryFile[] = [
      ...foundation,
      ...files.filter((f) => !foundation.find((ff) => ff.id === f.id)),
    ]

    // ── 5b. Build the memory context string ──────────────────────────
    // Lower-layer files (more strategic) come first since we ORDER BY layer ASC.
    const filesWithContent = allFiles.filter((f) => f.content)
    const fileCount = filesWithContent.length

    let memoryContext = ''
    let totalChars = 0
    let actualFilesUsed = 0
    for (const f of filesWithContent) {
      const entry = `--- ${f.title} (${f.source_type}, layer ${f.layer}) ---\n${f.content}\n\n`
      if (totalChars + entry.length > MAX_CONTEXT_CHARS) break
      memoryContext += entry
      totalChars += entry.length
      actualFilesUsed++
    }

    // ── 6. Assemble the system prompt ────────────────────────────────
    const systemPrompt = `${agentInstruction}

FILES IN MEMORY (${actualFilesUsed} of ${fileCount} total files loaded — some files were too large to include in this context):

${
  memoryContext ||
  'No files have been uploaded to this agent yet. Let the user know they need to upload files first using the Upload button on the left panel.'
}`

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
          model: 'claude-opus-4-8',
          max_tokens: 4000,
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
      answer =
        data?.content?.[0]?.text ?? 'Unable to generate a response. Please try again.'
    } catch (err) {
      console.error('[big-vision-chat] Anthropic call failed:', err instanceof Error ? err.message : 'unknown')
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    // ── 8. Return the answer ─────────────────────────────────────────
    return NextResponse.json(
      { answer, filesUsed: actualFilesUsed, totalFilesAvailable: fileCount, agent },
      { status: 200 },
    )
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-chat] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'ai_error' }, { status: 502 })
  }
}
