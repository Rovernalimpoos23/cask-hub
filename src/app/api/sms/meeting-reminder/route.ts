import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const m = minutes.toString().padStart(2, '0')
  return `${h}:${m} ${period}`
}

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get current time and +15 min window in Eastern Time
    const nowUTC = new Date()
    const in15UTC = new Date(nowUTC.getTime() + 15 * 60 * 1000)

    // Convert to ET for date comparison (calendar events are stored in ET)
    const nowET = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const todayET = nowET.toISOString().split('T')[0]

    // Format times as HH:MM for Supabase comparison
    const nowTimeStr = nowET.toTimeString().slice(0, 5)
    const in15ET = new Date(in15UTC.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const in15TimeStr = in15ET.toTimeString().slice(0, 5)

    // Fetch upcoming meetings in the 15-minute window that haven't been reminded
    const { data: upcomingEvents, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('date', todayET)
      .eq('reminded', false)
      .gte('start_time', nowTimeStr)
      .lte('start_time', in15TimeStr)

    if (error) {
      console.error('[SMS meeting-reminder] Supabase error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return NextResponse.json({ success: true, reminders: 0 })
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    const results: string[] = []

    for (const event of upcomingEvents) {
      const startFormatted = formatTime(event.start_time)
      const endFormatted = formatTime(event.end_time)
      const organizer = event.organizer ?? 'CASK Hub'

      let message =
        `⏰ Meeting in 15 minutes!\n\n` +
        `📅 ${event.title}\n` +
        `🕐 ${startFormatted} - ${endFormatted}\n` +
        `👤 ${organizer}`

      if (event.teams_link) {
        message += `\n\n${event.teams_link}`
      }

      message += `\n— CASK Hub AI`

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.CALIN_PHONE_NUMBER!,
      })

      // Mark as reminded
      await supabaseAdmin
        .from('calendar_events')
        .update({ reminded: true })
        .eq('id', event.id)

      results.push(event.title)
    }

    return NextResponse.json({ success: true, reminders: results.length, meetings: results })
  } catch (err) {
    console.error('[SMS meeting-reminder]', err)
    return NextResponse.json({ error: 'Failed to send meeting reminders' }, { status: 500 })
  }
}
