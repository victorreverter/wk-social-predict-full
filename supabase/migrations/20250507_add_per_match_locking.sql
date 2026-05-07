-- ============================================
-- PER-MATCH AUTO-LOCKING SYSTEM - PRODUCTION
-- ============================================
-- Each match locks 1 hour before kickoff via pg_cron.
-- Admin can manually lock/unlock but CANNOT unlock
-- within the 1-hour automatic window (time lock is supreme).

-- 1. Schema Changes
ALTER TABLE official_matches ADD COLUMN IF NOT EXISTS locked_at timestamptz;
COMMENT ON COLUMN official_matches.locked_at IS 'Timestamp when match was locked (1hr before kickoff or manual admin lock)';

-- 2. Core lock check function (1-hour window)
CREATE OR REPLACE FUNCTION should_match_be_locked(match_date timestamptz)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOW() >= (match_date - interval '1 hour');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION should_match_be_locked(timestamptz) IS 'Returns true if current time is within 1 hour of match kickoff';

-- 3. Auto-lock scheduler function (called by pg_cron every minute)
CREATE OR REPLACE FUNCTION auto_lock_upcoming_matches()
RETURNS INTEGER AS $$
DECLARE
  locked_count INTEGER := 0;
BEGIN
  UPDATE official_matches
  SET locked_at = NOW()
  WHERE should_match_be_locked(date)
    AND locked_at IS NULL
    AND date > NOW() - interval '5 hours'
    AND date IS NOT NULL;

  GET DIAGNOSTICS locked_count = ROW_COUNT;
  RETURN locked_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in auto_lock_upcoming_matches: %', SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_lock_upcoming_matches() IS 'Automatically locks matches 1 hour before kickoff';

-- 4. Admin manual lock/unlock with 1-hour supreme rule
CREATE OR REPLACE FUNCTION set_match_lock(match_id TEXT, lock_state BOOLEAN)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  match_record official_matches%ROWTYPE;
BEGIN
  SELECT * INTO match_record FROM official_matches WHERE id = match_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Match not found';
    RETURN;
  END IF;

  -- SUPREME RULE: cannot unlock within 1-hour automatic window
  IF NOT lock_state AND should_match_be_locked(match_record.date) THEN
    INSERT INTO audit_log (action, match_id, performed_by, performed_at, success, error_message)
    VALUES ('MANUAL_UNLOCK_ATTEMPT', match_id, auth.uid(), NOW(), FALSE,
            'Blocked: match is within 1-hour automatic lock window');
    RETURN QUERY SELECT FALSE, 'Cannot unlock: match is within 1-hour automatic lock window';
    RETURN;
  END IF;

  IF lock_state THEN
    IF match_record.locked_at IS NULL THEN
      UPDATE official_matches SET locked_at = NOW() WHERE id = match_id;
      INSERT INTO audit_log (action, match_id, performed_by, performed_at, success)
      VALUES ('MANUAL_LOCK', match_id, auth.uid(), NOW(), TRUE);
      RETURN QUERY SELECT TRUE, 'Match manually locked';
    ELSE
      RETURN QUERY SELECT TRUE, 'Match was already locked';
    END IF;
  ELSE
    IF match_record.locked_at IS NOT NULL THEN
      UPDATE official_matches SET locked_at = NULL WHERE id = match_id;
      INSERT INTO audit_log (action, match_id, performed_by, performed_at, success)
      VALUES ('MANUAL_UNLOCK', match_id, auth.uid(), NOW(), TRUE);
      RETURN QUERY SELECT TRUE, 'Match manually unlocked';
    ELSE
      RETURN QUERY SELECT TRUE, 'Match was already unlocked';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_match_lock(TEXT, BOOLEAN) IS 'Admin manual lock/unlock. Cannot unlock within 1-hour automatic window';

-- 5. Helper: get lock status for frontend display
CREATE OR REPLACE FUNCTION get_match_lock_status(match_id_param TEXT)
RETURNS TABLE(id TEXT, date timestamptz, is_locked BOOLEAN, time_until_lock interval, lock_reason TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.id, om.date,
    (om.locked_at IS NOT NULL OR should_match_be_locked(om.date)) AS is_locked,
    (om.date - interval '1 hour' - NOW()) AS time_until_lock,
    CASE
      WHEN om.locked_at IS NOT NULL THEN 'Admin manual lock'
      WHEN should_match_be_locked(om.date) THEN 'Automatic (1 hour before kickoff)'
      ELSE 'Not locked'
    END AS lock_reason
  FROM official_matches om WHERE om.id = match_id_param;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_match_lock_status(TEXT) IS 'Returns lock status and countdown timer info for a specific match';

-- 6. RLS policy updates: enforce per-match locks server-side
DROP POLICY IF EXISTS "Users can insert predictions" ON user_predictions_matches;
DROP POLICY IF EXISTS "Users can update predictions" ON user_predictions_matches;

CREATE POLICY "Users can insert predictions"
ON user_predictions_matches FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM official_matches om
    WHERE om.match_id = user_predictions_matches.match_id
    AND (om.locked_at IS NOT NULL OR should_match_be_locked(om.date))
  )
);

CREATE POLICY "Users can update predictions"
ON user_predictions_matches FOR UPDATE
USING (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM official_matches om
    WHERE om.match_id = user_predictions_matches.match_id
    AND (om.locked_at IS NOT NULL OR should_match_be_locked(om.date))
  )
);

COMMENT ON POLICY "Users can insert predictions" ON user_predictions_matches IS 'Blocks inserts for locked matches (supreme time-lock rule)';
COMMENT ON POLICY "Users can update predictions" ON user_predictions_matches IS 'Blocks updates for locked matches (supreme time-lock rule)';

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_official_matches_auto_lock
ON official_matches(date, locked_at)
WHERE locked_at IS NULL AND date > NOW() - interval '5 hours';

CREATE INDEX IF NOT EXISTS idx_official_matches_lock_check
ON official_matches(match_id, date, locked_at);

-- 8. Run manually in Supabase SQL Editor after migration:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('auto-lock-matches', '* * * * *', 'SELECT auto_lock_upcoming_matches()');
-- SELECT * FROM cron.job;
