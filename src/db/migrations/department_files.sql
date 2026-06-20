-- Migration: cask_department_files
-- Per-department reference materials & reports for the Department Alignment sub-pages.
-- Files are stored in the existing 'cask-vision-docs' Supabase Storage bucket under
-- the path department/[department]/[timestamp]-[filename]; this table tracks metadata.

CREATE TABLE IF NOT EXISTS cask_department_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

ALTER TABLE cask_department_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read department files"
  ON cask_department_files FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert department files"
  ON cask_department_files FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete department files"
  ON cask_department_files FOR DELETE
  TO authenticated USING (true);
