import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatTime(timeStr: string): string {
  // Handle 'HH:MM' or 'HH:MM:SS' formats
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const m = minutes.toString().padStart(2, '0')
  return `${h}:${m} ${period}`
}

function formatDate(dateStr: string): { day: string; date: string } {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day: days[d.getDay()],
    date: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  }
}

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get today's date in Eastern Time
    const nowET = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    )
    const todayET = nowET.toISOString().split('T')[0]

    // Fetch today's calendar events
    const { data: calendarEvents } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('date', todayET)
      .order('start_time', { ascending: true })

    const events = calendarEvents ?? []

    // Fetch open action items count
    const { count: openActionsCount } = await supabaseAdmin
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .eq('done', false)

    const openItems = openActionsCount ?? 0
    const { day, date } = formatDate(todayET)

    // Build meetings list
    let meetingLines = ''
    if (events.length === 0) {
      meetingLines = 'No meetings scheduled today'
    } else {
      meetingLines = events
        .map((e) => `- ${formatTime(e.start_time)} — ${e.title}`)
        .join('\n')
    }

    const message =
      `☀️ Good morning Calin!\n` +
      `${day}, ${date} · CASK Hub\n\n` +
      `📅 TODAY'S MEETINGS (${events.length})\n` +
      `${meetingLines}\n\n` +
      `✅ ${openItems} open action items\n\n` +
      `Full details → cask-hub.vercel.app\n` +
      `— CASK Hub AI`

    // Send SMS
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.CALIN_PHONE_NUMBER!,
    })

    return NextResponse.json({
      success: true,
      meetingsToday: events.length,
      openActionItems: openItems,
    })
  } catch (err) {
    console.error('[SMS morning-briefing]', err)
    return NextResponse.json({ error: 'Failed to send morning briefing' }, { status: 500 })
  }
}
