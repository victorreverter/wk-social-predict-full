-- ============================================================
-- ONE-TIME FIX: Create your missing profile (DEPRECATED)
-- Use fix_all_users.sql instead — fixes ALL users at once
-- ============================================================

-- First, find your user ID
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'username', 'user_' || LEFT(id::text, 8)) as suggested_username
FROM auth.users 
ORDER BY created_at DESC;

-- Now copy YOUR user id from the result above and run:
-- (replace 'YOUR-USER-ID-HERE' with your actual UUID)

DO $$
DECLARE
  v_user_id uuid := 'YOUR-USER-ID-HERE';  -- ← REPLACE THIS
BEGIN
  INSERT INTO public.profiles (id, username, display_name, is_master, total_points)
  SELECT 
    v_user_id,
    COALESCE(raw_user_meta_data->>'username', 'user_' || LEFT(id::text, 8)),
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'username', 'user_' || LEFT(id::text, 8)),
    false,
    0
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Profile created for %', v_user_id;
END;
$$;
