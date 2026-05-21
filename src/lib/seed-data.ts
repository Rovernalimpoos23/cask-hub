// src/lib/seed-data.ts
// Real CASK Construction meeting data to seed into Supabase
// Run this once via the seed API route or Supabase SQL editor

import type { Meeting, ActionItem } from '@/types'

export const MEETINGS: Omit<Meeting, 'created_at'>[] = [
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000001',
    title: 'CASK Companies Leadership Meeting',
    date: '2026-02-27',
    time_start: '10:00 AM',
    time_end: '2:00 PM',
    attendees: ['Chad', 'Lamont', 'Matteo', 'Jeff', 'Kait', 'Juliet'],
    summary: [
      'Gallup Q12 education: 21% higher profitability in engaged teams — each leader reviewed their department\'s engagement data',
      'Individual deep dives: each leader shared their biggest win of the quarter and top challenges going into Q1 close',
      'Leadership brainstorm and prioritization session completed — top themes: communication clarity, accountability structures, and team recognition',
    ],
    action_items: [
      { id: 'ai-001-1', meeting_id: 'a1b2c3d4-0001-0001-0001-000000000001', task: 'Submit engagement survey feedback forms', owner: 'All Leaders', due_date: '2026-03-06', done: true },
      { id: 'ai-001-2', meeting_id: 'a1b2c3d4-0001-0001-0001-000000000001', task: 'Review Gallup Q12 results when available', owner: 'Kait', due_date: '2026-03-13', done: true },
      { id: 'ai-001-3', meeting_id: 'a1b2c3d4-0001-0001-0001-000000000001', task: 'Set 30-day goals per department head', owner: 'All Leaders', due_date: '2026-03-06', done: true },
    ],
    key_decisions: [
      'Gallup Q12 to become a quarterly measurement tool for CASK',
      'Each VP to own one team health metric going into Q2',
    ],
    full_transcript: `JULIET: Good morning everyone. Let's start with WIFLE — what I feel like expressing. Who wants to go first?\n\nCHAD: I'm energized. We closed a strong month and the team is focused.\n\nLAMONT: Cautiously optimistic. Numbers look good but we have some Q2 planning to do.\n\nMATTEO: Ready to go. Operations has a lot of momentum right now.\n\nJEFF: Excited about some pipeline opportunities we'll talk about in updates.\n\nKAIT: Happy to be here. People side has some good news to share.\n\nJULIET: Great energy. Today we're starting with the Gallup Q12 framework — research shows teams with high engagement show 21% higher profitability. Let's look at what drives that...\n\n[Education segment: 45 minutes on Gallup Q12 framework, engagement drivers, and CASK-specific application]\n\nJULIET: Now let's move to individual deep dives. Each of you will share your biggest win and your biggest challenge. Chad, start us off.\n\nCHAD: Biggest win — we completed the Donegan project on time and under budget. Biggest challenge — we're stretched thin on qualified subs for Q2 pipeline.\n\n[Individual deep dives continued for each leader]\n\nJULIET: Excellent session. Let's capture our action items and commitments before we close.`,
    meeting_type: 'leadership',
    owner: 'chad',
    module: 'actioncoach',
  },
  {
    id: 'a1b2c3d4-0002-0002-0002-000000000002',
    title: 'Top 10 Stress & Energy Drivers Session',
    date: '2026-03-18',
    time_start: '2:00 PM',
    time_end: '4:00 PM',
    attendees: ['Calin', 'Chad'],
    summary: [
      'Research-backed stress and energy management strategies — 10 categories reviewed with high-impact, science-based examples from peak performance literature',
      'Focus areas: autonomy in decision-making, peer recognition systems, and psychological safety frameworks applicable to construction leadership',
      'Calin and Chad identified their personal top 3 stress drivers and committed to one structural change each to address them',
    ],
    action_items: [
      { id: 'ai-002-1', meeting_id: 'a1b2c3d4-0002-0002-0002-000000000002', task: 'Implement one structural change to reduce top stress driver', owner: 'Calin', due_date: '2026-04-01', done: true },
      { id: 'ai-002-2', meeting_id: 'a1b2c3d4-0002-0002-0002-000000000002', task: 'Implement one structural change to reduce top stress driver', owner: 'Chad', due_date: '2026-04-01', done: true },
    ],
    key_decisions: [
      'Recognition program to be formalized in Q2 — Kait to lead',
      'Weekly owner check-in rhythm to be protected on calendar',
    ],
    full_transcript: `JULIET: This session is focused on you two as owners. The data is clear — founder burnout is the #1 risk to scaling companies. Let's get ahead of it.\n\nCALIN: Yeah, I've been running at 100% for too long. I need systems, not just more hustle.\n\nCHAD: Same. I feel like I'm constantly in reactive mode.\n\nJULIET: That's exactly what we're going to address. Let's go through the 10 stress and energy drivers...\n\n[45-minute education segment covering autonomy, mastery, purpose, recognition, relationships, physical environment, workload balance, role clarity, psychological safety, and recovery systems]\n\nJULIET: Now — Calin, which two or three of these hit hardest for you personally?\n\nCALIN: Autonomy is the big one. I feel like I can't delegate enough because things come back to me anyway. And recovery — I'm not protecting any personal time.\n\nCHAD: For me it's role clarity at the owner level. Calin and I need to be clearer on who owns what so we stop doubling up or dropping things between us.`,
    meeting_type: 'education',
    owner: 'calin',
    module: 'actioncoach',
  },
  {
    id: 'a1b2c3d4-0003-0003-0003-000000000003',
    title: 'CASK Leadership Planning Q2 2026',
    date: '2026-03-27',
    time_start: '10:00 AM',
    time_end: '4:00 PM',
    attendees: ['Chad', 'Calin', 'Lamont', 'Matteo', 'Jeff', 'Kait', 'Tony'],
    summary: [
      'Revisited $10M → $20M growth roadmap and the "Road to $1B" long-term vision — each department\'s contribution to the $20M goal was defined and accepted',
      'Q2 KPI awareness session: each VP presented their department\'s lead and lag indicators, gaps were identified across Sales pipeline and Operations capacity',
      'DISC leadership styles education completed — team mapped their own profiles and explored how style differences affect communication and conflict',
    ],
    action_items: [
      { id: 'ai-003-1', meeting_id: 'a1b2c3d4-0003-0003-0003-000000000003', task: 'Submit Q2 PIT Goals before next session (May 28)', owner: 'All Leaders', due_date: '2026-05-14', done: false },
      { id: 'ai-003-2', meeting_id: 'a1b2c3d4-0003-0003-0003-000000000003', task: 'Complete DISC assessments and share results with Juliet', owner: 'All Leaders', due_date: '2026-04-10', done: true },
      { id: 'ai-003-3', meeting_id: 'a1b2c3d4-0003-0003-0003-000000000003', task: 'Prepare department KPI dashboards for May 28 review', owner: 'All Leaders', due_date: '2026-05-21', done: false },
    ],
    key_decisions: [
      '$20M is the official company revenue target for 2026',
      'Each VP owns one KPI that feeds directly into the $20M goal',
      'DISC profiles to be used in all future hiring and team communication training',
    ],
    full_transcript: `JULIET: Today is our big Q2 planning day. We're going to lock in priorities, KPIs, and make sure everyone is rowing in the same direction toward $20M.\n\nCALIN: Before we start — I want everyone to hear this clearly. $20M is not a stretch goal. It's the target. Everything we do this quarter has to connect back to it.\n\nCHAD: Agreed. And today we're going to make those connections explicit. No more vague goals.\n\nJULIET: Perfect. Let's start with the $10M to $20M growth review. Lamont, can you walk us through where we are financially?\n\nLAMONT: Sure. We closed Q1 at approximately $4.2M in revenue. To hit $20M we need roughly $15.8M in the next three quarters. That's aggressive but achievable if Sales delivers on the current pipeline.\n\nJEFF: Pipeline is strong. We have $8M in qualified opportunities right now. The question is conversion rate and timing.\n\n[Session continued through KPI reviews, DISC education, and Q2 planning exercises]`,
    meeting_type: 'planning',
    owner: 'chad',
    module: 'actioncoach',
  },
  {
    id: 'a1b2c3d4-0004-0004-0004-000000000004',
    title: 'Calin and Kai Coaching Session',
    date: '2026-04-02',
    time_start: '1:00 PM',
    time_end: '2:30 PM',
    attendees: ['Calin', 'Kai'],
    summary: [
      'President\'s Workflow reviewed and documented — Calin\'s daily, weekly, and monthly responsibilities mapped into a structured operating rhythm',
      'Leadership framework discussed — difference between working IN the business vs. ON the business clarified with concrete calendar blocking strategies',
      'Roles and responsibilities clarity session — Kai\'s scope as Executive Assistant formally expanded to include meeting capture, action item tracking, and communication routing',
    ],
    action_items: [
      { id: 'ai-004-1', meeting_id: 'a1b2c3d4-0004-0004-0004-000000000004', task: 'Document President\'s Workflow in SharePoint', owner: 'Kai', due_date: '2026-04-09', done: true },
      { id: 'ai-004-2', meeting_id: 'a1b2c3d4-0004-0004-0004-000000000004', task: 'Block CEO Focus Time on Calin\'s calendar (3x weekly)', owner: 'Kai', due_date: '2026-04-09', done: true },
    ],
    key_decisions: [
      'Kai will own all meeting logistics, prep, and follow-up for Calin going forward',
      'Calin to have protected "deep work" blocks every Tuesday and Thursday morning',
    ],
    full_transcript: `JULIET: Calin, this session is just you and Kai. We're going to map out how you work and how Kai can best support you. Ready?\n\nCALIN: Yes. I need this. I'm dropping things constantly because I don't have a real system.\n\nJULIET: Kai, you've been watching Calin operate for a while now. What's one thing you see him doing that he shouldn't be doing himself?\n\nKAI: Honestly? Email. He's answering emails that I could handle. And scheduling — he goes back and forth with people for days on meeting times.\n\nCALIN: That's true. I need to fully trust Kai with that stuff.\n\nJULIET: Great. Let's map out the full President's Workflow — daily, weekly, monthly. Then we'll identify everything that can be delegated to Kai.`,
    meeting_type: 'coaching',
    owner: 'calin',
    module: 'actioncoach',
  },
  {
    id: 'a1b2c3d4-0005-0005-0005-000000000005',
    title: 'Team Role, Standards and Growth',
    date: '2026-04-08',
    time_start: '2:00 PM',
    time_end: '4:00 PM',
    attendees: ['Calin', 'Chad', 'Lamont', 'Jeff', 'Kait', 'Matteo'],
    summary: [
      '3-part structure introduced: Clarity (knowing your role), Standards (knowing what good looks like), and Development (growing toward the next level)',
      'Role identity framework: each team member has a "role card" with their core responsibility, decision rights, and success metrics — exercise assigned for Q2',
      'Feedforward vs. feedback model discussed — shift from reviewing past performance to future-focused development conversations, with practice exercise completed',
    ],
    action_items: [
      { id: 'ai-005-1', meeting_id: 'a1b2c3d4-0005-0005-0005-000000000005', task: 'Complete "Role Card" exercise for your department', owner: 'All VPs', due_date: '2026-04-22', done: false },
      { id: 'ai-005-2', meeting_id: 'a1b2c3d4-0005-0005-0005-000000000005', task: 'Conduct one Feedforward conversation with a direct report', owner: 'All VPs', due_date: '2026-04-22', done: false },
    ],
    key_decisions: [
      'Role Cards to become standard onboarding document for all new CASK hires',
      'Feedforward replaces annual review as primary development tool at CASK',
    ],
    full_transcript: `JULIET: Today we're tackling one of the most common sources of dysfunction in growing companies — role clarity. When people don't know exactly what they own, things fall through the cracks.\n\nCHAD: We've felt that. Especially as we've grown from 10 to 25 people.\n\nJULIET: Exactly. So today's framework has three parts: Clarity, Standards, and Development. Let's start with Clarity.\n\n[Education segment on role clarity frameworks, accountability ladders, and decision rights]\n\nJULIET: Now the Feedforward concept. Instead of asking "what did you do wrong?" we ask "what could you do differently going forward?" It's subtle but the brain responds completely differently.\n\nKAIT: This is huge for HR. We spend so much time in the past. This reframe could change how we do performance conversations entirely.`,
    meeting_type: 'education',
    owner: 'chad',
    module: 'actioncoach',
  },
  {
    id: 'a1b2c3d4-0006-0006-0006-000000000006',
    title: 'CASK Leadership Meeting — April 2026',
    date: '2026-04-30',
    time_start: '11:00 AM',
    time_end: '3:00 PM',
    attendees: ['Calin', 'Chad', 'Lamont', 'Jeff', 'Matteo', 'Kait', 'Juliet'],
    summary: [
      '5 Dysfunctions of a Team (Lencioni) education completed — team self-assessed against all 5 levels, identified "fear of conflict" and "avoidance of accountability" as areas to work on',
      'Design Center long-term vision presented by Calin — a new strategic concept for a client-facing design and specification hub; Shannon, Jeff, and Calin as primary stakeholders',
      'Department updates: Operations (Matteo — sub capacity), Sales (Jeff — pipeline strong), Finance (Lamont — Q1 close clean), People (Kait — new hire pipeline)',
    ],
    action_items: [
      { id: 'ai-006-1', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Prepare May 28th agenda with brain dump from Juliette coaching session', owner: 'Calin + Kai', due_date: '2026-05-22', done: false },
      { id: 'ai-006-2', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Send prep email to Chad — review before sending to leadership team', owner: 'Kai', due_date: '2026-05-22', done: false },
      { id: 'ai-006-3', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Confirm Donegan Design Alignment meeting May 22', owner: 'Calin', due_date: '2026-05-22', done: false },
      { id: 'ai-006-4', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Set up Claude AI company account for the team', owner: 'Calin', due_date: '2026-05-20', done: false },
      { id: 'ai-006-5', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Complete IT onboarding setup for Rovern', owner: 'Kai', due_date: '2026-05-20', done: false },
      { id: 'ai-006-6', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Book Co-Construct onboarding call', owner: 'Rovern', due_date: '2026-05-23', done: false },
      { id: 'ai-006-7', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Include Rovern in all department meetings', owner: 'Kai', due_date: '2026-05-19', done: true },
      { id: 'ai-006-8', meeting_id: 'a1b2c3d4-0006-0006-0006-000000000006', task: 'Set up Rovern with Joseph for data systems onboarding', owner: 'Kai', due_date: '2026-05-19', done: true },
    ],
    key_decisions: [
      'Design Center concept approved for further development — Calin leading vision, Jeff leading commercial strategy',
      'CASK Hub (AI platform) greenlit — Rovern to build with full leadership support',
      'May 28 Leadership Meeting confirmed — Juliet facilitating',
    ],
    full_transcript: `JULIET: Good morning everyone. Let's open with WIFLE.\n\nCALIN: Excited. Big things happening. I have something new to share with the group today.\n\nCHAD: Focused. Lots of moving parts but the team is solid.\n\nLAMONT: Steady. Q1 closed clean. Happy to report that.\n\nJEFF: Pumped. Pipeline is the best it's been all year.\n\nMATTEO: Good. Operations is stretched but we're managing.\n\nKAIT: Grateful. We have some great people joining us.\n\nJULIET: Love that energy. Let's start with education — today we're going through Lencioni's 5 Dysfunctions of a Team. This is one of the most important frameworks for leadership teams...\n\n[45-minute education on 5 Dysfunctions: Absence of Trust, Fear of Conflict, Lack of Commitment, Avoidance of Accountability, Inattention to Results]\n\nJULIET: Now — which of these five does THIS team most need to work on?\n\nCALIN: Honestly? Conflict. We're too polite sometimes. We need to be able to disagree in the room.\n\nCHAD: Accountability too. We set commitments but the follow-through isn't always there.\n\nJULIET: Great self-awareness. That's exactly what we're going to build this year. Calin — you said you had something to share?\n\nCALIN: Yes. I want to introduce a concept I've been developing — the CASK Design Center. It's a long-term vision for how we engage clients in the design process...`,
    meeting_type: 'leadership',
    owner: 'calin',
    module: 'actioncoach',
  },
]

export const STANDALONE_ACTION_ITEMS: ActionItem[] = [
  // These are the "open action items" that appear on the dashboard
  // Most are from the Apr 30 meeting (id: ...0006) — already included above
]

// SQL to create the Supabase schema
export const SCHEMA_SQL = `
-- meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  time_start text,
  time_end text,
  attendees text[] DEFAULT '{}',
  summary text[] DEFAULT '{}',
  action_items jsonb DEFAULT '[]',
  key_decisions text[] DEFAULT '{}',
  full_transcript text DEFAULT '',
  meeting_type text CHECK (meeting_type IN ('leadership', 'planning', 'coaching', 'education')),
  owner text,
  module text DEFAULT 'actioncoach',
  created_at timestamptz DEFAULT now()
);

-- action_items table
CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  task text NOT NULL,
  owner text NOT NULL,
  due_date date,
  done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  role text,
  avatar_initials text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (tighten later with auth)
CREATE POLICY "Allow all" ON meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON action_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
`
