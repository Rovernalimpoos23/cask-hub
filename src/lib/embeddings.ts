// src/lib/embeddings.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared Voyage AI embedding client — the single place /v1/embeddings is called.
//
// Replaces four near-identical inline copies (the Fireflies webhook,
// /api/big-vision/migrate, /api/big-vision/upload, /api/big-vision/chat) that had
// already drifted apart and all shared one bug: none checked `res.ok`, so a 429 or
// 5xx with a JSON error body fell through the optional chaining and returned null
// with ZERO logging. Rows were then written with `embedding: null` and counted as
// successful inserts — permanently invisible to the match_hub_memory pgvector
// search, with no trace in the logs and no backfill path.
//
// Behaviour contract (matches what the four call sites already documented):
//   - Best-effort: never throws. Any failure yields null for the affected texts so
//     the caller can still insert its row with `embedding: null`.
//   - Returns exactly one entry per input text, in the SAME order as `texts`.
//   - `inputType` is per-call — 'document' when storing, 'query' when searching.
//     Voyage retrieval accuracy depends on these matching their use, so it is a
//     required argument rather than a defaulted one.
// ──────────────────────────────────────────────────────────────────────────────

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'

// Per-item truncation — carried over unchanged from the four inline copies.
const MAX_ITEM_CHARS = 32_000

// Batch limits. Voyage accepts up to 1,000 inputs per request, but each request is
// ALSO bound by a per-request token budget that was not confirmed for voyage-3, so
// both caps below are deliberately conservative and whichever trips first wins.
//
// MAX_BATCH_CHARS is the one that matters in practice: hub_memory chunks run up to
// CHUNK_SIZE (15,000) chars, so 20 of them would be ~300k chars (~75k tokens) in a
// single request — not conservative at all. At 120k chars (~30k tokens) a request
// holds 8 full-size chunks, which still collapses an 18-chunk transcript from 18
// round-trips down to 3. MAX_BATCH_ITEMS then governs short texts (queries, small
// files), where 20 per request is nowhere near any budget.
const MAX_BATCH_ITEMS = 20
const MAX_BATCH_CHARS = 120_000

// One text plus the caller-array slot its embedding belongs in.
interface PendingText {
  index: number
  text: string
}

interface VoyageEmbeddingItem {
  index?: number
  embedding?: unknown
}

/**
 * Embed `texts` in as few Voyage requests as the batch caps allow.
 * Returns a same-length, same-order array; entries are null where embedding was
 * skipped (blank text, no API key) or failed (HTTP error, malformed response).
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: 'document' | 'query',
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = texts.map(() => null)
  if (texts.length === 0) return results

  // Key guard lives here so all callers inherit it (the upload route used to rely
  // on its own caller-side check while the other three checked internally).
  if (!process.env.VOYAGE_API_KEY) {
    console.warn(
      `[embeddings] VOYAGE_API_KEY not set — skipping ${texts.length} ${inputType} text(s), all embeddings will be null`,
    )
    return results
  }

  // Blank texts are never sent (an empty string is not embeddable) but keep their
  // slot as null so indexes stay aligned with the caller's chunk array.
  const pending: PendingText[] = texts
    .map((text, index) => ({
      index,
      text: typeof text === 'string' ? text.slice(0, MAX_ITEM_CHARS) : '',
    }))
    .filter(item => item.text.trim() !== '')

  if (pending.length === 0) return results

  const batches = splitBatches(pending)
  if (batches.length > 1) {
    console.log(
      `[embeddings] ${pending.length} ${inputType} text(s) split into ${batches.length} Voyage request(s)`,
    )
  }

  for (const batch of batches) {
    await embedBatch(batch, inputType, results)
  }

  return results
}

// Group texts into requests bounded by BOTH caps, whichever trips first.
function splitBatches(items: PendingText[]): PendingText[][] {
  const batches: PendingText[][] = []
  let current: PendingText[] = []
  let chars = 0

  for (const item of items) {
    const exceeds = current.length >= MAX_BATCH_ITEMS || chars + item.text.length > MAX_BATCH_CHARS
    // The `current.length > 0` guard means a single oversized text still goes out on
    // its own rather than looping forever. MAX_ITEM_CHARS < MAX_BATCH_CHARS makes
    // that unreachable today; it stays as a safety net if either cap is retuned.
    if (current.length > 0 && exceeds) {
      batches.push(current)
      current = []
      chars = 0
    }
    current.push(item)
    chars += item.text.length
  }

  if (current.length > 0) batches.push(current)
  return batches
}

// Embed one batch, writing vectors into `results` at each text's original index.
// Never throws: on any failure the affected slots simply stay null.
async function embedBatch(
  batch: PendingText[],
  inputType: 'document' | 'query',
  results: (number[] | null)[],
): Promise<void> {
  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: batch.map(item => item.text),
        model: VOYAGE_MODEL,
        input_type: inputType,
      }),
    })

    // THE missing check. Every inline copy went straight to res.json(), so a 429 or
    // 5xx that returns a JSON error body produced null embeddings and no log line.
    // Status + body are logged; the Authorization header never is.
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>')
      console.error(
        `[embeddings] Voyage API error ${res.status} ${res.statusText} on ${batch.length} ${inputType} text(s) — those rows will be saved with embedding: null. Response:`,
        body.slice(0, 500),
      )
      return
    }

    const data = (await res.json()) as { data?: VoyageEmbeddingItem[] }
    const items = Array.isArray(data.data) ? data.data : []

    if (items.length !== batch.length) {
      console.warn(
        `[embeddings] Voyage returned ${items.length} embedding(s) for ${batch.length} input(s) — unmatched inputs stay null`,
      )
    }

    items.forEach((item, position) => {
      // Prefer Voyage's own `index` field; fall back to array order if it is absent
      // or out of range. Response shape is validated rather than trusted.
      const local =
        typeof item?.index === 'number' && item.index >= 0 && item.index < batch.length
          ? item.index
          : position
      const target = batch[local]
      if (!target) return

      const vector = item?.embedding
      if (Array.isArray(vector) && vector.length > 0 && vector.every(n => typeof n === 'number')) {
        results[target.index] = vector as number[]
      }
    })
  } catch (err) {
    console.error(
      `[embeddings] request failed for ${batch.length} ${inputType} text(s) — those rows will be saved with embedding: null:`,
      err instanceof Error ? err.message : err,
    )
  }
}
