-- ============================================
-- EREDIVISIE TEST MODE
-- Early app testing system for live predictions
-- Admin can enable/disable with one click
-- ============================================

-- 1. User predictions table for Eredivisie test matches
CREATE TABLE IF NOT EXISTS user_predictions_eredivisie (
    user_id UUID REFERENCES profiles(id),
    match_id TEXT NOT NULL,
    pred_home_goals INTEGER,
    pred_away_goals INTEGER,
    pts_earned INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, match_id)
);

ALTER TABLE user_predictions_eredivisie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own eredivisie predictions" ON user_predictions_eredivisie;
CREATE POLICY "Users can manage own eredivisie predictions"
ON user_predictions_eredivisie FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Official Eredivisie results (admin fills manually for now)
CREATE TABLE IF NOT EXISTS official_eredivisie (
    match_id TEXT PRIMARY KEY,
    home_goals INTEGER,
    away_goals INTEGER,
    status TEXT NOT NULL DEFAULT 'NOT_PLAYED',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE official_eredivisie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read official eredivisie" ON official_eredivisie;
CREATE POLICY "Public read official eredivisie" ON official_eredivisie FOR SELECT USING (true);

DROP POLICY IF EXISTS "Master can write eredivisie results" ON official_eredivisie;
CREATE POLICY "Master can write eredivisie results" ON official_eredivisie FOR ALL
USING ((SELECT is_master FROM profiles WHERE id = auth.uid()))
WITH CHECK ((SELECT is_master FROM profiles WHERE id = auth.uid()));

-- 3. Config flag to enable/disable test mode
INSERT INTO config (key, value) VALUES ('eredivisie_test_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE user_predictions_eredivisie IS 'User predictions for Eredivisie test matches (matchdays 33-34)';
COMMENT ON TABLE official_eredivisie IS 'Admin-entered official results for Eredivisie test matches';
