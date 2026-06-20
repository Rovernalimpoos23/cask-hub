'use client'
// src/app/(app)/command-center/sales/components/ExportPDF.tsx
//
// Captures the Sales & Marketing dashboard section-by-section (each major section
// has a #pdf-section-* id) and lays each group out on its own A4-landscape page so
// the content stays large and readable, instead of squeezing the whole dashboard
// onto a single page. Adds a section title at the top and a page-number footer.

import { useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface ExportPDFProps {
  // Unused now (kept for compatibility) — capture targets the #pdf-section-* ids.
  targetId?: string
}

// One entry per PDF page: a title + the section ids to stack on that page.
const PAGES: { title: string; ids: string[] }[] = [
  { title: 'Overview — Header & Key Stats', ids: ['pdf-section-header', 'pdf-section-stats'] },
  { title: 'Daily KPI Tracker', ids: ['pdf-section-kpi'] },
  { title: 'HOT List', ids: ['pdf-section-hotlist'] },
  { title: 'Sales Conversions & Rolling 120-Day Funnel', ids: ['pdf-section-conversions', 'pdf-section-funnel'] },
  { title: 'Lead Sources & Current Week Progress', ids: ['pdf-section-sources', 'pdf-section-weekly'] },
  { title: 'Q2 NPS, Monthly Funnel & Weekly Referrals', ids: ['pdf-section-nps', 'pdf-section-monthly', 'pdf-section-referrals'] },
  { title: 'Q2 PIT Submissions', ids: ['pdf-section-pit'] },
  { title: 'Reports', ids: ['pdf-section-reports'] },
]

function DownloadIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'exportPdfSpin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function ExportPDF(_props: ExportPDFProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  async function handleExport() {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth() // 297mm
      const pageH = pdf.internal.pageSize.getHeight() // 210mm
      const margin = 10
      const availW = pageW - margin * 2 // 277mm
      const titleY = 12
      const contentTop = 18
      const footerY = pageH - 6
      const availH = footerY - 4 - contentTop // usable vertical space for content
      const gap = 4 // mm between stacked sections on a page
      const total = PAGES.length

      let pageAdded = false
      let pageNum = 0

      for (let i = 0; i < PAGES.length; i++) {
        const cfg = PAGES[i]
        setProgress(`Generating page ${i + 1} of ${total}…`)
        // Yield a tick so the progress label repaints before the heavy capture.
        await new Promise((r) => setTimeout(r, 0))

        // Capture each section in this page group.
        const canvases: HTMLCanvasElement[] = []
        for (const id of cfg.ids) {
          const el = document.getElementById(id)
          if (!el) continue
          const cv = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight,
          })
          canvases.push(cv)
        }
        if (!canvases.length) continue

        if (pageAdded) pdf.addPage()
        pageAdded = true
        pageNum++

        // Lay sections out at full available width, scaled down together to fit the page.
        const base = canvases.map((cv) => ({ cv, wmm: availW, hmm: cv.height * (availW / cv.width) }))
        const stackedH = base.reduce((s, im) => s + im.hmm, 0) + gap * (base.length - 1)
        const scale = stackedH > availH ? availH / stackedH : 1

        // Section title (top, small gray).
        pdf.setFontSize(9)
        pdf.setTextColor(130, 130, 130)
        pdf.text(cfg.title, margin, titleY)

        // Stacked, horizontally centered images.
        let y = contentTop
        for (const im of base) {
          const w = im.wmm * scale
          const h = im.hmm * scale
          const x = margin + (availW - w) / 2
          pdf.addImage(im.cv.toDataURL('image/png'), 'PNG', x, y, w, h)
          y += h + gap * scale
        }

        // Page-number footer.
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        pdf.text(`Page ${pageNum} of ${total} · CASK Sales Dashboard · Q2 2026`, margin, footerY)
      }

      if (!pageAdded) {
        setError('No dashboard sections found to export.')
        return
      }

      const today = new Date().toISOString().split('T')[0]
      pdf.save(`CASK_Sales_Dashboard_Q2_2026_${today}.pdf`)
    } catch {
      setError('PDF export failed. Please try again.')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <style>{`@keyframes exportPdfSpin { to { transform: rotate(360deg); } }`}</style>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 18px',
          borderRadius: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border2, var(--border))',
          color: 'var(--text)',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: 'inherit',
        }}
      >
        {loading ? <Spinner size={14} /> : <DownloadIcon size={15} />}
        {loading ? (progress || 'Generating PDF…') : 'Export to PDF'}
      </button>
      {error && <span style={{ fontSize: 12, color: '#b91c1c' }}>{error}</span>}
    </span>
  )
}
