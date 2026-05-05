-- ============================================================
-- Per-Category Prediction Locks
-- Replaces single global lock with 4 independent locks:
--   GROUP_STAGE   — locks group match predictions (m1-m72)
--   BRACKET       — locks knockout match predictions (m73-m104)
--   AWARDS        — locks award predictions
--   TOURNAMENT_XI — locks tournament XI predictions
-- Run ONCE in Supabase SQL Editor
-- ============================================================

-- ── Create lock_config table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lock_config (
  key        text PRIMARY KEY,
  locked_at  timestamptz,
  locked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── Insert initial unlocked values ──────────────────────────
INSERT INTO public.lock_config (key, locked_at, locked_by)
VALUES
  ('GROUP_STAGE',    NULL, NULL),
  ('BRACKET',        NULL, NULL),
  ('AWARDS',         NULL, NULL),
  ('TOURNAMENT_XI',  NULL, NULL)
ON CONFLICT (key) DO NOTHING;

-- ── RLS policies ────────────────────────────────────────────
ALTER TABLE public.lock_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read lock_config" ON public.lock_config;
CREATE POLICY "Public read lock_config"
  ON public.lock_config FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Master write lock_config" ON public.lock_config;
CREATE POLICY "Master write lock_config"
  ON public.lock_config FOR ALL
  USING ((SELECT is_master FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_master FROM public.profiles WHERE id = auth.uid()) = true);

-- ── Helper: lock a single category (master only) ────────────
CREATE OR REPLACE FUNCTION public.set_lock(category_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT is_master FROM public.profiles WHERE id = auth.uid()) != true THEN
    RAISE EXCEPTION 'Only masters can set locks';
  END IF;

  UPDATE public.lock_config
  SET locked_at = now(), locked_by = auth.uid()
  WHERE key = category_key;
END;
$$;

-- ── Helper: unlock a single category (master only) ──────────
CREATE OR REPLACE FUNCTION public.clear_lock(category_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT is_master FROM public.profiles WHERE id = auth.uid()) != true THEN
    RAISE EXCEPTION 'Only masters can clear locks';
  END IF;

  UPDATE public.lock_config
  SET locked_at = NULL, locked_by = NULL
  WHERE key = category_key;
END;
$$;

-- ── Verify ──────────────────────────────────────────────────
SELECT * FROM public.lock_config;
