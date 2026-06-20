-- Seed: Sales & Marketing dashboard (Q2-2026) — sourced from Jeff Azcona's KPI tracker.
-- Run after sales_kpi_data.sql. Safe to re-run only on a fresh DB; re-running will
-- duplicate rows since there is no unique constraint on the natural keys.

INSERT INTO sales_kpi_data (metric, actual, target) VALUES
('Inquiries', 175, 200),
('In-Person Meetings', 40, 40),
('2nd Meetings', 29, 30),
('Pre-Con Signed', 12, 12),
('Sales NPS', 0, 2),
('Referrals Out', 17, 30);

INSERT INTO sales_hot_list (prospect_name, project_type, proposal_amount, days_since_meeting) VALUES
('Erce Phillips', 'ADU', 215000, 36),
('Cainaan & Gabriella Lacy', 'ADU', 260000, 50),
('Luis Beaumier', 'New Garage (Detached)', 123625, 29),
('Lindsay Cotto', 'ADU', 240000, 9),
('Sean McCurdy', 'ADU', 0, 3),
('Sue Hoatson', 'ADU', 260000, -4);

INSERT INTO sales_conversions (stage, actual_pct, target_pct) VALUES
('Lead to Contact Made', 81.71, 75.00),
('Lead to In-Person Meeting', 22.86, 20.00),
('Lead to Pre-Con', 6.86, 7.50),
('In-Person Meeting to Pre-Con', 30.00, 37.50),
('1st Meeting to 2nd Meeting', 72.50, 75.00),
('2nd In-Person to Pre-Con', 41.38, 50.00);

INSERT INTO sales_funnel_120 (stage, rolling_actual, rolling_target, rolling_pct, avg_days) VALUES
('Inquiries', 260, 267, 98, null),
('Ideal Leads', 151, 160, 94, null),
('Contact Made', 203, 200, 102, 60),
('1st In-Person', 52, 53, 98, 52),
('2nd In-Person', 32, 40, 80, 56),
('Pre-Con', 15, 20, 75, 62);

INSERT INTO sales_lead_sources (source, count, pct) VALUES
('Google', 72, 33),
('Other', 88, 41),
('Referral', 21, 10),
('Signage', 16, 7),
('Flyer', 9, 4),
('Facebook', 4, 2),
('Instagram', 3, 1),
('Print Ad', 2, 1);
