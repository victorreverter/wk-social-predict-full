-- ============================================
-- AUDIT LOG TABLE for security/compliance
-- ============================================
-- Tracks all manual admin lock/unlock actions.

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  match_id TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_at timestamptz DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error_message TEXT
);

COMMENT ON TABLE audit_log IS 'Security audit log for admin lock/unlock actions';

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(performed_by, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_match ON audit_log(match_id, performed_at DESC);

-- RLS: only master users can read audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can read audit log"
ON audit_log FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_master = true));

COMMENT ON POLICY "Masters can read audit log" ON audit_log IS 'Only master admin users can view audit trail';
