'use client'
// src/components/ai-panel/artifacts.tsx
//
// Shared artifact detection + rendering for every CASK Hub AI chat surface
// (the docked AIPanel and all floating chat drawers). Extracted from
// AIPanel.tsx so each drawer can render ```html / Chart.js / ```csv blocks
// inline instead of showing raw fenced code. Rendering-only — no API,
// message-sending, or Supabase logic lives here.

import { useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────

export type ArtifactPart =
  | { kind: 'text'; text: string }
  | { kind: 'html'; code: string }
  | { kind: 'chart'; code: string }
  | { kind: 'csv'; code: string }

// ── Parsing ──────────────────────────────────────────────────────────

// Split an assistant message into ordered text / artifact segments.
// Only ```html, ```csv, and Chart.js-containing ```javascript blocks become
// artifacts — every other block (and all prose) stays plain text, so normal
// responses render exactly as before.
export function parseArtifacts(content: string): ArtifactPart[] {
  const parts: ArtifactPart[] = []
  const fence = /```(html|csv|javascript|js)[ \t]*\r?\n([\s\S]*?)```/gi
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = fence.exec(content)) !== null) {
    const lang = m[1].toLowerCase()
    const code = m[2].replace(/\s+$/, '')
    const isChart = (lang === 'javascript' || lang === 'js') && /\bChart\s*\(/.test(code)
    const isHtml = lang === 'html'
    const isCsv = lang === 'csv'
    if (!isChart && !isHtml && !isCsv) continue // leave other code blocks inside the text
    if (m.index > lastIndex) {
      const text = content.slice(lastIndex, m.index)
      if (text.trim()) parts.push({ kind: 'text', text: text.replace(/\s+$/, '') })
    }
    if (isHtml) parts.push({ kind: 'html', code })
    else if (isChart) parts.push({ kind: 'chart', code })
    else parts.push({ kind: 'csv', code })
    lastIndex = fence.lastIndex
  }
  if (lastIndex < content.length) {
    const rest = content.slice(lastIndex)
    // Fallback for truncation: a long ```html / ```javascript / ```csv response
    // can get cut off mid-content, so the closing ``` never arrives and the
    // main regex above never matches it. Detect an unterminated opening fence
    // in the remaining text and render everything after it as the artifact.
    const open = rest.match(/```(html|csv|javascript|js)[ \t]*\r?\n/i)
    if (open && open.index !== undefined) {
      const before = rest.slice(0, open.index)
      if (before.trim()) parts.push({ kind: 'text', text: before.replace(/\s+$/, '') })
      const lang = open[1].toLowerCase()
      const code = rest.slice(open.index + open[0].length).replace(/\s+$/, '')
      const isChart = (lang === 'javascript' || lang === 'js') && /\bChart\s*\(/.test(code)
      if (lang === 'html') parts.push({ kind: 'html', code })
      else if (isChart) parts.push({ kind: 'chart', code })
      else if (lang === 'csv') parts.push({ kind: 'csv', code })
      else if (rest.trim()) parts.push({ kind: 'text', text: rest.replace(/^\s+/, '') }) // unterminated non-chart JS: keep as text
    } else if (rest.trim()) {
      parts.push({ kind: 'text', text: rest.replace(/^\s+/, '') })
    }
  }
  if (parts.length === 0) parts.push({ kind: 'text', text: content })
  return parts
}

// ── Download helpers ─────────────────────────────────────────────────

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Minimal CSV parser — handles quoted fields and escaped double-quotes.
function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// Open the HTML in a new window and trigger the browser print dialog
// (users pick "Save as PDF") — no PDF library required.
function downloadHtmlAsPdf(code: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(code)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 400)
}

// Build a .xls (HTML-table) file Excel opens natively — no spreadsheet library.
function downloadCsvAsExcel(rows: string[][]) {
  const tableHtml =
    '<table border="1">' +
    rows.map(r => '<tr>' + r.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>').join('') +
    '</table>'
  const doc =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="utf-8"></head><body>' + tableHtml + '</body></html>'
  triggerDownload(doc, 'cask-export.xls', 'application/vnd.ms-excel')
}

// ── Shared styles ────────────────────────────────────────────────────

const ARTIFACT_BTN: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
  background: 'var(--red-soft)', border: '1px solid var(--red-border)',
  color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease',
}
const ARTIFACT_CARD: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', overflow: 'hidden',
}
const ARTIFACT_HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
}
const ARTIFACT_LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
  color: 'var(--text3)', fontFamily: 'var(--font-geist), sans-serif',
}
const ARTIFACT_CODE: React.CSSProperties = {
  margin: 0, padding: 10, maxHeight: 400, overflow: 'auto', fontSize: 10.5, lineHeight: 1.5,
  fontFamily: 'var(--font-geist-mono), monospace', color: 'var(--text2)',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
}

// ── Artifact renderers ───────────────────────────────────────────────

export function HtmlArtifact({ code }: { code: string }) {
  const [showCode, setShowCode] = useState(false)
  return (
    <div style={ARTIFACT_CARD}>
      <div style={ARTIFACT_HEADER}>
        <span style={ARTIFACT_LABEL}>HTML Preview</span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button style={ARTIFACT_BTN} onClick={() => setShowCode(v => !v)}>{showCode ? 'Hide Code' : 'View Code'}</button>
          <button style={ARTIFACT_BTN} onClick={() => downloadHtmlAsPdf(code)}>⬇ Download as PDF</button>
        </div>
      </div>
      {showCode ? (
        <pre style={ARTIFACT_CODE}>{code}</pre>
      ) : (
        <iframe
          title="HTML artifact"
          sandbox="allow-scripts"
          srcDoc={code}
          style={{ width: '100%', height: 400, border: 'none', display: 'block', background: '#fff' }}
        />
      )}
    </div>
  )
}

export function ChartArtifact({ code }: { code: string }) {
  const [showCode, setShowCode] = useState(false)
  const safeCode = code.replace(/<\/script>/gi, '<\\/script>')
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>html,body{margin:0;padding:8px;font-family:system-ui,sans-serif;background:#fff}.wrap{position:relative;height:300px;width:100%}</style>
</head><body>
<div class="wrap"><canvas id="caskChart"></canvas></div>
<script>window.addEventListener('load',function(){try{${safeCode}}catch(e){document.body.innerHTML='<pre style="color:#c8311a;white-space:pre-wrap">Chart error: '+(e&&e.message?e.message:e)+'</pre>'}});</script>
</body></html>`
  return (
    <div style={ARTIFACT_CARD}>
      <div style={ARTIFACT_HEADER}>
        <span style={ARTIFACT_LABEL}>Chart</span>
        <button style={ARTIFACT_BTN} onClick={() => setShowCode(v => !v)}>{showCode ? 'Hide Code' : 'View Code'}</button>
      </div>
      {showCode ? (
        <pre style={ARTIFACT_CODE}>{code}</pre>
      ) : (
        <iframe
          title="Chart artifact"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{ width: '100%', height: 340, border: 'none', display: 'block', background: '#fff' }}
        />
      )}
    </div>
  )
}

export function CsvArtifact({ code }: { code: string }) {
  const rows = parseCsv(code)
  if (rows.length === 0) return null
  const [header, ...body] = rows
  return (
    <div style={ARTIFACT_CARD}>
      <div style={ARTIFACT_HEADER}>
        <span style={ARTIFACT_LABEL}>Data Table</span>
        <button style={ARTIFACT_BTN} onClick={() => downloadCsvAsExcel(rows)}>⬇ Download as Excel</button>
      </div>
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, fontFamily: 'var(--font-geist), sans-serif' }}>
          <thead>
            <tr>
              {header.map((h, ci) => (
                <th key={ci} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--red)', color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', background: 'var(--surface2)', position: 'sticky', top: 0 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? 'var(--surface2)' : 'var(--surface)' }}>
                {header.map((_, ci) => (
                  <td key={ci} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{r[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Drop-in renderer for chat drawers ────────────────────────────────
//
// Replaces a bare `{message.content}` render. When the message contains no
// artifact blocks it returns the raw text unchanged (so normal messages look
// exactly as before); otherwise it renders text segments as plain text and
// each artifact as its own card.
export function ArtifactContent({ content }: { content: string }) {
  const parts = parseArtifacts(content)
  const hasArtifact = parts.some(p => p.kind !== 'text')
  if (!hasArtifact) return <>{content}</>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {parts.map((part, idx) => {
        if (part.kind === 'text') return <div key={idx} style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
        if (part.kind === 'html') return <HtmlArtifact key={idx} code={part.code} />
        if (part.kind === 'chart') return <ChartArtifact key={idx} code={part.code} />
        return <CsvArtifact key={idx} code={part.code} />
      })}
    </div>
  )
}
