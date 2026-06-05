import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TRANSCRIPT_QUERY = `
  query GetTranscript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      duration
      meeting_attendees {
        displayName
        email
      }
      summary {
        overview
        action_items
        keywords
      }
      sentences {
        text
        speaker_name
      }
    }
  }
`

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()
  return `You are an AI assistant for CASK Construction. Extract meeting information from the transcript and return ONLY a valid JSON object with no markdown, no code blocks, no extra text before or after.

Today's date is ${today} (${year}). When extracting meeting dates, always use ${year} as the year unless the transcript explicitly mentions a different year. Never use years before ${year}.

Return this exact structure:
{
  "title": "string (meeting title)",
  "date": "YYYY-MM-DD",
  "time_start": "string or null (e.g. 10:00 AM)",
  "time_end": "string or null",
  "attendees": ["first names only"],
  "meeting_type": "leadership | planning | coaching | education",
  "module": "ActionCOACH or President Workflow — Daily Meetings or President Workflow — Coaching Sessions or President Workflow — Department Alignment or Customer Journey — Active Clients",
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "YYYY-MM-DD or null", "done": false}],
  "key_decisions": ["string array"]
}

CASK Construction context:
- Company goal: $20M revenue 2026
- Key people: Calin (President), Chad (VP Ops), Lamont (VP Finance), Jeff (VP Sales), Kait (VP HR), Matteo (Ops Manager), Kai (EA), Rovern (AI Specialist), Juliet (ActionCOACH)
- If Juliet is in the meeting — module is "ActionCOACH", type is "coaching" or "leadership"
- If only Calin and Kai — module is "President Workflow — Coaching Sessions"
- If multiple department heads present — type is "leadership" or "planning"
- Use first names only in attendees array`
}

function extractJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON object found in Claude response. Raw: ${text.slice(0, 200)}`)
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  // Always return 200 immediately so Fireflies doesn't retry on timeout
  const ok = NextResponse.json({ success: true, received: true })

  try {
    const body = await req.json()
    console.log('[fireflies] webhook received event:', body?.event, 'meeting_id:', body?.meeting_id)

    const { event, meeting_id } = body

    if (event !== 'meeting.transcribed' || !meeting_id) {
      console.log('[fireflies] ignoring event:', event)
      return ok
    }

    // 1. Fetch full transcript from Fireflies GraphQL API
    const ffRes = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({ query: TRANSCRIPT_QUERY, variables: { id: meeting_id } }),
    })

    if (!ffRes.ok) {
      console.error('[fireflies] GraphQL request failed:', ffRes.status, await ffRes.text())
      return ok
    }

    const ffData = await ffRes.json()

    if (ffData.errors) {
      console.error('[fireflies] GraphQL errors:', JSON.stringify(ffData.errors))
      return ok
    }

    const transcript = ffData?.data?.transcript
    if (!transcript) {
      console.error('[fireflies] no transcript in response for meeting_id:', meeting_id)
      return ok
    }

    console.log('[fireflies] fetched transcript:', transcript.title, '| sentences:', transcript.sentences?.length ?? 0)

    // 2. Build plain-text transcript
    const fullTranscript = (transcript.sentences ?? [])
      .map((s: { speaker_name: string; text: string }) => `${s.speaker_name}: ${s.text}`)
      .join('\n')

    const today = new Date().toISOString().split('T')[0]
    const meetingDate = transcript.date
      ? new Date(transcript.date).toISOString().split('T')[0]
      : today

    // 3. Claude extraction
    const claudeRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: buildExtractionPrompt(),
      messages: [{ role: 'user', content: fullTranscript || transcript.title }],
      max_tokens: 1500,
    })

    const rawContent = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''
    console.log('[fireflies] Claude raw response:', rawContent.slice(0, 500))

    let extracted: Record<string, unknown> = {}
    try {
      extracted = extractJSON(rawContent)
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      console.error('[fireflies] JSON parse failed:', msg)
      // Fall through — save with Fireflies metadata only
    }

    const hasMeaningfulContent =
      extracted.summary &&
      (extracted.summary as string[]).length > 0 &&
      (extracted.summary as string[])[0].length > 10

    if (!hasMeaningfulContent) {
      console.log('[fireflies] skipping save — insufficient content extracted for:', transcript.title)
      return NextResponse.json({ success: true, message: 'Skipped — insufficient content extracted' })
    }

    // 4. Save to Supabase using service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Validate extracted date — Claude sometimes hallucinates the wrong year
    const rawDate: string = (extracted.date as string) ?? meetingDate
    const extractedYear = new Date(rawDate).getFullYear()
    const currentYear = new Date().getFullYear()
    const safeDate = (!rawDate || isNaN(extractedYear) || extractedYear < currentYear)
      ? today
      : rawDate

    // 5. Try to match transcript to a client journey meeting
    //    Format 1: "John Smith — PR1m — Internal Sales to Pre-Con Pass-Off"
    //    Format 2: "PR1m Internal Sales to Pre-Con Pass-Off: John Smith"
    const rawTitle = transcript.title ?? ''

    let candidateClientName: string | null = null
    let meetingCode: string | null = null

    // Format 1: split on " — ", client name first, code second
    const dashParts = rawTitle.split(' — ')
    if (dashParts.length >= 2) {
      const codeMatch1 = rawTitle.match(/\b(PR|PD|PP|PS|PB|CG|CS|CR|CF|CC)\d+(?:\.\d+)?[a-zA-Z](?:\.\d+)?\b/i)
      if (codeMatch1) {
        candidateClientName = dashParts[0].trim()
        meetingCode = codeMatch1[0]
      }
    }

    // Format 2: "PR1m ... : Client Name" — code is first word, client name follows last ":"
    if (!meetingCode) {
      const firstWord = rawTitle.split(' ')[0] ?? ''
      const codeMatch2 = firstWord.match(/^(PR|PD|PP|PS|PB|CG|CS|CR|CF|CC)\d+(?:\.\d+)?[a-zA-Z](?:\.\d+)?$/i)
      const colonIdx = rawTitle.lastIndexOf(':')
      if (codeMatch2 && colonIdx !== -1) {
        meetingCode = codeMatch2[0]
        candidateClientName = rawTitle.slice(colonIdx + 1).trim() || null
      }
    }

    if (candidateClientName && meetingCode) {
      const { data: matchedClient } = await supabase
        .from('clients')
        .select('id, name, personality_tags, communication_style, key_interests, happiness, ai_tip')
        .ilike('name', candidateClientName)
        .maybeSingle()

      if (matchedClient) {
        console.log('[fireflies] matched client journey:', matchedClient.name, '/', meetingCode)

        const recapText = Array.isArray(extracted.summary)
          ? (extracted.summary as string[]).join('\n\n')
          : String(extracted.summary ?? '')

        const notesJson = JSON.stringify({
          summary:       extracted.summary       ?? [],
          key_decisions: extracted.key_decisions ?? [],
          action_items:  extracted.action_items  ?? [],
          transcript:    fullTranscript,
        })

        // Check if a row already exists for (client_id, meeting_id)
        const { data: existingRow } = await supabase
          .from('client_meetings')
          .select('id')
          .eq('client_id', matchedClient.id)
          .eq('meeting_id', meetingCode)
          .maybeSingle()

        if (existingRow) {
          const { error: upErr } = await supabase
            .from('client_meetings')
            .update({
              title:        rawTitle,
              recap:        recapText,
              notes:        notesJson,
              completed:    true,
              completed_at: new Date().toISOString(),
              date:         safeDate,
            })
            .eq('id', existingRow.id)

          if (upErr) {
            console.error('[fireflies] client_meetings update error:', upErr.message)
          } else {
            console.log('[fireflies] client_meetings updated:', matchedClient.name, '/', meetingCode)
          }
        } else {
          const { error: insErr } = await supabase
            .from('client_meetings')
            .insert({
              client_id:    matchedClient.id,
              meeting_id:   meetingCode,
              title:        rawTitle,
              completed:    true,
              completed_at: new Date().toISOString(),
              recap:        recapText,
              notes:        notesJson,
              date:         safeDate,
            })

          if (insErr) {
            console.error('[fireflies] client_meetings insert error:', insErr.message)
          } else {
            console.log('[fireflies] client_meetings inserted:', matchedClient.name, '/', meetingCode)
          }
        }

        // ── Profile update via second Claude call ─────────────────────────
        try {
          const profilePrompt = `You are analyzing a meeting transcript for a CASK Construction client.
Based on this transcript, extract and update the client profile.

CURRENT CLIENT PROFILE:
- Name: ${matchedClient.name}
- Personality Tags: ${Array.isArray(matchedClient.personality_tags) ? (matchedClient.personality_tags as string[]).join(', ') : 'None'}
- Communication Style: ${matchedClient.communication_style ?? 'Not set'}
- Key Interests: ${matchedClient.key_interests ?? 'Not set'}
- Happiness Status: ${matchedClient.happiness === 'green' ? 'Happy' : matchedClient.happiness === 'yellow' ? 'At Risk' : matchedClient.happiness === 'red' ? 'Needs Attention' : 'Not set'}

MEETING TRANSCRIPT:
${fullTranscript || '(no transcript)'}

MEETING SUMMARY:
${recapText}

Based on the transcript, respond ONLY with a JSON object:
{
  "personality_tags": ["tag1", "tag2"],
  "communication_style": "how this client communicates",
  "key_interests": "what this client cares about",
  "happiness": "green" or "yellow" or "red",
  "how_to_communicate": "specific tips for communicating with this client"
}

RULES:
- Only include tags from this list: Verbal communicator, Direct, Detail-oriented, Analytical, Visual learner, Budget-focused, Fast decision maker, Slow processor, Needs reassurance, Email communicator, Relationship-driven, Skeptical
- Keep existing personality tags unless the transcript clearly contradicts them
- Only update happiness if the transcript shows clear positive (green) or negative (yellow/red) sentiment; otherwise keep existing value
- If the transcript doesn't reveal something new — keep the existing value
- Return ONLY the JSON, no other text`

          const profileRes = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            messages: [{ role: 'user', content: profilePrompt }],
            max_tokens: 600,
          })

          const profileRaw = profileRes.content[0].type === 'text' ? profileRes.content[0].text : ''
          console.log('[fireflies] profile Claude raw:', profileRaw.slice(0, 300))

          const profileData = extractJSON(profileRaw) as {
            personality_tags?: string[]
            communication_style?: string
            key_interests?: string
            happiness?: string
            how_to_communicate?: string
          }

          const profileUpdate: Record<string, unknown> = {}
          if (Array.isArray(profileData.personality_tags) && profileData.personality_tags.length > 0) {
            profileUpdate.personality_tags = profileData.personality_tags
          }
          if (profileData.communication_style?.trim()) {
            profileUpdate.communication_style = profileData.communication_style.trim()
          }
          if (profileData.key_interests?.trim()) {
            profileUpdate.key_interests = profileData.key_interests.trim()
          }
          if (profileData.how_to_communicate?.trim()) {
            profileUpdate.how_to_communicate = profileData.how_to_communicate.trim()
            profileUpdate.ai_tip = profileData.how_to_communicate.trim()
          }
          const validHappiness = ['green', 'yellow', 'red']
          if (profileData.happiness && validHappiness.includes(profileData.happiness)) {
            profileUpdate.happiness = profileData.happiness
          }

          if (Object.keys(profileUpdate).length > 0) {
            const { error: profileErr } = await supabase
              .from('clients')
              .update(profileUpdate)
              .eq('id', matchedClient.id)

            if (profileErr) {
              console.error('[fireflies] client profile update error:', profileErr.message)
            } else {
              console.log('[fireflies] client profile updated for:', matchedClient.name, '| fields:', Object.keys(profileUpdate).join(', '))
            }
          } else {
            console.log('[fireflies] no profile fields to update for:', matchedClient.name)
          }
        } catch (profileErr) {
          const msg = profileErr instanceof Error ? profileErr.message : String(profileErr)
          console.error('[fireflies] profile update failed (non-fatal):', msg)
        }

        // ── Auto-generate email draft for the next email step ─────────────
        const EMAIL_TRIGGERS: Record<string, { code: string; subject: string; templateText: string }> = {
          PR1m: {
            code: 'PR2e',
            subject: `Next Steps — Initial Alignment Meeting: ${matchedClient.name}`,
            templateText: `Hi [Customer Name],

Congratulations on moving forward with your ADU project — we're thrilled to be part of this exciting journey with you!

[PM Name], your dedicated Project Manager, is looking forward to meeting you at your upcoming initial alignment meeting and starting to plan your exciting project!

To keep things moving smoothly, we'd like to schedule your Initial Alignment Meeting. During this meeting we'll walk through key details and objectives to ensure everything is aligned as we transition into the next phase.

SCHEDULING OPTIONS:
Please choose one of the following timeslots:
• [Option 1: Day, Time]
• [Option 2: Day, Time]
• [Option 3: Day, Time]

As part of our preparation, we'll also be coordinating the sanitary line camera location, which needs to be completed in the coming weeks. We'll handle the logistics and keep you informed every step of the way.

Looking forward to hearing from you!
Warm regards,`,
          },
          PR3m: {
            code: 'PR4e',
            subject: `Alignment Meeting Recap: ${matchedClient.name}`,
            templateText: `Dear [Owner Name],

Thank you for your time and engagement during our kickoff in-person meeting. It was great getting to meet you and hearing about your vision for this project!

As expressed, effective communication during the design stages is extremely important to us. Here are the next steps of your design journey:

NEXT STEPS:
1. 50% Floorplan Meeting — Initial site plan layout, exterior dimensions, wall layout, kitchen layout
2. 50% Floorplan Meeting Recap — Emailed within 24-48 hours with summary and budget update
3. 75% Floorplan Meeting — MEP layout, exterior finishes, elevations
4. 75% Floorplan Meeting Recap — Emailed within 24-48 hours with summary and budget update
5. 95% Drawing Review — Emailed 1-2 weeks post 75% meeting for your approval before permit submission
6. Permit Submission Confirmation — Provided within 24 hours of submitting permit

BUDGET UPDATE TIMELINE:
You will receive budget updates at each design milestone from Initial Proposal through Construction Contract.

Thanks for trusting CASK Construction with your project. Please don't hesitate to reach out with any questions.
Best regards,`,
          },
          PR5m: {
            code: 'PR6e',
            subject: `Flag Meeting Recap: ${matchedClient.name}`,
            templateText: `Dear Customer,

Thank you for your time during our recent Flag meeting. We covered important information relating to your future project, and it is critical that this is correctly documented so that your vision is accurately transformed into reality.

I have prepared the below meeting summary. Please reply if you feel I have missed anything or have any additional requests since our last meeting.

ATTENDEES:
[Attendee list]

RECAP:
[Key discussion points from the flag meeting]

ACTION ITEMS:
[Action items from the meeting]

NEXT MEETING AGENDA:
[Upcoming meeting agenda items]

Thanks for trusting CASK Construction with your project. Let's keep this positive momentum going!
Regards,
The Cask Team`,
          },
        }

        const emailTrigger = EMAIL_TRIGGERS[meetingCode]
        if (emailTrigger) {
          try {
            const { data: clientFull } = await supabase
              .from('clients')
              .select('email, project_type, location, communication_style, personality_tags')
              .eq('id', matchedClient.id)
              .single()

            const personalityStr = Array.isArray(clientFull?.personality_tags)
              ? (clientFull.personality_tags as string[]).join(', ')
              : 'Not specified'

            const emailPrompt = `You are drafting a professional email for CASK Construction.

BASE TEMPLATE:
${emailTrigger.templateText}

CLIENT PROFILE:
- Name: ${matchedClient.name}
- Project Type: ${clientFull?.project_type ?? 'ADU'}
- Location: ${clientFull?.location ?? 'St. Petersburg, FL'}
- Communication Style: ${clientFull?.communication_style ?? 'Not specified'}
- Personality: ${personalityStr}

LAST MEETING RECAP:
${recapText}

Write a personalized version of this email for this specific client. Keep the same structure and key points from the template but personalize it using the client's name, project details, and what was discussed in the last meeting.

Communication style notes:
- If client is Direct/Fast decision maker: keep it short and clear
- If client is Detail-oriented/Analytical: include more details
- If client is Relationship-driven: use a warmer tone

Return ONLY the email body text. No subject line. No preamble.`

            const emailRes = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              messages: [{ role: 'user', content: emailPrompt }],
              max_tokens: 1000,
            })

            const emailBody = emailRes.content[0].type === 'text' ? emailRes.content[0].text.trim() : ''

            if (emailBody) {
              const { error: draftErr } = await supabase
                .from('client_email_drafts')
                .insert({
                  client_id:       matchedClient.id,
                  meeting_id:      emailTrigger.code,
                  email_code:      emailTrigger.code,
                  subject:         emailTrigger.subject,
                  body:            emailBody,
                  status:          'draft',
                  recipient_email: clientFull?.email ?? null,
                  recipient_name:  matchedClient.name,
                })

              if (draftErr) {
                console.error('[fireflies] email draft insert error:', draftErr.message)
              } else {
                console.log('[fireflies] email draft generated:', matchedClient.name, '/', emailTrigger.code)
              }
            }
          } catch (emailErr) {
            const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
            console.error('[fireflies] email draft generation failed (non-fatal):', msg)
          }
        }

        // Client journey meeting — do NOT save to meetings (ActionCoach) table
        return ok
      }
    }

    // 6. No client match — save to meetings table as normal (ActionCoach session)
    const sessionTitle = (extracted.title as string) ?? transcript.title ?? 'Untitled Meeting'

    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('title', sessionTitle)
      .eq('date', safeDate)
      .single()

    if (existing) {
      console.log('[fireflies] duplicate session detected, skipping:', sessionTitle, '| date:', safeDate)
      return NextResponse.json({ success: true, message: 'Session already exists, skipping duplicate' })
    }

    const record = {
      title:           sessionTitle,
      date:            safeDate,
      time_start:      extracted.time_start   ?? null,
      time_end:        extracted.time_end     ?? null,
      attendees:       extracted.attendees    ?? (transcript.meeting_attendees ?? []).map((a: { displayName: string }) => a.displayName),
      meeting_type:    extracted.meeting_type ?? null,
      module:          extracted.module       ?? null,
      summary:         extracted.summary      ?? [],
      action_items:    extracted.action_items ?? [],
      key_decisions:   extracted.key_decisions ?? [],
      full_transcript: fullTranscript,
      owner:           'calin',
    }

    const { error: dbError } = await supabase.from('meetings').insert(record)

    if (dbError) {
      console.error('[fireflies] Supabase insert error:', dbError.message, dbError.details)
    } else {
      console.log('[fireflies] meeting saved successfully:', record.title, '| date:', record.date)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[fireflies] unhandled webhook error:', msg, err)
  }

  return ok
}
