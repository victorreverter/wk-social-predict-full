-- ============================================================
-- 20260614_add_api_log_and_date_col.sql
-- Add missing football_data_api_log table (edge function crashes
-- without it) and missing date column on official_matches
-- (required by the per-match auto-locking system).
-- ============================================================

-- 1. API request log table (for monitoring / rate-limit tracking)
CREATE TABLE IF NOT EXISTS football_data_api_log (
    id BIGSERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    status_code INTEGER,
    response_ms INTEGER,
    request_quota INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE football_data_api_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read API logs" ON football_data_api_log;
CREATE POLICY "Admin can read API logs"
ON football_data_api_log FOR SELECT
USING ((SELECT is_master FROM profiles WHERE id = auth.uid()));

-- 2. date column needed by per-match auto-locking functions
ALTER TABLE official_matches ADD COLUMN IF NOT EXISTS date timestamptz;
