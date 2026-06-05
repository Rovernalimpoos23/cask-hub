import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { draft_id, to_email, to_name, subject, body: emailBody, client_name, meeting_code } = body

    const webhookUrl = process.env.MAKE_EMAIL_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 })
    }

    const makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email, to_name, subject, body: emailBody, client_name, meeting_code }),
    })

    if (!makeRes.ok) {
      const text = await makeRes.text()
      console.error('[email-send] Make.com webhook failed:', makeRes.status, text)
      return NextResponse.json({ error: 'Failed to send via Make.com' }, { status: 502 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase
      .from('client_email_drafts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', draft_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email-send] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
