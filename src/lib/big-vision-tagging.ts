// src/lib/big-vision-tagging.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared Big Vision tagging — the single place a Fireflies transcript is turned
// into hub_memory `categories`.
//
// Replaces two inline copies that had already drifted apart: the public webhook
// (src/app/api/webhooks/fireflies/route.ts, step 7) and the admin backfill
// (src/app/api/big-vision/migrate/route.ts). The webhook's keyword map carried
// 'aihub', 'hub rollout', 'process improvement' and 'personal plan'; migrate's did
// not, and migrate matched attendees by first name where the webhook matched by
// email — so the SAME meeting was tagged differently depending on which writer
// ingested it. Same reason lib/embeddings.ts exists.
//
// A new module rather than a helper exported from the webhook route: importing that
// route would execute its module scope as a side effect (`new Anthropic({...})` and
// the AGENDAS import at the top of the file), which a backfill route has no business
// triggering.
//
// hub_memory.categories is a Postgres hub_category[] ENUM array and retrieval is
// array-overlap (`.overlaps('categories', [category])`), not equality — so a document
// can legitimately carry several topic tags and feed several agents at once. Every
// value returned here must exist in the hub_category enum.
//
// ── Topic matching contract ──────────────────────────────────────────────────
// Two stages, in order:
//   1. TITLE ONLY, word-boundary / phrase matched. This is the intended path.
//   2. FALLBACK, and only when stage 1 matched nothing: the previous title+transcript
//      keyword scan, carried over unchanged.
// Stage 2 exists because ~90% of the tags in live data came from transcript-body hits
// (only 2 of 73 `pit` documents had "PIT" in the title), so deleting it outright would
// silently stop tagging most meetings. It logs every time it produces tags — that log
// is the evidence base for deciding when stage 2 can be retired.
//
// Attendee tags are NOT part of the two-stage topic logic and are unchanged in
// behaviour; they moved here only so the personnel roster lives in one file.
// ──────────────────────────────────────────────────────────────────────────────

/** Every topic tag this module can produce. Subset of the hub_category enum. */
export type BigVisionTopicTag = 'ai_hub' | 'pit' | 'design_center' | 'alignment'

export interface TopicTagResult {
  /** Tags to merge into hub_memory.categories. Empty when both stages missed. */
  tags: BigVisionTopicTag[]
  /** Which stage produced `tags`. 'none' when nothing matched at all. */
  matchedOn: 'title' | 'transcript' | 'none'
  /**
   * True when the TITLE alone matched 2+ topics. Logged and returned, never blocked:
   * a genuinely multi-topic leadership session should still reach every agent it
   * belongs to. The flag exists so the ambiguous cases can be reviewed, not filtered.
   */
  ambiguousTitleMatch: boolean
}

// ── Personnel roster ─────────────────────────────────────────────────────────
// One entry per leader who gets their own agent. Both attendee matchers below read
// this, so a personnel change is a single edit here instead of two edits that drift.
//
// `matchesName` is per-leader rather than a shared rule because Kaitlyn's forms are
// irregular: she is stored as "Kait" in meetings.attendees, and "Kate" also appears.
// These predicates reproduce the previous migrate-route conditions exactly.
interface Leader {
  tag: string
  email: string
  matchesName: (attendeeLower: string) => boolean
}

export const LEADERS: Leader[] = [
  { tag: 'jeff', email: 'j.azcona@caskconstruction.com', matchesName: (n) => n.includes('jeff') },
  { tag: 'lamont', email: 'l.gilyot@caskconstruction.com', matchesName: (n) => n.includes('lamont') },
  { tag: 'chad', email: 'c.holman@caskconstruction.com', matchesName: (n) => n.includes('chad') },
  { tag: 'matteo', email: 'm.carpani@caskconstruction.com', matchesName: (n) => n.includes('matteo') },
  {
    tag: 'kaitlyn',
    email: 'k.grunenberg@caskconstruction.com',
    // startsWith('kait') already covers "Kait"/"Kaitlyn"/"Kaitlyn G"; the explicit
    // equalities are kept so this reads as the same condition it replaced.
    matchesName: (n) =>
      n === 'kait' || n === 'kaitlyn' || n === 'kate' || n === 'kaitlyn grunenberg' || n.startsWith('kait'),
  },
]

/** Calin, Kai and Rovern attend everything — presence shouldn't tag the meeting. */
export const SKIP_ATTENDEE_EMAILS = [
  'c.noonan@caskconstruction.com',
  'k.mapoy@caskconstruction.com',
  'r.alimpoos@caskconstruction.com',
]

const TAG_BY_EMAIL: Record<string, string> = {}
for (const leader of LEADERS) {
  TAG_BY_EMAIL[leader.email] = leader.tag
}

/**
 * Attendee tags from a Fireflies payload, matched by EMAIL — the reliable key, since
 * display names vary per calendar invite. Tags come back in ATTENDEE order (not roster
 * order), which is what the webhook produced before and what `leader:` depends on when
 * exactly one leader attended.
 */
export function attendeeTagsFromEmails(
  attendees: Array<{ email?: string }> | null | undefined,
): string[] {
  return (attendees ?? [])
    .map((a) => a.email?.toLowerCase().trim())
    .filter(
      (email): email is string =>
        !!email && !SKIP_ATTENDEE_EMAILS.includes(email) && !!TAG_BY_EMAIL[email],
    )
    .map((email) => TAG_BY_EMAIL[email])
}

/**
 * Attendee tags from `meetings.attendees`, matched by FIRST NAME.
 *
 * This exists because the `meetings` table has no email column at all — its
 * `attendees` is a first-name string[] (e.g. ["Calin","Kai"], ["Doug","Chad","Kate"]).
 * The backfill route reads those rows, so it cannot match on email however much
 * cleaner that would be; switching it to emails would match zero attendees and
 * silently stop tagging the five leader agents. Name matching is therefore a data
 * constraint, not a leftover — but both matchers share the roster above, so the
 * name forms and the addresses can no longer drift apart.
 *
 * Tags come back in ROSTER order, matching the sequence of ifs this replaced.
 */
export function attendeeTagsFromNames(attendees: string[] | null | undefined): string[] {
  const names = (attendees ?? []).map((a) => a.toLowerCase())
  return LEADERS.filter((leader) => names.some((n) => leader.matchesName(n))).map((l) => l.tag)
}

// ── Stage 1: title-only topic patterns ───────────────────────────────────────
// Word boundaries throughout, so 'ai' cannot match inside "email"/"detail"/"Kai" and
// 'pit' cannot match inside "hospital"/"capital". 'department alignment' is a phrase
// match, deliberately narrower than the old substring list ('dev plan', 'personal
// plan', bare 'alignment' variants) so it cannot collide with Customer Journey step
// titles such as "Customer Alignment Meeting" or "After Alignment".
//
// No /g flags — these are reused across calls and `lastIndex` must stay irrelevant.
const TITLE_TOPIC_PATTERNS: Array<{ tag: BigVisionTopicTag; pattern: RegExp }> = [
  { tag: 'ai_hub', pattern: /\bai\b/i },
  { tag: 'pit', pattern: /\bpit\b/i },
  { tag: 'alignment', pattern: /\bdepartment alignment\b/i },
]

// ── Stage 2 (fallback): the previous title+transcript keyword scan ────────────
// Carried over verbatim, including the ≤4-char word-boundary rule. design_center is
// intentionally absent — it has its own qualifier rule below, used by both stages.
const TRANSCRIPT_KEYWORD_TAG_MAP: Array<{ keywords: string[]; tag: BigVisionTopicTag }> = [
  { keywords: ['ai hub', 'ai-hub', 'aihub', 'hub rollout'], tag: 'ai_hub' },
  { keywords: ['pit', 'process improvement', 'process improvement team'], tag: 'pit' },
  {
    keywords: ['department alignment', 'dept alignment', 'dev plan', 'development plan', 'personal plan'],
    tag: 'alignment',
  },
]

// Short single-word keywords (≤4 chars, e.g. 'pit') use word-boundary matching so they
// don't match inside longer words ("hospital", "capital"). Longer / multi-word keywords
// are distinctive enough for a substring check.
const matchesKeyword = (kw: string, haystack: string): boolean => {
  if (kw.length <= 4) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
  }
  return haystack.includes(kw)
}

/**
 * design_center: require specific context so incidental "design center" mentions
 * (common in sales/marketing calls) don't over-tag — a dry run showed a bare substring
 * match hitting 12/20 meetings. A "Design Center:" title prefix always qualifies, and
 * 'website' is a qualifier.
 *
 * The rule itself is unchanged. Only the text it is applied to varies by stage:
 * `text` is the title in stage 1 and title+transcript in the stage-2 fallback, which
 * is exactly what the two stages mean. `titleLower` is always the title, as before.
 *
 * Both arguments must already be lowercased — the `.includes()` checks depend on it.
 */
function matchesDesignCenter(titleLower: string, text: string): boolean {
  return (
    titleLower.startsWith('design center') ||
    (/\bdesign center\b/i.test(text) &&
      (text.includes('design center launch') ||
        text.includes('design center rollout') ||
        text.includes('design center timeline') ||
        text.includes('design center meeting') ||
        text.includes('design center update') ||
        text.includes('design center brand') ||
        text.includes('design center concept') ||
        text.includes('design center website') ||
        /\bdesign center\b.{0,50}\b(launch|rollout|timeline|brand|concept|2027|website)\b/i.test(text)))
  )
}

/**
 * Topic tags for one meeting. Title first; transcript body only as a fallback.
 *
 * Logs, in the caller's server log:
 *   - an AMBIGUOUS warning when the title alone matched 2+ topics (not blocked);
 *   - a fallback line whenever stage 2 is what produced the tags.
 * Both live here rather than in the callers so the two writers report identically.
 */
export function matchTopicTags(
  title: string | null | undefined,
  transcript: string | null | undefined,
): TopicTagResult {
  const titleText = (title ?? '').toLowerCase()
  const transcriptText = (transcript ?? '').toLowerCase()
  const fullText = `${titleText} ${transcriptText}`

  // ── Stage 1: title only ──
  const titleTags: BigVisionTopicTag[] = TITLE_TOPIC_PATTERNS.filter(({ pattern }) =>
    pattern.test(titleText),
  ).map(({ tag }) => tag)
  if (matchesDesignCenter(titleText, titleText)) titleTags.push('design_center')

  if (titleTags.length > 0) {
    const ambiguousTitleMatch = titleTags.length >= 2
    if (ambiguousTitleMatch) {
      // Logged but NOT blocked, and NOT narrowed to one guess — see TopicTagResult.
      console.warn('[big-vision] AMBIGUOUS title match:', title, '→ candidates:', titleTags)
    }
    return { tags: titleTags, matchedOn: 'title', ambiguousTitleMatch }
  }

  // ── Stage 2: fallback to the transcript body (previous behaviour) ──
  const fallbackTags: BigVisionTopicTag[] = TRANSCRIPT_KEYWORD_TAG_MAP.filter(({ keywords }) =>
    keywords.some((kw) => matchesKeyword(kw, fullText)),
  ).map(({ tag }) => tag)
  if (matchesDesignCenter(titleText, fullText)) fallbackTags.push('design_center')

  if (fallbackTags.length > 0) {
    console.log('[big-vision] title miss, fell back to transcript match:', title, '→', fallbackTags)
    return { tags: fallbackTags, matchedOn: 'transcript', ambiguousTitleMatch: false }
  }

  // Nothing matched. Deliberately silent: the callers already log the no-tags case
  // (the webhook skips the hub_memory insert, migrate counts it as noTags).
  return { tags: [], matchedOn: 'none', ambiguousTitleMatch: false }
}
