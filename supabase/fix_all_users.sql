-- ============================================================
-- ONE-TIME FIX: Create profiles for ALL existing users
-- AND ensure future users get profiles automatically
-- Run ONCE in Supabase SQL Editor — handles everything
-- ============================================================

-- ── Step 1: Create profiles for ALL existing users ────────
-- Uses user_id suffix to guarantee unique usernames
INSERT INTO public.profiles (id, username, display_name, is_master, total_points)
SELECT 
  u.id,
  sub.unique_username,
  sub.display_name,
  false,
  0
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id,
LATERAL (
  -- Derive a base name; if it happens to clash with an existing username,
  -- append the first 8 chars of the uuid to ensure uniqueness.
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE username = derived)
      THEN derived || '_' || left(u.id::text, 8)
      ELSE derived
    END AS unique_username,
    derived AS display_name
  FROM (
    SELECT COALESCE(
      u.raw_user_meta_data->>'username',
      split_part(u.email, '@', 1),
      'user_' || left(u.id::text, 8)
    ) AS derived
  ) base
) sub
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── Step 2: Verify — should show 0 missing ────────────────
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.profiles) as profiles,
  (SELECT COUNT(*) FROM auth.users u LEFT JOIN public.profiles p ON u.id = p.id WHERE p.id IS NULL) as users_missing_profile;

-- Expected: users_missing_profile = 0

-- ── Step 3: Create RPC function for future auto-creation ──
-- Uses SECURITY DEFINER to bypass RLS, only creates profile matching auth.uid()
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_uname text;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Already exists — nothing to do
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RETURN jsonb_build_object('status', 'exists', 'id', v_uid);
  END IF;

  -- Derive a unique username from auth.users metadata
  SELECT COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1), 'user_' || left(u.id::text, 8))
  INTO v_uname
  FROM auth.users u
  WHERE u.id = v_uid;

  -- If the derived username already exists, append a uuid suffix
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = v_uname) INTO v_exists;
  IF v_exists THEN
    v_uname := v_uname || '_' || left(v_uid::text, 8);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, is_master, total_points)
  VALUES (v_uid, v_uname, v_uname, false, 0)
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('status', 'created', 'id', v_uid);
END;
$$;

-- ── Step 4: Verify RPC works ──────────────────────────────
-- This will create YOUR profile if missing, or report "exists"
SELECT public.ensure_profile();
