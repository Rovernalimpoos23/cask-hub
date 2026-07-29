// src/app/api/big-vision/upload/route.ts
//
// Uploads a file to the 'hub-memory' Supabase storage bucket and records a row in
// public.hub_memory. Admin-only (president / ea / ai_specialist).
//
// Auth + client pattern mirrors src/app/api/email/attachments/route.ts:
//  - Session identity comes from the SSR cookie client (@/lib/supabase-server).
//  - The users role lookup, storage upload, and hub_memory insert all use the
//    SERVICE-ROLE client so they bypass RLS.
//
// Text extraction (PDF / DOCX / XLSX) reuses the same libraries as the
// email-attachments route, but NOT its 20k-char cap: extracted text is kept in full and
// split into CHUNK_SIZE rows, one hub_memory row per chunk.
//
// Every failure path returns JSON { error: '<reason>' } — never an unhandled throw.
// Token/secret material is never logged (status codes only).
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { generateEmbeddings } from '@/lib/embeddings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Text extraction (unpdf / mammoth / xlsx) can be slow on large files; give the
// serverless function headroom beyond the platform's short default.
export const maxDuration = 60

// Roles permitted to write hub memory — same admin set the president-scoped routes use.
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// source_type is a closed set (matches the hub_memory.source_type domain).
const SOURCE_TYPES = ['manual', 'seed_doc', 'fireflies', 'meeting_note']

// Valid hub_category enum values (categories column is text[]).
const HUB_CATEGORIES = [
  'ai_hub',
  'pit',
  'design_center',
  'alignment',
  'big_vision',
  'strategy',
  'jeff',
  'lamont',
  'chad',
  'matteo',
  'kaitlyn',
]

// Long documents are stored as multiple hub_memory rows instead of being truncated.
// Each chunk carries its own embedding so RAG can match the specific passage, and all
// chunks of one upload share a source_ref so they can be regrouped.
// NOTE: kept identical (not imported) in the fireflies webhook and migrate routes — the
// three hub_memory writers have no shared module today.
const CHUNK_SIZE = 15000

function chunkText(text: string): string[] {
  if (!text || text.length <= CHUNK_SIZE) {
    return [text]
  }
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
    i += CHUNK_SIZE
  }
  return chunks
}

const PDF_TYPE = 'application/pdf'
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLS_TYPE = 'application/vnd.ms-excel'

// Normalize a contentType ("application/pdf; charset=..." → "application/pdf").
function baseContentType(ct: string): string {
  return ct.split(';')[0].trim().toLowerCase()
}

// ── Per-type text extractors ─────────────────────────────────────────
// Each is isolated by the caller so a bad file degrades to content = null rather
// than failing the whole request.

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText } = await import('unpdf')
  // mergePages: true → `text` is a single joined string (not string[] per page).
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
  return text ?? ''
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return result.value
}

function extractXlsxText(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer)
  let out = ''
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    // No length break: every sheet is extracted in full and chunked by the caller.
    out += `# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}\n\n`
  }
  return out
}

// Extract readable text from the file by type. Never throws — unsupported types or
// extraction failures return null.
async function extractContent(file: File): Promise<string | null> {
  const base = baseContentType(file.type || '')
  try {
    const buffer = await file.arrayBuffer()
    let text: string | null
    if (base === PDF_TYPE) {
      text = await extractPdfText(buffer)
    } else if (base === DOCX_TYPE) {
      text = await extractDocxText(buffer)
    } else if (base === XLSX_TYPE || base === XLS_TYPE) {
      text = extractXlsxText(buffer)
    } else {
      // Other types (images, plain binary, etc.) — no text extraction.
      text = null
    }
    // Returned in full — the caller chunks it. Empty extraction still means null.
    return text ? text : null
  } catch (err) {
    // Extraction failure must not fail the upload — just store no content.
    console.error('[big-vision-upload] text extraction failed for a', base, 'file:',
      err instanceof Error ? err.message : 'unknown')
    return null
  }
}

// Embeddings come from the shared client in @/lib/embeddings — it batches the
// request, owns the VOYAGE_API_KEY guard (this file used to leave that to the
// caller), checks res.ok, and logs Voyage HTTP failures instead of silently
// returning null. Same best-effort contract: a null embedding never blocks the upload.

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
    console.log('[upload] step: auth passed')

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
      console.error('[big-vision-upload] user lookup failed')
      return NextResponse.json({ error: 'user_lookup' }, { status: 500 })
    }
    if (!userRow || !ADMIN_ROLES.includes(userRow.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    console.log('[upload] step: admin check passed')

    // ── 4. Parse multipart form data ─────────────────────────────────
    // Isolated in its own try/catch: multipart parsing is where the request was
    // crashing in the Vercel serverless runtime ("no outgoing requests"), and the
    // outer catch alone masked the real cause. Log the underlying error here.
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (err) {
      console.error('[upload] form parse error:', err)
      return NextResponse.json({ error: 'form_parse_error' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const categoriesRaw = formData.get('categories') as string | null
    const layerRaw = formData.get('layer') as string | null
    const source_type = formData.get('source_type') as string | null
    const leaderRaw = formData.get('leader') as string | null
    console.log('[upload] step: form parsed')

    // ── 5. Validate ──────────────────────────────────────────────────
    // Required fields present?
    if (
      !file ||
      typeof (file as File).arrayBuffer !== 'function' ||
      !title ||
      !title.trim() ||
      !categoriesRaw ||
      !categoriesRaw.trim() ||
      layerRaw === null ||
      layerRaw === '' ||
      !source_type
    ) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // layer must be an integer 0-4.
    const layer = parseInt(layerRaw, 10)
    if (!Number.isInteger(layer) || layer < 0 || layer > 4) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // source_type must be one of the known values.
    if (!SOURCE_TYPES.includes(source_type)) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // categories: comma-separated, all must be valid hub_category values.
    const categories = categoriesRaw
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
    if (categories.length === 0 || !categories.every((c) => HUB_CATEGORIES.includes(c))) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const leader = leaderRaw && leaderRaw.trim() ? leaderRaw.trim() : null
    console.log('[upload] step: validation passed')

    // ── 6. Extract text content from the file (best-effort) ──────────
    const extractedText = await extractContent(file)
    console.log('[upload] step: text extracted')

    // ── 6b. (removed) Voyage API-key pre-check ───────────────────────
    // The shared embeddings client owns the VOYAGE_API_KEY guard now and emits one
    // warning per call, so the caller-side check that used to live here would only
    // duplicate it. Embeddings are still best-effort: a missing key or a failed
    // request just leaves embedding = null and the row is written without a vector.

    // ── 7. Upload the file to the 'hub-memory' bucket ────────────────
    // Path is namespaced by the first category. Timestamp keeps names unique so
    // ups:false uploads never collide.
    const filePath = `${categories[0]}/${Date.now()}-${file.name}`

    const { data: storageData, error: storageError } = await supabaseService.storage
      .from('hub-memory')
      .upload(filePath, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (storageError || !storageData) {
      console.error('[big-vision-upload] storage upload failed')
      return NextResponse.json({ error: 'upload_failed' }, { status: 502 })
    }
    console.log('[upload] step: file uploaded to storage')

    // ── 8. Insert the hub_memory rows (one per chunk) ────────────────
    // This route previously set no source_ref at all. Generate one up front so every
    // chunk of this upload shares an identity and can be regrouped — the same role
    // meetings.id plays for the fireflies webhook and migrate routes.
    // crypto.randomUUID() is the codebase's existing pattern (see
    // src/app/api/auth/microsoft/route.ts) — no `uuid` dependency, no import needed.
    const uploadSourceRef = crypto.randomUUID()

    // Files with no extractable text (images, other binaries) still get exactly one row
    // with content: null — unchanged from before chunking.
    const chunks: (string | null)[] = extractedText ? chunkText(extractedText) : [null]
    const chunkTotal = chunks.length
    const baseTitle = title.trim()

    let firstRowId: string | null = null
    let chunksSaved = 0

    // All chunks are embedded up front in one batched call (previously one sequential
    // Voyage request per chunk inside the loop below). Files with no extractable text
    // arrive here as [null] — mapped to '' so the shared client skips them and returns
    // null for that slot. Result is index-aligned with `chunks`.
    const embeddings = await generateEmbeddings(
      chunks.map(chunk => chunk ?? ''),
      'document',
    )

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkContent = chunks[idx]

      // Best-effort: a null embedding never blocks the insert. Unlike before, the
      // reason is now logged by the shared client rather than swallowed.
      const embedding = embeddings[idx] ?? null

      const { data: insertedRow, error: insertError } = await supabaseService
        .from('hub_memory')
        .insert({
          title: chunkTotal > 1 ? `${baseTitle} (part ${idx + 1} of ${chunkTotal})` : baseTitle,
          content: chunkContent,
          chunk_index: idx,
          chunk_total: chunkTotal,
          categories,
          layer,
          source_type,
          // SAME value for every chunk of this upload.
          source_ref: uploadSourceRef,
          leader,
          file_path: storageData.path,
          created_by: sessionEmail,
          is_active: true,
          embedding: embedding,
        })
        .select('id')
        .single()

      // One failed chunk must not abort the remaining chunks of this upload.
      if (insertError || !insertedRow) {
        console.error(`[big-vision-upload] hub_memory insert failed (chunk ${idx + 1}/${chunkTotal}):`,
          insertError?.message,
          insertError?.code,
          insertError?.details,
          insertError?.hint,
          JSON.stringify({
            categories,
            layer,
            source_type,
          }))
      } else {
        chunksSaved++
        if (firstRowId === null) firstRowId = insertedRow.id
      }
    }

    // Only a total failure is fatal — same as the pre-chunking behaviour of 502-ing when
    // nothing was written. A partial insert still succeeds, with a warning.
    if (chunksSaved === 0 || firstRowId === null) {
      return NextResponse.json({ error: 'upload_failed' }, { status: 502 })
    }
    if (chunksSaved < chunkTotal) {
      console.warn(`[upload] partial insert: ${chunksSaved}/${chunkTotal} chunks saved for`, baseTitle)
    }
    console.log(`[upload] step: db insert done | chunks saved: ${chunksSaved}/${chunkTotal}`)

    // Response shape unchanged — `id` is the first chunk's row id.
    return NextResponse.json({ success: true, id: firstRowId }, { status: 200 })
  } catch (err) {
    // Never throw unhandled — surface a generic error.
    console.error('[big-vision-upload] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 })
  }
}
