-- Fix: set_match_lock RPC with unambiguous parameter name
DROP FUNCTION IF EXISTS set_match_lock(TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION set_match_lock(p_match_id TEXT, lock_state BOOLEAN)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  match_record official_matches%ROWTYPE;
BEGIN
  SELECT * INTO match_record FROM official_matches WHERE match_id = p_match_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Match not found';
    RETURN;
  END IF;

  IF NOT lock_state AND should_match_be_locked(match_record.date) THEN
    RETURN QUERY SELECT FALSE, 'Cannot unlock: match is within 1-hour automatic lock window';
    RETURN;
  END IF;

  IF lock_state THEN
    IF match_record.locked_at IS NULL THEN
      UPDATE official_matches SET locked_at = NOW() WHERE match_id = p_match_id;
      RETURN QUERY SELECT TRUE, 'Match manually locked';
    ELSE
      RETURN QUERY SELECT TRUE, 'Match was already locked';
    END IF;
  ELSE
    IF match_record.locked_at IS NOT NULL THEN
      UPDATE official_matches SET locked_at = NULL WHERE match_id = p_match_id;
      RETURN QUERY SELECT TRUE, 'Match manually unlocked';
    ELSE
      RETURN QUERY SELECT TRUE, 'Match was already unlocked';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
