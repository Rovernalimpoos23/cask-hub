// src/app/api/big-vision/migrate/route.ts
//
// One-time migration: back-fills hub_memory (Big Vision agent memory) from existing
// rows in the `meetings` table. Admin-only (president / ea / ai_specialist).
//
// Tagging mirrors the Fireflies webhook (src/app/api/webhooks/fireflies/route.ts):
// attendee-based tags + strategic-topic keyword tags, with word-boundary matching
// for the short 'pit' keyword. Idempotent: rows already imported (matched by
// source_ref = meeting id) are skipped, so it's safe to run more than once.
//
// IMPORTANT — column names: the task spec referenced `transcript` and `meeting_date`,
// but the actual `meetings` schema (see src/types Meeting + the Fireflies insert) uses
// `full_transcript` and `date`. Querying the spec's names would fail, so the real
// columns are used here.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Roles permitted to run the migration — same admin set the other routes enforce.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// Generate a Voyage AI embedding for the given text. Best-effort: a missing
// VOYAGE_API_KEY, a non-2xx response, or any thrown error all resolve to null so
// the caller can still insert its row with embedding: null.
async function generateEmbedding(text: string): Promise<number[] | null> {
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
        input_type: 'document',
      }),
    })
    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[embedding] error:', err)
    return null
  }
}

// A meeting row as read for migration (subset of the meetings table).
interface MeetingRow {
  id: string
  title: string | null
  full_transcript: string | null
  summary: string[] | null
  attendees: string[] | null
  created_at: string | null
  date: string | null
}

export async function POST() {
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
      console.error('[migrate] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── 4. Fetch candidate meetings (last 90 days, non-empty transcript) ──
    // The spec's `length(transcript) > 200` can't be expressed in PostgREST, so the
    // not-null / not-empty guards run in the query and the length check runs in JS.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: rows, error: fetchErr } = await supabaseService
      .from('meetings')
      .select('id, title, full_transcript, summary, attendees, created_at, date')
      .gte('created_at', ninetyDaysAgo)
      .not('full_transcript', 'is', null)
      .neq('full_transcript', '')
      .order('created_at', { ascending: false })
      .limit(500)

    if (fetchErr) {
      console.error('[migrate] meetings fetch failed:', fetchErr.message, fetchErr.code)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    // Apply the length > 200 filter here; `meetings` is the eligible working set.
    const meetings: MeetingRow[] = (rows ?? []).filter(
      (m) => (m.full_transcript ?? '').length > 200,
    )

    // ── 5. Process each meeting ──────────────────────────────────────
    let imported = 0
    let skipped = 0
    let noTags = 0
    let errors = 0

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i]
      try {
        // ── Attendee tags — meetings.attendees is first names (e.g. ['Jeff','Calin']).
        const attendeeTags: string[] = []
        const attendeeList = meeting.attendees ?? []

        if (attendeeList.some((a: string) => a.toLowerCase().includes('jeff'))) attendeeTags.push('jeff')
        if (attendeeList.some((a: string) => a.toLowerCase().includes('lamont'))) attendeeTags.push('lamont')
        if (attendeeList.some((a: string) => a.toLowerCase().includes('chad'))) attendeeTags.push('chad')
        if (attendeeList.some((a: string) => a.toLowerCase().includes('matteo'))) attendeeTags.push('matteo')
        if (
          attendeeList.some((a: string) => {
            const name = a.toLowerCase()
            // Kaitlyn is stored as "Kait" in the meetings table — match that plus her
            // other name forms. startsWith('kait') catches "Kait"/"Kaitlyn"/"Kaitlyn G".
            return (
              name === 'kait' ||
              name === 'kaitlyn' ||
              name === 'kate' ||
              name === 'kaitlyn grunenberg' ||
              name.startsWith('kait')
            )
          })
        )
          attendeeTags.push('kaitlyn')

        // ── Keyword tags — title + transcript. 'pit' uses a word boundary to avoid
        //    matching inside "hospital"/"capital".
        const fullText = `${meeting.title ?? ''} ${meeting.full_transcript ?? ''}`.toLowerCase()

        const keywordTags: string[] = []
        if (/\bpit\b/i.test(fullText)) keywordTags.push('pit')
        if (fullText.includes('ai hub') || fullText.includes('ai-hub')) keywordTags.push('ai_hub')
        // design_center: require specific context so incidental "design center"
        // mentions (common in sales/marketing calls) don't over-tag — the migration
        // dry-run showed a bare substring match hitting 12/20 meetings. Exceptions:
        // a "Design Center:" title prefix always qualifies, and 'website' is a qualifier.
        if (
          (meeting.title ?? '').toLowerCase().startsWith('design center') ||
          (/\bdesign center\b/i.test(fullText) &&
            (fullText.includes('design center launch') ||
              fullText.includes('design center rollout') ||
              fullText.includes('design center timeline') ||
              fullText.includes('design center meeting') ||
              fullText.includes('design center update') ||
              fullText.includes('design center brand') ||
              fullText.includes('design center concept') ||
              fullText.includes('design center website') ||
              /\bdesign center\b.{0,50}\b(launch|rollout|timeline|brand|concept|2027|website)\b/i.test(fullText)))
        )
          keywordTags.push('design_center')
        if (
          fullText.includes('department alignment') ||
          fullText.includes('dept alignment') ||
          fullText.includes('dev plan') ||
          fullText.includes('development plan')
        )
          keywordTags.push('alignment')

        // Combine + de-dupe (Array.from, not [...set], for TS target compatibility).
        const allTags = Array.from(new Set([...attendeeTags, ...keywordTags]))

        // ── Skip if nothing matched ──────────────────────────────────
        if (allTags.length === 0) {
          noTags++
          continue
        }

        // ── Skip if already migrated (idempotent on source_ref) ──────
        const { count } = await supabaseService
          .from('hub_memory')
          .select('*', { count: 'exact', head: true })
          .eq('source_ref', meeting.id.toString())
          .eq('is_active', true)

        if (count && count > 0) {
          skipped++
          continue
        }

        // ── Insert ───────────────────────────────────────────────────
        const truncatedTranscript = (meeting.full_transcript ?? '').slice(0, 20000)

        // Best-effort embedding — null on failure/missing key never blocks the insert.
        const embedding = truncatedTranscript
          ? await generateEmbedding(truncatedTranscript)
          : null

        const { error: insertErr } = await supabaseService.from('hub_memory').insert({
          title: meeting.title || 'Untitled Meeting',
          content: truncatedTranscript,
          categories: allTags,
          layer: 4,
          source_type: 'fireflies',
          source_ref: meeting.id.toString(),
          leader: attendeeTags.length === 1 ? attendeeTags[0] : null,
          created_by: 'migration',
          is_active: true,
          embedding: embedding,
        })

        if (insertErr) {
          console.error('[migrate] insert error for meeting', meeting.id, ':', insertErr.message)
          errors++
        } else {
          imported++
        }
      } catch (err) {
        // One bad meeting must not stop the rest.
        console.error('[migrate] processing error for meeting', meeting.id, ':', err instanceof Error ? err.message : 'unknown')
        errors++
      }

      // Progress log every 50 meetings.
      if ((i + 1) % 50 === 0) {
        console.log(`[migrate] processed ${i + 1} / ${meetings.length}`)
      }
    }

    // ── 6. Return summary ────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        imported,
        skipped,
        noTags,
        errors,
        total: meetings.length,
        message: `Imported ${imported} meetings into hub_memory. Skipped ${skipped} duplicates. ${noTags} had no matching tags.`,
      },
      { status: 200 },
    )
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[migrate] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'migration_failed' }, { status: 500 })
  }
}
