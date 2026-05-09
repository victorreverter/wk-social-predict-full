-- ============================================
-- FOOTBALL-DATA.ORG API INTEGRATION
-- Secure API key storage + config flag
-- ============================================

-- 1. Config table for feature flags (if not exists)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage config" ON app_config;
CREATE POLICY "Admin can manage config"
ON app_config FOR ALL
USING ((SELECT is_master FROM profiles WHERE id = auth.uid()));

-- 2. Config flags for football-data.org integration
INSERT INTO app_config (key, value)
VALUES ('football_data_api_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('football_data_api_test_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. API request log table (for monitoring/rate-limit tracking)
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
