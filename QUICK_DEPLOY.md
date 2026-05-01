# ⚡ Quick Deploy Checklist

**Goal**: Deploy in 15 minutes  
**Date**: 2026-04-28

---

## ✅ Pre-Deployment (1 min)

- [ ] Backup database (optional but recommended)
  ```bash
  npx supabase db dump -f backup_$(date +%Y%m%d).sql
  ```

---

## 🔧 Step 1: Fix Missing Profiles (3 min) **CRITICAL**

**Without this, saves will fail!**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy & paste this:

```sql
-- Create missing profiles for all users
INSERT INTO public.profiles (id, username, display_name, avatar_url, is_master, total_points)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  false,
  0
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT COUNT(*) as users_with_profiles FROM public.profiles;
SELECT COUNT(*) as total_users FROM auth.users;
```

3. Click **Run**
4. Verify: Both counts should match ✅

---

## 🔒 Step 2: Deploy Enhanced RLS (3 min)

1. In **SQL Editor**, open `supabase/schema_enhanced_security.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click **Run**
5. Verify:
   ```sql
   SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
   ```
   Should return **75+** ✅

---

## 💻 Step 3: Deploy Code (2 min)

```bash
# Build (verify no errors)
npm run build

# Commit
git add .
git commit -m "feat: security + partial saves

- 75+ RLS policies for database security
- Rate limiting (10 saves/min, 5 logins/min)
- Enable partial prediction saves
- Fix missing profile issue"

# Deploy
git push origin main
```

---

## 🧪 Step 4: Test (5 min)

### Test 1: Save Partial Predictions
1. Open app: `http://localhost:5173/wk-social-predict-full/`
2. **Hard refresh**: `Cmd+Shift+R`
3. Complete **1 match**
4. Click **"Save"**
5. **Expected**: "✅ Saved X predictions!" ✅

### Test 2: Rate Limiting
1. Click "Save" 11 times rapidly
2. **Expected**: 
   - Saves 1-10: Success ✅
   - Save 11+: "Too many save attempts..." ✅

### Test 3: Check Console
1. Open DevTools (F12)
2. Console tab
3. Look for errors
4. **Expected**: No red errors ✅

---

## 📊 Step 5: Verify Database (2 min)

Run in SQL Editor:

```sql
-- Check your profile exists
SELECT * FROM public.profiles WHERE id = auth.uid();

-- Check your predictions saved
SELECT COUNT(*) as my_predictions 
FROM user_predictions_matches 
WHERE user_id = auth.uid();

-- Check RLS policies active
SELECT tablename, COUNT(*) as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

**Expected**:
- Profile: 1 row ✅
- Predictions: >0 rows ✅
- Policies: 75+ total ✅

---

## ✅ Success Criteria

All should be true:
- [ ] Can save 1 match successfully
- [ ] Can save multiple times
- [ ] Rate limit triggers after 10 saves
- [ ] No console errors
- [ ] Profile exists in database
- [ ] Predictions saved in database
- [ ] 75+ RLS policies active

---

## 🐛 If Something Fails

### Save Fails with Foreign Key Error
**Fix**: Run Step 1 (fix missing profiles) again

### Rate Limit Triggers on First Save
**Fix**: Hard refresh browser (Cmd+Shift+R), clear cache

### Infinite Loop Error
**Fix**: Check main.tsx has `initializeRateLimits()` only once

### RLS Policy Error
**Fix**: Re-run `schema_enhanced_security.sql` in SQL Editor

---

## 📞 Quick Reference

### Files to Deploy:
1. `supabase/fix_missing_profiles.sql` - Run FIRST
2. `supabase/schema_enhanced_security.sql` - Run SECOND
3. Code changes - Deploy THIRD (git push)

### Key Commands:
```bash
# Build
npm run build

# Hard refresh browser
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)

# Check console
F12 → Console tab
```

### SQL Queries:
```sql
-- Check profile
SELECT * FROM public.profiles WHERE id = auth.uid();

-- Check policies
SELECT COUNT(*) FROM pg_policies;

-- Check predictions
SELECT COUNT(*) FROM user_predictions_matches WHERE user_id = auth.uid();
```

---

## 🎉 Done!

If all tests pass, you've successfully deployed:
- ✅ Enhanced security (75+ RLS policies)
- ✅ Rate limiting (5 actions)
- ✅ Partial saves (better UX)
- ✅ Fixed critical bugs

**Time Elapsed**: ~15 minutes  
**Status**: Production Ready 🚀

---

**Deployed By**: _________________  
**Date**: _________________  
**Status**: ⬜ Success / ⬜ Failed
