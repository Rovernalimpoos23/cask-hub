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

        // Maps each completed meeting code to the email code it should trigger
        const MEETING_TO_EMAIL: Record<string, string> = {
          PR1m: 'PR2e', PR3m: 'PR4e', PR5m: 'PR6e',
          PD1m: 'PD2e', PD4m: 'PD5e',
          PS2m: 'PS3e', PS4m: 'PS5e', PS6m: 'PS7e', PS8m: 'PS9e',
          PB2m: 'PB3e', PB5m: 'PB6e',
          CG1m: 'CG2e', CG3m: 'CG4e',
          CS2m: 'CS3e',
          CR1m: 'CR2e',
          CF1m: 'CF2e',
          CC2m: 'CC3e',
        }

        // Specific templates for key email codes
        const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
          PR2e: {
            subject: `Next Steps on Your [Project Type] Journey — Let's Schedule Your Initial Alignment Meeting`,
            body: `Hi [Customer Name],

Congratulations on moving forward with your [Project Type] project — we're thrilled to be part of this exciting journey with you!

[PM Name], your dedicated Project Manager, is looking forward to meeting you at our upcoming initial alignment meeting and to start planning your exciting project!

To keep things moving smoothly, we'd like to schedule your Initial Alignment Meeting. During this meeting, we'll walk through key details and objectives to ensure everything is aligned as we transition into the next phase.

Please reply with your availability or we will follow up with available times shortly.

Warm regards,
Kai Mapoy
CASK Construction`,
          },
          PR4e: {
            subject: `Alignment Meeting Recap — [Client Name] [Project Type] Project`,
            body: `Hi [Customer Name],

Thank you for joining us for your Initial Alignment Meeting — it was great connecting and diving into the vision for your [Project Type] project!

Here is a quick recap of what we covered:
- Reviewed your project vision and key priorities
- Discussed timeline expectations and key milestones
- Confirmed next steps heading into the design phase

We are excited to bring your vision to life. We will follow up shortly with the next steps.

Warm regards,
Kai Mapoy
CASK Construction`,
          },
          PR6e: {
            subject: `Flag Meeting Recap — [Client Name] [Project Type] Project`,
            body: `Hi [Customer Name],

Thank you for joining us for the on-site flag meeting at your [Location] property.

Here is a summary of what we covered:
- Reviewed and confirmed property boundaries and setbacks
- Discussed placement and orientation of the [Project Type]
- Aligned on any site-specific considerations

We will follow up with the next steps as we move into the design phase.

Warm regards,
Kai Mapoy
CASK Construction`,
          },
        }

        const GENERAL_EMAIL_TEMPLATE = `Hi [Customer Name],

Thank you for your continued partnership with CASK Construction on your [Project Type] project in [Location].

Following our recent meeting, we wanted to follow up with the next steps and keep things moving smoothly on your project.

Please don't hesitate to reach out if you have any questions.

Warm regards,
Kai Mapoy
CASK Construction`

        // Meeting titles for subject generation (fallback for unlisted codes)
        const EMAIL_TITLES: Record<string, string> = {
          PR2e: 'Initial Alignment Scheduling',
          PR4e: 'Alignment Meeting Recap',
          PR6e: 'Flag Meeting Recap',
          PD2e: '50% Floorplan Meeting Recap',
          PD5e: '75% Floorplan Meeting Recap',
          PS3e: 'Post 1st Selections Meeting Recap',
          PS5e: 'Post 2nd Selections Meeting Recap',
          PS7e: 'Post 3rd Selections Meeting Recap',
          PS9e: 'Post 4th Selections Meeting Recap',
          PB3e: 'Project Out to Bid',
          PB6e: 'Contract Approval',
          CG2e: 'Kickoff Meeting Recap',
          CG4e: 'Foundation and Slab Meeting Recap',
          CS3e: 'Structure Complete Celebration Recap',
          CR2e: 'Release to Hang',
          CF2e: 'Finish Stage Meeting Recap',
          CC3e: 'Punch List Walkthrough Recap',
        }

        const nextEmailCode = MEETING_TO_EMAIL[meetingCode]
        if (nextEmailCode) {
          try {
            const { data: clientFull } = await supabase
              .from('clients')
              .select('email, project_type, project_value, location, communication_style, personality_tags, owner')
              .eq('id', matchedClient.id)
              .single()

            const projectType     = clientFull?.project_type ?? 'ADU'
            const location        = clientFull?.location ?? 'St. Petersburg, FL'
            const owner           = clientFull?.owner ?? 'your Project Manager'
            const projectValue    = clientFull?.project_value ? `$${Number(clientFull.project_value).toLocaleString('en-US')}` : 'Not specified'
            const personalityStr  = Array.isArray(clientFull?.personality_tags)
              ? (clientFull.personality_tags as string[]).join(', ')
              : 'Not specified'
            const clientFirstName = matchedClient.name.split(' ')[0]

            // Format meeting data for prompt
            const attendeesList = Array.isArray(extracted.attendees)
              ? (extracted.attendees as string[]).join(', ')
              : (transcript.meeting_attendees ?? []).map((a: { displayName: string }) => a.displayName).join(', ') || 'Not recorded'

            const summaryText = Array.isArray(extracted.summary)
              ? (extracted.summary as string[]).join('\n')
              : String(extracted.summary ?? 'No summary available')

            const decisionsText = Array.isArray(extracted.key_decisions) && (extracted.key_decisions as string[]).length > 0
              ? (extracted.key_decisions as string[]).join('\n')
              : 'None recorded'

            const actionItemsText = Array.isArray(extracted.action_items) && (extracted.action_items as Array<{ task: string; owner: string }>).length > 0
              ? (extracted.action_items as Array<{ task: string; owner: string }>)
                  .map(a => `${a.task} — ${a.owner}`)
                  .join('\n')
              : 'None recorded'

            // Pick template — specific for PR2e/PR4e/PR6e, general for everything else
            const tmpl = EMAIL_TEMPLATES[nextEmailCode]
            const templateBody = tmpl?.body ?? GENERAL_EMAIL_TEMPLATE

            // Build subject per meeting code
            let subject: string
            if (nextEmailCode === 'PR2e') {
              subject = `Next Steps on Your ${projectType} Journey — Initial Alignment Meeting: ${matchedClient.name}`
            } else if (nextEmailCode === 'PR4e') {
              subject = `Alignment Meeting Recap — ${matchedClient.name} ${projectType} Project`
            } else if (nextEmailCode === 'PR6e') {
              subject = `CASK Construction Flag Meeting Recap — ${matchedClient.name} ${projectType}`
            } else {
              const meetingTitle = EMAIL_TITLES[nextEmailCode] ?? nextEmailCode
              subject = `${meetingTitle} — ${matchedClient.name} ${projectType} Project`
            }

            const emailPrompt = `You are drafting a professional client email for CASK Construction.
You have access to the full meeting data and client profile.

BASE TEMPLATE FOR THIS MEETING CODE (${nextEmailCode}):
${templateBody}

CLIENT PROFILE:
- Client Name: ${matchedClient.name}
- First Name: ${clientFirstName}
- Project Type: ${projectType}
- Location: ${location}
- Project Value: ${projectValue}
- Communication Style: ${clientFull?.communication_style ?? 'Not specified'}
- Personality Tags: ${personalityStr}
- Assigned PM: ${owner}

MEETING DATA:
- Meeting Code: ${meetingCode}
- Meeting Date: ${safeDate}
- Attendees: ${attendeesList}
- Summary: ${summaryText}
- Key Decisions: ${decisionsText}
- Action Items: ${actionItemsText}

INSTRUCTIONS:
Fill in every placeholder in the template with real data:

[Customer Name] → use client first name only: ${clientFirstName}
[Project Type] → use: ${projectType}
[Project Name] → use: ${matchedClient.name} ${projectType}
[PM Name] → use: ${owner}
[Location] → use: ${location}
[Attendee 1], [Attendee 2] etc → use meeting attendees: ${attendeesList}
[Recap item 1], [Recap item 2] etc → use meeting summary bullets
[Action item 1], [Action item 2] etc → use meeting action items, format each as: Task description — Owner Name
[Agenda item 1] etc → suggest relevant next steps based on current phase and what was discussed
[Option 1: Day, Time] etc → write exactly: We will follow up shortly with available time slots
NPS SURVEY LINK → write: https://caskconstruction.com/nps-survey

TONE RULES:
- Direct/Fast decision maker = concise, no fluff
- Detail-oriented/Analytical = keep all details and structure
- Relationship-driven = warm and personal tone
- Skeptical = factual, professional, no overselling
- Default = professional and friendly
Current client personality: ${personalityStr}

OUTPUT RULES:
- Plain text only
- No markdown
- No ** bold **
- No bullet symbols like bullet or dash
- Use clean line breaks between sections
- Keep all section headers from the template (ATTENDEES, RECAP, ACTION ITEMS etc)
- Replace every single placeholder — never leave [brackets] in the final email
- Return ONLY the email body
- No subject line in the body
- No preamble or explanation`

            const emailRes = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              messages: [{ role: 'user', content: emailPrompt }],
              max_tokens: 1200,
            })

            const emailBody = emailRes.content[0].type === 'text' ? emailRes.content[0].text.trim() : ''

            if (emailBody) {
              const { error: draftErr } = await supabase
                .from('client_email_drafts')
                .insert({
                  client_id:       matchedClient.id,
                  meeting_id:      nextEmailCode,
                  email_code:      nextEmailCode,
                  subject,
                  body:            emailBody,
                  status:          'draft',
                  recipient_email: clientFull?.email ?? null,
                  recipient_name:  matchedClient.name,
                })

              if (draftErr) {
                console.error('[fireflies] email draft insert error:', draftErr.message)
              } else {
                console.log('[fireflies] email draft generated:', matchedClient.name, '/', nextEmailCode)
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
