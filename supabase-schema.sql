-- CASK Hub — Supabase Schema
-- Run this in your Supabase SQL editor first

-- ──────────────────────────────────────────────────────────
-- MEETINGS TABLE
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  time_start text,
  time_end text,
  attendees text[] DEFAULT '{}',
  summary text[] DEFAULT '{}',
  action_items jsonb DEFAULT '[]',  -- embedded copy for quick reads
  key_decisions text[] DEFAULT '{}',
  full_transcript text DEFAULT '',
  meeting_type text CHECK (meeting_type IN ('leadership', 'planning', 'coaching', 'education')),
  owner text,
  module text DEFAULT 'actioncoach',
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- ACTION ITEMS TABLE (normalized, for CRUD operations)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  task text NOT NULL,
  owner text NOT NULL,
  due_date date,
  done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- USERS TABLE
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  role text,
  avatar_initials text,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Enable RLS, but allow all for now (add auth policies later)
-- ──────────────────────────────────────────────────────────
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow all for now (tighten once Supabase Auth is set up)
CREATE POLICY "Allow all" ON meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON action_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- INDEXES for performance
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_done ON action_items(done);
CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items(due_date);
