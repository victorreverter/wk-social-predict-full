# Debugging Steps for Save Failure

**Issue**: Predictions won't save - "Failed to save" error  
**Date**: 2026-04-28

---

## 🔍 Step-by-Step Debugging

### Step 1: Open Browser DevTools

1. Open your app in browser
2. Press **F12** or **Cmd+Option+I** (Mac) to open DevTools
3. Go to **Console** tab
4. Clear console (trash icon)

### Step 2: Try to Save Predictions

1. Make sure you're signed in
2. Complete your predictions
3. Click "Save" button
4. **Watch the console** for debug messages

### Step 3: Look for These Console Messages

You should see:
```
[DEBUG] Starting save process...
[DEBUG] Session: <user-id>
[DEBUG] Is locked: false
[DEBUG] Is final finished: true
[DEBUG] Save results: [...]
```

If you see an error, it will show:
```
[DEBUG] Save errors: [...]
[DEBUG] Catch block error: ...
```

### Step 4: Check Supabase Dashboard

1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Run this query to check if your predictions were saved:

```sql
SELECT * FROM user_predictions_matches 
WHERE user_id = auth.uid()
ORDER BY updated_at DESC
LIMIT 10;
```

If this returns rows, the save worked but scoring failed.

---

## 🐛 Common Issues & Solutions

### Issue 1: RLS Policy Blocking

**Symptom**: Console shows error like "new row violates row-level security policy"

**Solution**: Check if your user_id matches the session:

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id);

// Then check what the save is trying to use
// (should match)
```

**Fix**: The RLS policy might be too strict. Run this in SQL Editor:

```sql
-- Check current user's policies
SELECT * FROM check_user_permissions();
```

---

### Issue 2: Predictions Are Locked

**Symptom**: Console shows "Predictions are locked"

**Solution**: Check lock status:

```sql
-- In SQL Editor
SELECT * FROM config WHERE key = 'predictions_locked_at';
```

If the lock date is in the past, you need to update it:

```sql
-- Update lock date to future (admin only)
UPDATE config 
SET value = '2026-06-11T18:00:00Z' 
WHERE key = 'predictions_locked_at';
```

---

### Issue 3: Missing Matches (Not Complete)

**Symptom**: Console shows "Missing matches! Please complete..."

**Solution**: Make sure ALL matches have predictions:
- All 48 group stage matches
- All 56 knockout matches (including 3rd place)
- Champion selected

---

### Issue 4: Database Connection Error

**Symptom**: Console shows network error or timeout

**Solution**: 
1. Check Supabase status: https://status.supabase.com/
2. Verify your `.env` has correct URL
3. Try refreshing the page

---

### Issue 5: Rate Limiting Too Aggressive

**Symptom**: Console shows "Too many save attempts" on first save

**Solution**: This shouldn't happen now, but if it does:

```javascript
// In browser console
import { rateLimiter } from './src/lib/rateLimiter.js';
rateLimiter.resetAll();
console.log('Rate limits reset');
```

Then try saving again.

---

## 🧪 Manual Database Test

To test if it's a database issue, try inserting directly:

```sql
-- In Supabase SQL Editor
INSERT INTO user_predictions_matches (
  user_id,
  match_id,
  pred_home_goals,
  pred_away_goals,
  pts_earned
) VALUES (
  auth.uid(),  -- Your user ID
  'm1',        -- First match
  2,           -- Home goals
  1,           -- Away goals
  0            -- Points (will be calculated later)
) ON CONFLICT (user_id, match_id) 
DO UPDATE SET 
  pred_home_goals = 2,
  pred_away_goals = 1;
```

If this fails with RLS error, the issue is database policies.

---

## 📊 Check RLS Policies

Run this to verify RLS is working correctly:

```sql
-- Check if you can read your own predictions
SELECT COUNT(*) FROM user_predictions_matches WHERE user_id = auth.uid();

-- Check if you can insert (should work)
-- Try the INSERT above

-- Check policy count
SELECT tablename, COUNT(*) as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

Expected: Each table should have 3-6 policies

---

## 🔧 Quick Fixes

### Fix 1: Temporarily Disable Rate Limiting

In `main.tsx`, comment out the initialization:

```typescript
// initializeRateLimits()  // Comment this out temporarily
```

Then rebuild and test.

### Fix 2: Check If It's The Scoring

Comment out scoring in `useSaveAllPredictions.ts`:

```typescript
// Comment these out temporarily:
// await scoreMatches(session.user.id);
// await scoreKnockout(session.user.id);
// await scoreAwards(session.user.id);
// await scoreXI(session.user.id);
```

If save works after this, the issue is in the scoring functions.

### Fix 3: Simplify the Save

Try saving just one match first. In the console:

```javascript
// Try minimal save
const { error } = await supabase
  .from('user_predictions_matches')
  .upsert({
    user_id: (await supabase.auth.getUser()).data.user.id,
    match_id: 'm1',
    pred_home_goals: 1,
    pred_away_goals: 0,
    pts_earned: 0
  }, { onConflict: 'user_id,match_id' });

console.log('Test save error:', error);
```

If this works, the issue is with the data being sent.

---

## 📝 Report Back

After trying these steps, tell me:

1. **What console messages do you see?** (copy/paste from console)
2. **What's the exact error message?**
3. **Does the manual INSERT work?** (Step: "Manual Database Test")
4. **Are predictions locked in the database?** (Check with SQL query)

This will help me pinpoint the exact issue!

---

**Last Updated**: 2026-04-28  
**Status**: Debugging in progress
