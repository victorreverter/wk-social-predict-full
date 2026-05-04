-- ============================================================
-- Fix Missing Profile Issue
-- Run this in Supabase SQL Editor to fix users without profiles
-- ============================================================

-- This fixes the foreign key constraint error:
-- "insert or update on table violates foreign key constraint"

-- Step 1: Find users without profiles
SELECT 
  u.id as user_id,
  u.email,
  u.created_at,
  p.id as profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Step 2: Create missing profiles
-- Run this if the query above returns rows (users without profiles)
INSERT INTO public.profiles (id, username, display_name, avatar_url, is_master, total_points)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'username',
    'user_' || LEFT(u.id::text, 8)
  ) as username,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'username',
    'user_' || LEFT(u.id::text, 8)
  ) as display_name,
  COALESCE(u.raw_user_meta_data->>'avatar_url', NULL) as avatar_url,
  false as is_master,
  0 as total_points
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify all users now have profiles
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT p.id) as users_with_profiles,
  COUNT(DISTINCT u.id) - COUNT(DISTINCT p.id) as users_without_profiles
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id;

-- Expected: users_without_profiles should be 0

-- ============================================================
-- Quick Fix for YOUR Account
-- Replace YOUR-USER-ID-HERE with your actual user ID
-- ============================================================

-- First, get your user ID:
SELECT auth.uid() as your_user_id;

-- Then create your profile manually (if the bulk insert didn't work):
-- Uncomment and replace YOUR-USER-ID-HERE with your actual UUID
/*
INSERT INTO public.profiles (id, username, display_name, is_master, total_points)
VALUES (
  'YOUR-USER-ID-HERE',  -- Replace with your actual user ID from auth.uid()
  SPLIT_PART((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1),
  SPLIT_PART((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1),
  false,
  0
);
*/

-- ============================================================
-- Fix Trigger (Prevent Future Issues)
-- Ensure the trigger exists and works properly
-- ============================================================

-- Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- If trigger doesn't exist or isn't working, recreate it:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || LEFT(NEW.id::text, 8)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'username',
      'user_' || LEFT(NEW.id::text, 8)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Test the trigger by checking recent users
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.username,
  p.display_name,
  CASE WHEN p.id IS NULL THEN '❌ MISSING' ELSE '✅ EXISTS' END as profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
