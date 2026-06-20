-- Migration: Sales & Marketing Command Center dashboard tables
-- Backs the live dashboard on /command-center/sales. All tables default to the
-- Q2-2026 period and are readable/insertable by authenticated users (RLS).

CREATE TABLE IF NOT EXISTS sales_kpi_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric TEXT NOT NULL,
  actual NUMERIC,
  target NUMERIC,
  period TEXT DEFAULT 'Q2-2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_hot_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_name TEXT NOT NULL,
  project_type TEXT,
  proposal_amount NUMERIC DEFAULT 0,
  days_since_meeting INTEGER,
  status TEXT DEFAULT 'Hot Lead',
  period TEXT DEFAULT 'Q2-2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL,
  actual_pct NUMERIC,
  target_pct NUMERIC,
  period TEXT DEFAULT 'Q2-2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_funnel_120 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL,
  rolling_actual INTEGER,
  rolling_target INTEGER,
  rolling_pct NUMERIC,
  avg_days INTEGER,
  period TEXT DEFAULT 'Q2-2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_lead_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  count INTEGER,
  pct NUMERIC,
  period TEXT DEFAULT 'Q2-2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_kpi_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_hot_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_funnel_120 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read sales_kpi_data" ON sales_kpi_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales_kpi_data" ON sales_kpi_data FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth read sales_hot_list" ON sales_hot_list FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales_hot_list" ON sales_hot_list FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth read sales_conversions" ON sales_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales_conversions" ON sales_conversions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth read sales_funnel_120" ON sales_funnel_120 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales_funnel_120" ON sales_funnel_120 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth read sales_lead_sources" ON sales_lead_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert sales_lead_sources" ON sales_lead_sources FOR INSERT TO authenticated WITH CHECK (true);
