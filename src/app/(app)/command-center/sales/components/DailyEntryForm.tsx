'use client'
// src/app/(app)/command-center/sales/components/DailyEntryForm.tsx
//
// Slide-over panel for logging a daily Sales & Marketing KPI entry. Inserts into
// the sales_daily_entries Supabase table, then asks the dashboard to refresh.
//
// NOTE — Run this in Supabase separately (do NOT auto-run):
/*
  CREATE TABLE sales_daily_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_date DATE NOT NULL,
    inquiries INTEGER DEFAULT 0,
    referrals_in INTEGER DEFAULT 0,
    referrals_out INTEGER DEFAULT 0,
    in_person_meetings INTEGER DEFAULT 0,
    second_meetings INTEGER DEFAULT 0,
    pre_con INTEGER DEFAULT 0,
    dc_pre_con INTEGER DEFAULT 0,
    sales_nps INTEGER DEFAULT 0,
    entered_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
*/

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface FieldDef {
  key: string
  label: string
  desc: string
  target: number
}

// 8 numeric KPI fields. The 9th input (date) is handled separately below.
const FIELDS: FieldDef[] = [
  { key: 'inquiries', label: 'Inquiries', desc: 'Total new inquiries received today', target: 200 },
  { key: 'referrals_in', label: 'Referrals In', desc: 'Referrals received from partners today', target: 21 },
  { key: 'referrals_out', label: 'Referrals Out', desc: 'Referrals sent to partners today', target: 30 },
  { key: 'in_person_meetings', label: 'In-Person Meetings', desc: 'First in-person meetings held today', target: 40 },
  { key: 'second_meetings', label: '2nd In-Person Meetings', desc: 'Second in-person meetings held today', target: 30 },
  { key: 'pre_con', label: 'Pre-Con Signed', desc: 'Pre-construction agreements signed today', target: 12 },
  { key: 'dc_pre_con', label: 'DC Pre-Con', desc: 'Design center pre-construction agreements', target: 3 },
  { key: 'sales_nps', label: 'Sales NPS', desc: 'Net Promoter Score responses received today', target: 21 },
]

export interface DailyEntryFormProps {
  open: boolean
  onClose: () => void
  // Called after a successful save so the parent can show a toast + refresh KPIs.
  onSaved: () => void
}

// Local (not UTC) YYYY-MM-DD for the date input default.
function todayLocalISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

const inputStyle: React.CSSProperties = {
  width: 92,
  textAlign: 'right',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
}

export default function DailyEntryForm({ open, onClose, onSaved }: DailyEntryFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [entryDate, setEntryDate] = useState<string>(todayLocalISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset to a clean form each time the panel opens.
  useEffect(() => {
    if (open) {
      setValues({})
      setEntryDate(todayLocalISO())
      setError('')
      setSaving(false)
    }
  }, [open])

  if (!open) return null

  const prettyDate = (() => {
    const d = new Date(`${entryDate}T00:00:00`)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  })()

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSave() {
    setError('')
    // Validate: every numeric field must parse to a number >= 0 (empty counts as 0).
    const parsed: Record<string, number> = {}
    for (const f of FIELDS) {
      const raw = (values[f.key] ?? '').trim()
      const num = raw === '' ? 0 : Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        setError(`"${f.label}" must be a number of 0 or more.`)
        return
      }
      parsed[f.key] = num
    }
    if (!entryDate) {
      setError('Please choose an entry date.')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      let enteredBy = 'Unknown'
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) enteredBy = user.email
      } catch {
        /* ignore auth lookup failure — still record the entry */
      }

      const { error: insertErr } = await supabase.from('sales_daily_entries').insert({
        entry_date: entryDate,
        inquiries: parsed.inquiries,
        referrals_in: parsed.referrals_in,
        referrals_out: parsed.referrals_out,
        in_person_meetings: parsed.in_person_meetings,
        second_meetings: parsed.second_meetings,
        pre_con: parsed.pre_con,
        dc_pre_con: parsed.dc_pre_con,
        sales_nps: parsed.sales_nps,
        entered_by: enteredBy,
      })
      if (insertErr) throw insertErr

      onSaved()
      onClose()
    } catch {
      setError('Could not save entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`@keyframes dailyEntrySlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 80 }}
      />

      {/* Slide-over panel from the right */}
      <div
        role="dialog"
        aria-label="Daily Sales Entry"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: '100vw',
          background: 'var(--surface)',
          color: 'var(--text)',
          zIndex: 81,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 48px -16px rgba(0,0,0,0.4)',
          animation: 'dailyEntrySlideIn 240ms ease',
          fontFamily: 'var(--font-geist), sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '22px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-instrument), Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--text)', lineHeight: 1.1 }}>
              Daily Sales Entry
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5 }}>{prettyDate}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Fields (scrollable) */}
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 24px' }}>
          {FIELDS.map((f, i) => (
            <div
              key={f.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '16px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{f.desc}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5 }}>Q2 target: {f.target}</div>
              </div>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={values[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}

          {/* Field 9 — Date */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Date</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Entry date (defaults to today)</div>
            </div>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              style={{ ...inputStyle, width: 168, textAlign: 'left' }}
            />
          </div>

          {error && (
            <div style={{ margin: '10px 0 4px', fontSize: 12.5, color: '#b91c1c', fontWeight: 600 }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 9,
              background: 'var(--charcoal)',
              border: '1px solid var(--charcoal)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save & Update Dashboard'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '11px 18px',
              borderRadius: 9,
              background: 'transparent',
              border: '1px solid var(--border2, var(--border))',
              color: 'var(--text2)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
