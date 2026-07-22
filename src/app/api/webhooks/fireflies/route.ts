import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AGENDAS, type AgendaContent, type AgendaItem } from '@/app/(app)/customers/_agendaData'

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

ACTION ITEMS EXTRACTION RULES:
- Read the full transcript carefully
- Extract EVERY explicit commitment made
- Look for phrases like:
  "I will...", "I'll...", "We need to...",
  "Can you...", "Please...", "I'll follow up...",
  "Let me...", "I'm going to..."
- Assign the correct owner based on who
  made the commitment
- If deadline is mentioned include it
- Include implied action items when someone
  clearly agrees to do something
- Never leave action_items empty if commitments
  were made in the transcript

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

// ── Email template helpers ──────────────────────────────────────────────────
// Email templates live in the shared _agendaData.ts module (the same single
// source of truth the Client Templates page renders). Each email code's entry
// is structured agenda content; we flatten it to a plain-text base that Claude
// personalizes, and pull the subject line from its EMAIL DETAILS section.

function flattenAgendaItems(items: (string | AgendaItem)[], numbered?: boolean): string {
  return items
    .map((item, i) => {
      const isObj = typeof item === 'object'
      const text = isObj ? item.text : item
      const marker = numbered ? `${i + 1}. ` : ''
      let line = `${marker}${text}`
      if (isObj && item.sub?.length) {
        line += '\n' + item.sub.map(s => `   - ${s}`).join('\n')
      }
      return line
    })
    .join('\n')
}

function agendaToEmailTemplate(content: AgendaContent): { subject: string | null; body: string } {
  let subject: string | null = null
  const parts: string[] = []
  for (const section of content.sections) {
    if (section.title === 'EMAIL DETAILS') {
      for (const item of section.items) {
        const text = typeof item === 'string' ? item : item.text
        const m = text.match(/^\s*Subject:\s*(.+)$/i)
        if (m) subject = m[1].trim()
      }
      continue // metadata — becomes the subject, not body content
    }
    const text = flattenAgendaItems(section.items, section.numbered)
    parts.push(section.title && section.title !== 'EMAIL BODY' ? `${section.title}\n${text}` : text)
  }
  return { subject, body: parts.join('\n\n') }
}

// Human meeting title from a template header ("PR4e — Alignment Meeting Recap to Customer")
function emailTitleFromCode(code: string): string {
  const header = AGENDAS[code]?.header
  if (!header) return code
  const parts = header.split(' — ')
  return parts.length > 1 ? parts.slice(1).join(' — ') : header
}

// Subject = template subject (project-name placeholders filled) + client project name appended
function buildEmailSubject(code: string, templateSubject: string | null, clientName: string, projectType: string): string {
  const projectName = `${clientName} ${projectType}`.trim()
  let base = (templateSubject ?? emailTitleFromCode(code)).trim()
  base = base
    .replace(/\[PROJECT NAME\]/gi, projectName)
    .replace(/\((?:INCLUDE\s+)?PROJECT NAME\)/gi, '')
    .replace(/\[INCLUDE PROJECT NAME\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[–—-]\s*$/, '')
    .trim()
  if (base.toLowerCase().endsWith(projectName.toLowerCase())) return base
  return `${base} — ${projectName}`
}

// Fallback when an email code has no specific template in _agendaData.ts
const GENERAL_EMAIL_TEMPLATE = `Hi [Customer Name],

Thank you for your continued partnership with CASK Construction on your [Project Type] project in [Location].

Following our recent meeting, we wanted to follow up with the next steps and keep things moving smoothly on your project.

Please don't hesitate to reach out if you have any questions.

Warm regards,
[Your Name]
CASK Construction`

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
      max_tokens: 4000,
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

    // 4. Save to Supabase using service role key (bypasses RLS)
    const supabase = createClient()

    // Validate extracted date — Claude sometimes hallucinates the wrong year
    const rawDate: string = (extracted.date as string) ?? meetingDate
    const extractedYear = new Date(rawDate).getFullYear()
    const currentYear = new Date().getFullYear()
    const safeDate = (!rawDate || isNaN(extractedYear) || extractedYear < currentYear)
      ? today
      : rawDate

    // 5. Try to match transcript to a client journey meeting
    //    New format: "STEP04 Customer Alignment Meeting: John Smith" (or " — John Smith")
    //    Format 1 (legacy): "John Smith — PR1m — Internal Sales to Pre-Con Pass-Off"
    //    Format 2 (legacy): "PR1m Internal Sales to Pre-Con Pass-Off: John Smith"
    const rawTitle = transcript.title ?? ''

    let candidateClientName: string | null = null
    let meetingCode: string | null = null

    // New format: STEP[number] Meeting Name: Client Name
    //   e.g. "STEP01 Internal Sales to Precon Pass-Off: John Smith"
    //   Uses the LAST colon as the separator so hyphens in the meeting name
    //   (e.g. "Pass-Off") are not mistaken for the delimiter.
    const stepMatch = rawTitle.match(/^STEP(\d+)\s+(.+):\s*([^:]+)$/)
    if (stepMatch) {
      meetingCode = `step_${stepMatch[1].padStart(2, '0')}`
      candidateClientName = stepMatch[3].trim()
    }

    // Format 1 (legacy fallback): split on " — ", client name first, code second
    if (!meetingCode) {
      const dashParts = rawTitle.split(' — ')
      if (dashParts.length >= 2) {
        const codeMatch1 = rawTitle.match(/\b(PR|PD|PP|PS|PB|CG|CS|CR|CF|CC)\d+(?:\.\d+)?[a-zA-Z](?:\.\d+)?\b/i)
        if (codeMatch1) {
          candidateClientName = dashParts[0].trim()
          meetingCode = codeMatch1[0]
        }
      }
    }

    // Format 2 (legacy fallback): "PR1m ... : Client Name" — code is first word, client name follows last ":"
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
      const { data: matchedClient, error: matchError } = await supabase
        .from('clients')
        .select('id, name, project_type, personality_tags, communication_style, key_interests, happiness, ai_tip')
        .ilike('name', `%${candidateClientName}%`)
        .maybeSingle()

      console.log('[fireflies] matchedClient:', matchedClient ?? 'NO MATCH', '| matchError:', matchError?.message ?? 'none')

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
          const currentHappinessLabel =
            matchedClient.happiness === 'green' ? 'Happy' :
            matchedClient.happiness === 'yellow' ? 'At Risk' :
            matchedClient.happiness === 'red' ? 'Needs Attention' : 'Not set'

          const profilePrompt = `You are analyzing a meeting transcript to update a client profile for CASK Construction.

CURRENT CLIENT PROFILE:
- Name: ${matchedClient.name}
- Project Type: ${(matchedClient.project_type as string) ?? 'Not set'}
- Current Personality Tags: ${Array.isArray(matchedClient.personality_tags) ? (matchedClient.personality_tags as string[]).join(', ') : 'None'}
- Current Communication Style: ${matchedClient.communication_style ?? 'Not set'}
- Current Key Interests: ${matchedClient.key_interests ?? 'Not set'}
- Current Happiness: ${currentHappinessLabel}

MEETING TRANSCRIPT SUMMARY:
${recapText || fullTranscript || '(no transcript)'}

Based on the transcript update the client profile.
Keep existing values if transcript doesn't contradict them.
Always generate real values — never return empty or "Not set".

Return ONLY this exact JSON with no markdown, no code blocks, no extra text:
{
  "personality_tags": ["tag1", "tag2"],
  "communication_style": "1-2 sentences about communication style",
  "key_interests": "what this client cares about",
  "how_to_communicate": "specific tips for the team",
  "happiness": "Happy" or "At Risk" or "Needs Attention",
  "ai_tip": "one sentence tip for next interaction"
}

RULES:
- personality_tags: only use tags from this list: Verbal communicator, Direct, Detail-oriented, Analytical, Visual learner, Budget-focused, Fast decision maker, Slow processor, Needs reassurance, Email communicator, Relationship-driven, Skeptical
- Keep existing personality tags unless the transcript clearly contradicts them
- communication_style: always write a real 1-2 sentence description, never "Not set"
- key_interests: always write what this client cares about, never empty
- happiness: must be exactly "Happy", "At Risk", or "Needs Attention" — no other values
- Return ONLY the JSON, no other text`

          const profileRes = await anthropic.messages.create({
            model: 'claude-opus-4-8',
            messages: [{ role: 'user', content: profilePrompt }],
            max_tokens: 700,
          })

          const profileRaw = profileRes.content[0].type === 'text'
            ? profileRes.content[0].text
              .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
            : ''
          console.log('[fireflies] profile Claude raw:', profileRaw.slice(0, 300))

          const profileData = extractJSON(profileRaw) as {
            personality_tags?: string[]
            communication_style?: string
            key_interests?: string
            happiness?: string
            how_to_communicate?: string
            ai_tip?: string
          }

          // Map happiness label back to DB value
          const happinessMap: Record<string, string> = {
            'Happy': 'green',
            'At Risk': 'yellow',
            'Needs Attention': 'red',
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
          }
          // ai_tip: prefer dedicated field, fall back to how_to_communicate
          const aiTipValue = profileData.ai_tip?.trim() || profileData.how_to_communicate?.trim()
          if (aiTipValue) {
            profileUpdate.ai_tip = aiTipValue
          }
          if (profileData.happiness && happinessMap[profileData.happiness]) {
            profileUpdate.happiness = happinessMap[profileData.happiness]
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

        // Maps each completed step code to the email code it should trigger.
        // null = no recap email for that step. (Typed string | null so the
        // null entries compile.)
        const MEETING_TO_EMAIL: Record<string, string | null> = {
          'step_01': 'step_05_email',
          'step_04': 'step_05_email',
          'step_07': 'step_08_email',
          'step_09': 'step_10_email',
          'step_12': 'step_13_email',
          'step_15': 'step_15_email',
          'step_18': null,
          'step_20': 'step_21_email',
          'step_23': null,
          'step_24': 'step_25_email',
          'step_27': 'step_28_email',
          'step_29': 'step_30_email',
          'step_32': null,
          'step_33': null,
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

            // Summary fallback if no recap text was captured
            const summaryText = Array.isArray(extracted.summary)
              ? (extracted.summary as string[]).join('\n')
              : String(extracted.summary ?? 'No summary available')

            // Pick the specific template for this email code from the shared template
            // data (single source of truth — same content as the Client Templates page).
            // Falls back to a general follow-up template for any code without an entry.
            const agenda = AGENDAS[nextEmailCode]
            const converted = agenda ? agendaToEmailTemplate(agenda) : null
            const templateBody = converted?.body ?? GENERAL_EMAIL_TEMPLATE
            const subject = buildEmailSubject(nextEmailCode, converted?.subject ?? null, matchedClient.name, projectType)

            const emailPrompt = `You are generating a professional meeting recap email for CASK Construction.

OBJECTIVE:
Generate a professional meeting recap email based on:
1. The meeting transcript provided below
2. The client profile information
3. Action items and decisions from the meeting

The email should communicate:
- What was discussed
- What decisions were made
- What information was added or changed
- What action items exist
- What happens next

Do NOT include internal team discussions or AI commentary.
Do NOT repeat every agenda line item.
Keep the email under 500 words.
Focus on changes, decisions, and next steps.
Write as if sending to all project stakeholders (homeowner, architect, estimator, project team).

CLIENT PROFILE:
- Client Name: ${matchedClient.name}
- First Name: ${clientFirstName}
- Project Type: ${projectType}
- Location: ${location}
- Project Value: ${projectValue}
- Communication Style: ${clientFull?.communication_style ?? 'Not specified'}
- Personality Tags: ${personalityStr}
- Assigned PM: ${owner}

MEETING TRANSCRIPT / NOTES:
${recapText || summaryText || 'No transcript available'}

EMAIL FORMAT — follow this exact structure:

Subject: ${subject}

Hello Team,

Thank you for today's meeting regarding ${matchedClient.name} ${projectType}.

Below is a summary of the discussion and next steps.

KEY DECISIONS MADE
Identify all decisions finalized during the meeting.
Only include items discussed and confirmed — do not list items that were not resolved.

PROJECT UPDATES
Summarize any new information added including:
- Project information updates
- Existing conditions or special conditions
- Design changes
- Scope clarifications
Keep concise and organized.

OPEN ITEMS / PENDING DECISIONS
List items requiring future discussion or approval.
Only include genuine open items — do not fabricate.

ACTION ITEMS
CASK Team:
- [Task] – [Owner]

Client / Homeowner:
- [Task]

NEXT STEPS
Summarize the next phase of the project. Examples:
- Schedule plumbing survey
- Complete Flag Meeting
- Update drawings
- Submit permit package

UPCOMING MEETING
Next Meeting: [Meeting Type] [Date] — if mentioned in the transcript, otherwise omit this line.

Thank you,
CASK Construction

AI RULES:
1. Compare transcript against known agenda items.
2. Identify decisions made during the meeting.
3. Identify newly added information.
4. Identify unresolved items.
5. Identify action items and owners.
6. Summarize in professional language.
7. Keep email under 500 words.
8. Do not repeat every agenda line item.
9. Focus on changes, decisions, and next steps.
10. Adjust tone based on client personality: Direct/Fast decision maker = concise. Detail-oriented = thorough. Relationship-driven = warmer tone. Skeptical = factual and professional.

OUTPUT FORMAT:
Clean HTML only:
- <p> for paragraphs
- <ol><li> for numbered lists
- <ul><li> for bullet points
- <strong> for section headers
- No markdown symbols
- No backtick wrappers
- No bracket placeholders left unfilled
Return ONLY the email body HTML. No subject line in the body.`

            const emailRes = await anthropic.messages.create({
              model: 'claude-opus-4-8',
              messages: [{ role: 'user', content: emailPrompt }],
              max_tokens: 1200,
            })

            let emailBody = emailRes.content[0].type === 'text' ? emailRes.content[0].text.trim() : ''
            emailBody = emailBody
              .replace(/^```html\n?/, '')
              .replace(/^```\n?/, '')
              .replace(/\n?```$/, '')
              .trim()

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

    // 6. No client match — guard: skip sessions insert if Claude extracted insufficient content
    const hasMeaningfulContent =
      extracted.summary &&
      (extracted.summary as string[]).length > 0 &&
      (extracted.summary as string[])[0].length > 10

    if (!hasMeaningfulContent) {
      console.log('[fireflies] skipping sessions save — insufficient content extracted for:', transcript.title)
      return NextResponse.json({ success: true, message: 'Skipped — insufficient content extracted' })
    }

    // No client match — save to meetings table as normal (ActionCoach session)
    // Use the original Fireflies calendar/meeting title, not Claude's generated one
    const sessionTitle = transcript.title ?? (extracted.title as string) ?? 'Untitled Meeting'

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

    // ── 7. Mirror the meeting into hub_memory for Big Vision agents ──────
    // Tags come from (a) leader attendees and (b) strategic-topic keywords in the
    // title/transcript. Reuses the SAME `supabase` service-role client above. Fully
    // isolated in its own try/catch so any failure here can't affect the meetings
    // save above or the webhook response. Variables reused from the existing code:
    //   fullTranscript (plain text), transcript.meeting_attendees, sessionTitle, meeting_id.
    try {
      const ATTENDEE_TAG_MAP: Record<string, string> = {
        'j.azcona@caskconstruction.com': 'jeff',
        'l.gilyot@caskconstruction.com': 'lamont',
        'c.holman@caskconstruction.com': 'chad',
        'm.carpani@caskconstruction.com': 'matteo',
        'k.grunenberg@caskconstruction.com': 'kaitlyn',
      }
      // NOTE: Unlike the migrate route (which matches meetings.attendees first-name
      // strings, where Kaitlyn appears as "Kait"), this webhook matches attendees by
      // EMAIL. Kaitlyn is already reliably tagged via her k.grunenberg@ address
      // regardless of display name, so no "Kait" first-name fix is needed here.

      // These attend everything — presence shouldn't tag the meeting.
      const SKIP_ATTENDEES = [
        'c.noonan@caskconstruction.com',
        'k.mapoy@caskconstruction.com',
        'r.alimpoos@caskconstruction.com',
      ]

      // Fireflies sends attendees as { displayName, email } on transcript.meeting_attendees.
      const attendeeTags: string[] = (transcript.meeting_attendees ?? [])
        .map((a: { email?: string }) => a.email?.toLowerCase().trim())
        .filter(
          (email: string | undefined): email is string =>
            !!email && !SKIP_ATTENDEES.includes(email) && !!ATTENDEE_TAG_MAP[email],
        )
        .map((email: string) => ATTENDEE_TAG_MAP[email])

      // Keyword tags from title + transcript text.
      const titleText = (sessionTitle ?? '').toLowerCase()
      const transcriptText = (fullTranscript ?? '').toLowerCase()
      const fullText = `${titleText} ${transcriptText}`

      // NOTE: design_center is handled separately below (needs specific context),
      // so it's intentionally not in this generic substring-matched map.
      const KEYWORD_TAG_MAP: Array<{ keywords: string[]; tag: string }> = [
        { keywords: ['ai hub', 'ai-hub', 'aihub', 'hub rollout'], tag: 'ai_hub' },
        { keywords: ['pit', 'process improvement', 'process improvement team'], tag: 'pit' },
        {
          keywords: ['department alignment', 'dept alignment', 'dev plan', 'development plan', 'personal plan'],
          tag: 'alignment',
        },
      ]

      // Short single-word keywords (≤4 chars, e.g. 'pit') use word-boundary
      // matching so they don't match inside longer words ("hospital", "capital").
      // Longer / multi-word keywords are distinctive enough for a substring check.
      const matchesKeyword = (kw: string): boolean => {
        if (kw.length <= 4) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return new RegExp(`\\b${escaped}\\b`, 'i').test(fullText)
        }
        return fullText.includes(kw)
      }

      const keywordTags = KEYWORD_TAG_MAP
        .filter(({ keywords }) => keywords.some(matchesKeyword))
        .map(({ tag }) => tag)

      // design_center: require specific context so incidental "design center"
      // mentions don't over-tag (matches the migrate route's tightened rule). A
      // "Design Center:" title prefix always qualifies, and 'website' is a qualifier.
      if (
        titleText.startsWith('design center') ||
        (/\bdesign center\b/i.test(fullText) &&
          (fullText.includes('design center launch') ||
            fullText.includes('design center rollout') ||
            fullText.includes('design center timeline') ||
            fullText.includes('design center meeting') ||
            fullText.includes('design center update') ||
            fullText.includes('design center brand') ||
            fullText.includes('design center concept') ||
            fullText.includes('design center website') ||
            /\bdesign center\b.{0,50}\b(launch|rollout|timeline|brand|concept|2027|website)\b/i.test(fullText)))
      ) {
        keywordTags.push('design_center')
      }

      // De-duplicate the combined tag set. (Array.from — not [...set] — so it
      // compiles regardless of the project's TS target/downlevelIteration setting.)
      const allTags = Array.from(new Set([...attendeeTags, ...keywordTags]))

      if (allTags.length > 0) {
        const truncatedTranscript = (fullTranscript ?? '').slice(0, 20000)

        const { error: hubErr } = await supabase.from('hub_memory').insert({
          title: sessionTitle || 'Untitled Meeting',
          content: truncatedTranscript,
          categories: allTags,
          layer: 4,
          source_type: 'fireflies',
          source_ref: meeting_id || null,
          leader: attendeeTags.length === 1 ? attendeeTags[0] : null,
          created_by: 'fireflies-webhook',
          is_active: true,
        })

        if (hubErr) {
          console.error('[fireflies] hub_memory insert error:', hubErr.message)
        } else {
          console.log('[fireflies] hub_memory insert:', sessionTitle, 'tags:', allTags)
        }
      } else {
        console.log('[fireflies] no tags matched, skipping hub_memory insert:', sessionTitle)
      }
    } catch (hubErr) {
      const msg = hubErr instanceof Error ? hubErr.message : String(hubErr)
      console.error('[fireflies] hub_memory insert failed (non-fatal):', msg)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[fireflies] unhandled webhook error:', msg, err)
  }

  return ok
}
