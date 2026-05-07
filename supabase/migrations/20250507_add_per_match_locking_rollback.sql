-- ============================================
-- ROLLBACK: Per-Match Auto-Locking System
-- ============================================
-- Run this in Supabase SQL Editor to revert the locking migration.

-- 1. Remove pg_cron job
DO $$
BEGIN
  PERFORM cron.unschedule('auto-lock-matches');
EXCEPTION
  WHEN OTHERS THEN RAISE NOTICE 'cron job may not exist, continuing...';
END $$;

-- 2. Drop new policies
DROP POLICY IF EXISTS "Users can insert predictions" ON user_predictions_matches;
DROP POLICY IF EXISTS "Users can update predictions" ON user_predictions_matches;

-- Restore original policies
CREATE POLICY "Users can insert own predictions"
ON user_predictions_matches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions"
ON user_predictions_matches FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Drop new functions (use CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS get_match_lock_status(TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_match_lock(TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS auto_lock_upcoming_matches() CASCADE;
DROP FUNCTION IF EXISTS should_match_be_locked(timestamptz) CASCADE;

-- 4. Drop indexes
DROP INDEX IF EXISTS idx_official_matches_auto_lock;
DROP INDEX IF EXISTS idx_official_matches_lock_check;

-- 5. Remove locked_at column
ALTER TABLE official_matches DROP COLUMN IF EXISTS locked_at;

-- 6. Audit log table is kept for historical reference (drop manually if needed):
-- DROP TABLE IF EXISTS audit_log;
