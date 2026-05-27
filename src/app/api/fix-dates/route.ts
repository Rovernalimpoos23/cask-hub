/**
 * One-time fix: corrects the year on two sessions saved with wrong year (2025 → 2026).
 * Hit GET /api/fix-dates once, then delete this file.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fixes = [
    { title: 'Weekly Leadership Meeting',                  old: '2025-05-27', new: '2026-05-27' },
    { title: 'AI Hub Setup & Automation Planning Session', old: '2025-05-26', new: '2026-05-26' },
  ]

  const results = []

  for (const fix of fixes) {
    const { data, error } = await supabase
      .from('meetings')
      .update({ date: fix.new })
      .eq('title', fix.title)
      .eq('date', fix.old)
      .select('id, title, date')

    results.push({
      title: fix.title,
      updated: !error,
      rows: data?.length ?? 0,
      error: error?.message ?? null,
    })
  }

  console.log('[fix-dates] results:', results)
  return NextResponse.json({ success: true, results })
}
