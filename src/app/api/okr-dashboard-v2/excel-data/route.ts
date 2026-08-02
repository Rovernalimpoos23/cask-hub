import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/okr-dashboard-v2/excel-data
//
// Reads four NAMED TABLES out of the live "Precon KPI Tracker.xlsm" on SharePoint
// via the Microsoft Graph Excel Workbook API, and returns them aggregated for the
// v2 OKR Dashboard:
//
//   NewNPS         (New NPS tab)    → NPS History
//   PITprecon      (PIT Goals tab)  → PIT Goals KPI, aggregated per person
//   SelectionsComp (Selections tab) → Selections Completed
//   BidComp        (Bid tab)        → Bid Completed
//
// Named-table access means no cell-range guessing: Graph resolves the table by
// name and returns its header row and data body separately, so a column moving
// sideways on the sheet does not break the mapping.
//
// ── READ-ONLY ───────────────────────────────────────────────────────────────
// Every Graph call here is a GET. Nothing is written to the workbook, the drive,
// or SharePoint. Graph does not execute the workbook's macros on a GET, so the
// .xlsm extension is not a concern.
//
// Supabase is READ-ONLY too. `user_integrations` is read for the access token,
// and when that token is expired it is refreshed IN MEMORY and deliberately NOT
// written back — the task's safety rules put Supabase tables off-limits. Azure AD
// v2 refresh tokens stay valid after use, so the stored row is unaffected. The
// cost is one extra token round-trip per cold read; if that is ever worth
// removing, persisting the rotated token here is the same three-line `.update()`
// that /api/calendar/my-events already does.
//
// ── EXPLICITLY OUT OF SCOPE (Phase 2b) ──────────────────────────────────────
// Quarterly Targets, Avg Design Days and Monthly Summary are NOT read here. They
// live on un-tabled sheets and need raw cell-range reads.
//
// ── Failure behaviour ───────────────────────────────────────────────────────
// A Graph failure is never fatal. Each section resolves independently; anything
// that fails comes back `null` with a message in `errors`, and the page falls back
// to its placeholder for just that section. The only non-200 is 401 for a caller
// with no session.

const GRAPH = 'https://graph.microsoft.com/v1.0'

// Confirmed by the read-only diagnostic against the sharing link
// (/shares/{shareId}/driveItem). Hardcoded rather than re-resolved on every
// request — resolving the share link costs an extra Graph round-trip and these
// IDs are stable for the life of the file.
const DRIVE_ID = 'b!UudD1727KEuVf_MQNCjQRqu-6ROUoK9OgpkyV4Jd1sl3zfMN-DMPRoUrGjYe9uWW'
const ITEM_ID = '01F5HDQZOQZTZKHGSRIBGLFK7UCL7LXNFD'

// The tracker is a shared org resource, so it is read through ONE designated
// Microsoft integration rather than each viewer's own token — most Hub users have
// no user_integrations row and no Files.Read.All grant, and per-viewer tokens
// would make the dashboard show different data to different people.
//
// Consequence, stated plainly: any signed-in Hub user who calls this route reads
// the tracker through this account's permissions. That matches the page's own
// exposure (/customers/* is allowlisted for every role in middleware.ts), but it
// is delegated access, not a service principal. Moving this to app-only Graph
// credentials is the right long-term fix.
const TRACKER_READER_EMAIL = 'r.alimpoos@caskconstruction.com'

const TABLE_NAMES = {
  nps: 'NewNPS',
  pit: 'PITprecon',
  selections: 'SelectionsComp',
  bid: 'BidComp',
} as const

// ── Excel serial dates ──────────────────────────────────────────────────────
// Excel's day 1 is 1900-01-01 with the well-known 1900-leap-year quirk, which
// makes 1899-12-30 the effective epoch. These cells are date-only wall-clock
// values with no timezone, so they are converted in UTC and used as YYYY-MM-DD
// strings. Verified against known rows: 46234 → 2026-07-31.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

function serialToISODate(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  // Reject anything outside ~1990–2090; a stray count or percentage in a date
  // column should read as "no date", not as 1900.
  if (v < 32000 || v > 70000) return null
  const ms = EXCEL_EPOCH_UTC + Math.round(v * 86_400_000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

// ── "# Days" sanity check ───────────────────────────────────────────────────
// `# Days in Selections` / `# Days in BID` are meant to be a plain day count,
// but the sheet's formula sometimes emits a raw Excel date serial instead: the
// "Lavesque" row in SelectionsComp reads 46083, which is the serial for
// 2026-03-02, not 126 years spent in selections. Same class of source-data
// defect as the Tracy Dillon row. There is no safe way to recover what the
// number was supposed to be, so an implausible value is reported as "no value"
// and the UI renders it as "—" rather than printing nonsense.
//
// The ceiling is deliberately generous — 10 years is far longer than any real
// precon phase, and far below the 32000 floor serialToISODate uses to recognise
// a date serial, so a leaked serial can never sneak under it while a genuine
// long-running project always clears it. Negatives fail too: a phase cannot
// take less than no time, so a negative means reversed or missing dates.
const MAX_PLAUSIBLE_DAYS = 3650

function plausibleDays(v: number | null): number | null {
  if (v === null) return null
  if (v < 0 || v > MAX_PLAUSIBLE_DAYS) return null
  return v
}

// ── Row helper ──────────────────────────────────────────────────────────────
// Wraps a table's header row + data body so columns are addressed by name.
// Lookup is exact-first, then case-insensitive, then prefix — the NewNPS headers
// are full survey questions, so prefix matching keeps the call sites readable.
class Table {
  readonly headers: string[]
  readonly rows: unknown[][]
  private readonly index: Map<string, number>

  constructor(headers: unknown[], rows: unknown[][]) {
    this.headers = headers.map(h => str(h))
    this.index = new Map()
    this.headers.forEach((h, i) => {
      if (h && !this.index.has(h.toLowerCase())) this.index.set(h.toLowerCase(), i)
    })
    // Drop fully-blank rows: Excel tables keep trailing empty rows.
    this.rows = rows.filter(r => r.some(c => c !== null && c !== undefined && c !== ''))
  }

  col(name: string): number {
    const exact = this.index.get(name.toLowerCase())
    if (exact !== undefined) return exact
    const needle = name.toLowerCase()
    const pref = this.headers.findIndex(h => h.toLowerCase().startsWith(needle))
    return pref
  }

  cell(row: unknown[], name: string): unknown {
    const i = this.col(name)
    return i >= 0 ? row[i] : null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Response shapes
// ═══════════════════════════════════════════════════════════════════════════
export interface NpsMonth { label: string; count: number; avg: number | null }
export interface NpsQuarter { label: string; count: number; avg: number | null; months: NpsMonth[] }
export interface NpsYear {
  year: number
  count: number
  avg: number | null
  spark: number[] // 12 monthly response counts, Jan→Dec
  quarters: NpsQuarter[]
}
export interface NpsPayload {
  total: number
  avgAll: number | null
  scored: number // responses that actually carried a 1-10 score
  years: NpsYear[]
  byPm: { pm: string; count: number; avg: number | null }[]
}

export interface PitPerson {
  name: string
  email: string | null
  counts: number[] // aligned to PIT_STAGES
  total: number
}
export interface PitPayload {
  stages: string[]
  people: PitPerson[]
  totals: number[]
  itemCount: number
  unstaged: number // rows whose Status matched none of the five stages
  quarters: string[]
  notes: string[]
}

export interface CompletionRow {
  customer: string
  pm: string
  projectType: string
  date: string | null
  days: number | null
}
export interface CompPayload {
  total: number
  thisMonth: number
  dated: number
  dateColumn: string
  byPm: { pm: string; count: number }[]
  recent: CompletionRow[]
  anomalies: number // rows where # Days disagrees with the two dates
}

export interface ExcelDataPayload {
  ok: boolean
  source: { fileName: string; lastModified: string | null; readAt: string } | null
  nps: NpsPayload | null
  pit: PitPayload | null
  selections: CompPayload | null
  bid: CompPayload | null
  errors: string[]
}

// The five Status values actually present in PITprecon, in progression order.
// Confirmed by reading the column's distinct values — this is also the vocabulary
// the workbook's hidden "Do Not Delete" tab drives its dropdown from.
//
// This settles the dashboard's long-standing ambiguity: the two columns that both
// read "Department Team" are Review and Approval. They are NOT "trained" and
// "certified", which is what the redesign mockup guessed.
const PIT_STAGES = [
  'PIT Submitted',
  'PS Submitted',
  'Department Team Review',
  'Department Team Approval',
  'SOP Created',
] as const

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return Math.round((xs.reduce((s, n) => s + n, 0) / xs.length) * 10) / 10
}

// ── Per-instance cache ──────────────────────────────────────────────────────
// Nine Graph round-trips per page load is wasteful when several people open the
// dashboard at once. The tracker is a single shared resource read through one
// account, so the payload is identical for every caller and can be shared. This
// is best-effort only: serverless instances are ephemeral and each keeps its own
// copy, so the real TTL is "up to 60s, per warm instance".
const CACHE_TTL_MS = 60_000
let cache: { at: number; payload: ExcelDataPayload } | null = null

export async function GET() {
  try {
    // ── 1. Require a signed-in session ─────────────────────────────────────
    const authClient = createServerSupabase()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ ...cache.payload, cached: true })
    }

    const errors: string[] = []
    const fail = (msg: string): NextResponse => {
      const payload: ExcelDataPayload = {
        ok: false, source: null, nps: null, pit: null,
        selections: null, bid: null, errors: [msg, ...errors],
      }
      // 200 on purpose: the page treats this as "show placeholders", not a crash.
      return NextResponse.json(payload)
    }

    // ── 2. Resolve the designated reader's Microsoft token (READ-ONLY) ─────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return fail('server_config: Supabase env missing')

    const admin = createServiceSupabase(supabaseUrl, serviceKey)

    // Email match with .maybeSingle(), never an ID join across auth.users and
    // public.users — see the repo's standing gotcha.
    const { data: readerRow, error: readerErr } = await admin
      .from('users')
      .select('id')
      .ilike('email', TRACKER_READER_EMAIL.replace(/[%_]/g, m => `\\${m}`))
      .maybeSingle()

    if (readerErr) return fail('reader_lookup_failed')
    if (!readerRow) return fail(`no users row for the designated tracker reader`)

    const { data: integration, error: integErr } = await admin
      .from('user_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', readerRow.id)
      .eq('provider', 'microsoft')
      .maybeSingle()

    if (integErr) return fail('integration_lookup_failed')
    if (!integration) return fail('tracker reader has not connected Microsoft')

    let accessToken: string | null = integration.access_token ?? null
    const expiresAtMs = integration.expires_at ? new Date(integration.expires_at).getTime() : 0

    if (Date.now() + 5 * 60 * 1000 > expiresAtMs) {
      const clientId = process.env.MICROSOFT_CLIENT_ID
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
      const tenantId = process.env.MICROSOFT_TENANT_ID
      if (!clientId || !clientSecret || !tenantId) return fail('oauth_config missing')
      if (!integration.refresh_token) return fail('token expired and no refresh token stored')

      const refreshRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: integration.refresh_token,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        },
      )
      if (!refreshRes.ok) {
        // Status only — never log token material.
        console.error('[okr-excel] token refresh failed:', refreshRes.status)
        return fail('token refresh failed — the tracker reader needs to reconnect Microsoft')
      }
      const refreshJson = await refreshRes.json()
      accessToken = typeof refreshJson.access_token === 'string' ? refreshJson.access_token : null
      // Rotated refresh token intentionally NOT persisted — see the header note.
    }

    if (!accessToken) return fail('no usable access token')

    // ── 3. Graph reads (all GET, all parallel) ─────────────────────────────
    const authHeaders = { Authorization: `Bearer ${accessToken}` }
    const BASE = `${GRAPH}/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook`

    // Arrow consts, not function declarations: tsconfig targets ES5, where a
    // function declaration inside a block is a syntax error under strict mode.
    const graphGet = async (url: string): Promise<{ ok: boolean; status: number; body: unknown }> => {
      const res = await fetch(url, { headers: authHeaders })
      const text = await res.text()
      let body: unknown = null
      try { body = text ? JSON.parse(text) : null } catch { body = null }
      return { ok: res.ok, status: res.status, body }
    }

    const errMsg = (r: { status: number; body: unknown }, what: string): string => {
      const b = r.body as { error?: { code?: string; message?: string } } | null
      const code = b?.error?.code ?? ''
      return `${what}: Graph ${r.status}${code ? ` ${code}` : ''}`
    }

    const valuesOf = (body: unknown): unknown[][] | null => {
      const v = (body as { values?: unknown } | null)?.values
      return Array.isArray(v) ? (v as unknown[][]) : null
    }

    // One header + one data-body request per table, plus the file's metadata so
    // the page can state honestly how fresh the tracker is.
    const names = Object.values(TABLE_NAMES)
    const [metaRes, ...tableRes] = await Promise.all([
      graphGet(`${GRAPH}/drives/${DRIVE_ID}/items/${ITEM_ID}?$select=name,lastModifiedDateTime`),
      ...names.flatMap(n => [
        graphGet(`${BASE}/tables('${encodeURIComponent(n)}')/headerRowRange?$select=values`),
        graphGet(`${BASE}/tables('${encodeURIComponent(n)}')/dataBodyRange?$select=values`),
      ]),
    ])

    // A 401 here means the refreshed token was still rejected — nothing else will
    // succeed, so report once rather than four times.
    if ([metaRes, ...tableRes].some(r => r.status === 401)) {
      return fail('Graph rejected the token (401) — the tracker reader needs to reconnect Microsoft')
    }

    const tables: Partial<Record<keyof typeof TABLE_NAMES, Table>> = {}
    ;(Object.keys(TABLE_NAMES) as (keyof typeof TABLE_NAMES)[]).forEach((key, i) => {
      const hdr = tableRes[i * 2]
      const body = tableRes[i * 2 + 1]
      const tableName = TABLE_NAMES[key]
      if (!hdr.ok) { errors.push(errMsg(hdr, `${tableName} header`)); return }
      if (!body.ok) { errors.push(errMsg(body, `${tableName} rows`)); return }
      const hv = valuesOf(hdr.body)
      const bv = valuesOf(body.body)
      if (!hv || hv.length === 0) { errors.push(`${tableName}: no header row returned`); return }
      tables[key] = new Table(hv[0], bv ?? [])
    })

    const metaBody = metaRes.ok
      ? (metaRes.body as { name?: string; lastModifiedDateTime?: string } | null)
      : null
    if (!metaRes.ok) errors.push(errMsg(metaRes, 'file metadata'))

    // Current month in ET, so "this month" lines up with the rest of the page.
    const nowYM = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      .slice(0, 7)

    // ── 4. NPS ─────────────────────────────────────────────────────────────
    // Only aggregates leave the server. The free-text survey answers and the
    // respondents' names are deliberately not returned — the dashboard shows
    // counts and averages, and there is no reason to ship customer comments to
    // the browser.
    let nps: NpsPayload | null = null
    const npsT = tables.nps
    if (npsT) {
      try {
        const scoreCol = npsT.col('On a scale of 1-10')
        const dateCol = npsT.col('Date Submitted')
        if (scoreCol < 0) errors.push('NewNPS: could not find the 1-10 score column')

        interface Resp { ym: string | null; score: number | null; pm: string }
        const resps: Resp[] = npsT.rows.map(r => ({
          ym: serialToISODate(r[dateCol])?.slice(0, 7) ?? null,
          score: scoreCol >= 0 ? num(r[scoreCol]) : null,
          pm: str(npsT.cell(r, 'PM')),
        }))

        const allScores = resps.map(r => r.score).filter((n): n is number => n !== null)

        // year → quarter → month
        const byYear = new Map<number, Resp[]>()
        for (const r of resps) {
          if (!r.ym) continue
          const y = Number(r.ym.slice(0, 4))
          byYear.set(y, [...(byYear.get(y) ?? []), r])
        }

        const years: NpsYear[] = Array.from(byYear.entries())
          .sort((a, b) => b[0] - a[0]) // newest first
          .map(([year, rowsForYear]) => {
            const spark = Array.from({ length: 12 }, () => 0)
            for (const r of rowsForYear) {
              const m = Number(r.ym!.slice(5, 7)) - 1
              if (m >= 0 && m < 12) spark[m] += 1
            }
            const quarters: NpsQuarter[] = [0, 1, 2, 3]
              .map(qi => {
                const monthIdxs = [qi * 3, qi * 3 + 1, qi * 3 + 2]
                const qRows = rowsForYear.filter(r => monthIdxs.includes(Number(r.ym!.slice(5, 7)) - 1))
                const months: NpsMonth[] = monthIdxs.map(mi => {
                  const mRows = rowsForYear.filter(r => Number(r.ym!.slice(5, 7)) - 1 === mi)
                  const s = mRows.map(r => r.score).filter((n): n is number => n !== null)
                  return { label: MONTH_LABELS[mi], count: mRows.length, avg: mean(s) }
                })
                const qs = qRows.map(r => r.score).filter((n): n is number => n !== null)
                return { label: `Q${qi + 1}`, count: qRows.length, avg: mean(qs), months }
              })
              .filter(q => q.count > 0) // hide quarters with nothing in them
            const ys = rowsForYear.map(r => r.score).filter((n): n is number => n !== null)
            return { year, count: rowsForYear.length, avg: mean(ys), spark, quarters }
          })

        const pmMap = new Map<string, number[]>()
        for (const r of resps) {
          if (!r.pm) continue
          const arr = pmMap.get(r.pm) ?? []
          if (r.score !== null) arr.push(r.score)
          pmMap.set(r.pm, arr)
        }
        const byPm = Array.from(pmMap.entries())
          .map(([pm, scores]) => ({
            pm,
            count: resps.filter(r => r.pm === pm).length,
            avg: mean(scores),
          }))
          .sort((a, b) => b.count - a.count)

        // Rows with no parseable Date Submitted can't be placed in the tree.
        const undated = resps.filter(r => !r.ym).length
        if (undated > 0) errors.push(`NewNPS: ${undated} response(s) have no readable Date Submitted`)

        nps = {
          total: resps.length,
          avgAll: mean(allScores),
          scored: allScores.length,
          years,
          byPm,
        }
      } catch (e) {
        errors.push(`NewNPS aggregation failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    // ── 5. PIT Goals ───────────────────────────────────────────────────────
    // `Status` holds ONE value per row: the FURTHEST stage that item has reached.
    // So the columns are a CUMULATIVE FUNNEL — an item at "SOP Created" is counted
    // under every earlier stage too, because it necessarily passed through them.
    //
    // counts[i] = that person's items whose stage index is >= i.
    //
    // This is not a guess. Running it against the live table reproduces the
    // hand-maintained numbers on the current dashboard exactly:
    //   Kelly Cuffel   → 7,2,2,1,1  (dashboard: 7,2,2,1,1)
    //   Matteo Carpani → 4,3,3,2,2  (dashboard: 4,3,3,2,2)
    //   Tim Ritschel   → 1,1,0,0,0  (dashboard: 1,1,0,0,0)
    //   Chad Holman    → 2,2,2,0,0  (dashboard: 1,2,2,0,0 — one item newer than
    //                                the hardcode, so the stale figure is the 1)
    // A current-stage reading (each item counted once) does NOT reproduce them,
    // which is what confirms the funnel is the intended semantic.
    //
    // Because every known-stage item satisfies `>= 0`, counts[0] equals the
    // person's item count — the same thing the source calls "PIT Submitted".
    let pit: PitPayload | null = null
    const pitT = tables.pit
    if (pitT) {
      try {
        const notes: string[] = []
        const stageIndex = new Map(PIT_STAGES.map((s, i) => [s.toLowerCase(), i]))

        // `reached[i]` accumulates the stage index of each item; the cumulative
        // counts are derived from it after the pass.
        interface Agg { name: string; emails: Set<string>; stageIdxs: number[]; total: number }
        const people = new Map<string, Agg>()
        const quarters = new Set<string>()
        let unstaged = 0

        for (const r of pitT.rows) {
          const name = str(pitT.cell(r, 'Name'))
          if (!name) continue
          const email = str(pitT.cell(r, 'Email'))
          const status = str(pitT.cell(r, 'Status'))
          // `Quarter` is the calendar quarter of `Date`. (`Duration` also holds
          // Q1/Q2/Q3 but means the TARGET quarter — not used here.)
          const q = str(pitT.cell(r, 'Quarter'))
          if (q) quarters.add(q)

          const key = name.toLowerCase()
          let agg = people.get(key)
          if (!agg) {
            agg = { name, emails: new Set(), stageIdxs: [], total: 0 }
            people.set(key, agg)
          }
          if (email) agg.emails.add(email)
          agg.total += 1

          const si = stageIndex.get(status.toLowerCase())
          if (si === undefined) unstaged += 1
          else agg.stageIdxs.push(si)
        }

        const rows: PitPerson[] = Array.from(people.values())
          .map(a => {
            // Prefer the corporate address; a couple of rows carry a staging
            // domain for the same person.
            const emails = Array.from(a.emails)
            const corporate = emails.find(e => e.toLowerCase().endsWith('@caskconstruction.com'))
            if (emails.length > 1) {
              notes.push(`${a.name} appears under ${emails.length} email addresses in the source`)
            }
            // Cumulative: an item at stage n counts for every stage 0..n.
            const counts = PIT_STAGES.map((_, i) => a.stageIdxs.filter(si => si >= i).length)
            return {
              name: a.name,
              email: corporate ?? emails[0] ?? null,
              counts,
              total: a.total,
            }
          })
          .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

        const totals = PIT_STAGES.map((_, i) => rows.reduce((s, p) => s + p.counts[i], 0))
        if (unstaged > 0) {
          notes.push(`${unstaged} item(s) have a Status outside the five known stages and are excluded from the stage columns`)
        }

        pit = {
          stages: PIT_STAGES.slice(),
          people: rows,
          totals,
          itemCount: pitT.rows.length,
          unstaged,
          quarters: Array.from(quarters).sort(),
          notes,
        }
      } catch (e) {
        errors.push(`PITprecon aggregation failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    // ── 6. Selections / Bid completed ──────────────────────────────────────
    // Both tables have the same 11-column shape. There is no "date completed"
    // column: the pair is `Date Permit Routed` (start) and `Date Contract Signed`,
    // and `# Days in …` equals their difference on the rows that are internally
    // consistent — so Date Contract Signed is the completion date. `Month KPI -PM`
    // is NOT used: its values are not month starts (e.g. 46016 = Dec 25), so it is
    // a formula output rather than a clean bucket.
    const summarizeCompletions = (t: Table, daysHeader: string): CompPayload => {
      const DATE_COL = 'Date Contract Signed'
      const startCol = 'Date Permit Routed'
      let anomalies = 0
      let dated = 0
      let thisMonth = 0
      const pmCounts = new Map<string, number>()
      const rows: CompletionRow[] = []

      for (const r of t.rows) {
        const iso = serialToISODate(t.cell(r, DATE_COL))
        const startIso = serialToISODate(t.cell(r, startCol))
        const rawDays = num(t.cell(r, daysHeader))
        const days = plausibleDays(rawDays)
        const pm = str(t.cell(r, 'PM Assigned'))

        if (iso) {
          dated += 1
          if (iso.slice(0, 7) === nowYM) thisMonth += 1
        }
        if (pm) pmCounts.set(pm, (pmCounts.get(pm) ?? 0) + 1)

        // Cross-check the sheet against itself: does # Days match the two dates?
        // A value we had to suppress counts as an anomaly in its own right —
        // otherwise blanking it would quietly shrink the anomaly count and the
        // bad row would disappear from the page's warning instead of driving it.
        if (rawDays !== null && days === null) {
          anomalies += 1
        } else if (iso && startIso && days !== null) {
          const delta = (Date.parse(iso) - Date.parse(startIso)) / 86_400_000
          if (Math.abs(delta - days) > 1) anomalies += 1
        }

        rows.push({
          customer: str(t.cell(r, 'Customer Name')),
          pm,
          projectType: str(t.cell(r, 'ProjectType')),
          date: iso,
          days,
        })
      }

      rows.sort((a, b) => {
        if (a.date && b.date) return b.date.localeCompare(a.date)
        if (a.date) return -1
        if (b.date) return 1
        return 0
      })

      return {
        total: t.rows.length,
        thisMonth,
        dated,
        dateColumn: DATE_COL,
        byPm: Array.from(pmCounts.entries())
          .map(([pm, count]) => ({ pm, count }))
          .sort((a, b) => b.count - a.count || a.pm.localeCompare(b.pm)),
        recent: rows.slice(0, 12),
        anomalies,
      }
    }

    let selections: CompPayload | null = null
    if (tables.selections) {
      try {
        selections = summarizeCompletions(tables.selections, '# Days in Selections')
      } catch (e) {
        errors.push(`SelectionsComp aggregation failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    let bid: CompPayload | null = null
    if (tables.bid) {
      try {
        bid = summarizeCompletions(tables.bid, '# Days in BID')
      } catch (e) {
        errors.push(`BidComp aggregation failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    const payload: ExcelDataPayload = {
      ok: Boolean(nps || pit || selections || bid),
      source: {
        fileName: metaBody?.name ?? 'Precon KPI Tracker.xlsm',
        lastModified: metaBody?.lastModifiedDateTime ?? null,
        readAt: new Date().toISOString(),
      },
      nps,
      pit,
      selections,
      bid,
      errors,
    }

    if (payload.ok) cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[okr-excel] error:', err instanceof Error ? err.message : 'unknown')
    const payload: ExcelDataPayload = {
      ok: false, source: null, nps: null, pit: null,
      selections: null, bid: null,
      errors: ['server_error while reading the tracker'],
    }
    return NextResponse.json(payload)
  }
}
