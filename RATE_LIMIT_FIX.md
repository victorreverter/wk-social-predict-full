# Rate Limiting Fix - Testing Instructions

**Issue Fixed**: Maximum update depth exceeded + False rate limit errors  
**Date**: 2026-04-28  

---

## 🐛 What Was Wrong

### Problem 1: Infinite Render Loop
The rate limiter was being configured **inside the component body** without `useEffect`, causing:
- Every render → calls `rateLimiter.configure()` 
- State updates → trigger re-render
- Re-render → calls `configure()` again
- **Result**: Infinite loop → "Maximum update depth exceeded"

### Problem 2: Rate Limit Triggering on First Save
The `getStatus()` check was consuming a request, so:
- First save attempt → `getStatus()` called → increments counter
- Then `check()` called → increments counter again
- After 10 saves → actually at limit
- **Result**: Blocked on first save

---

## ✅ What Was Fixed

### Fix 1: Moved Configuration to useEffect
```typescript
// BEFORE (WRONG - causes infinite loop)
export const useSaveAllPredictions = () => {
    rateLimiter.configure('PREDICTION_SAVE', defaultRateLimits.PREDICTION_SAVE);
    // ...
}

// AFTER (CORRECT - runs once)
export const useSaveAllPredictions = () => {
    useEffect(() => {
        rateLimiter.configure('PREDICTION_SAVE', defaultRateLimits.PREDICTION_SAVE);
    }, []);
    // ...
}
```

### Fix 2: Same Fix in AuthContext
```typescript
// BEFORE
export const AuthProvider = ({ children }) => {
    rateLimiter.configure('AUTH_ATTEMPT', defaultRateLimits.AUTH_ATTEMPT);
    // ...
}

// AFTER
export const AuthProvider = ({ children }) => {
    useEffect(() => {
        rateLimiter.configure('AUTH_ATTEMPT', defaultRateLimits.AUTH_ATTEMPT);
        rateLimiter.configure('PASSWORD_RESET', defaultRateLimits.PASSWORD_RESET);
        rateLimiter.configure('USERNAME_CHECK', defaultRateLimits.USERNAME_CHECK);
    }, []);
    // ...
}
```

---

## 🧪 How to Test

### Step 1: Hard Refresh Browser
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

### Step 2: Test Non-Admin Account

1. **Sign in** with regular user account
2. **Complete** group stage and bracket predictions
3. **Click "Save"** button
4. **Expected**: ✅ Success message "All Predictions Saved!"
5. **Click "Save" again** 9 more times
6. **Expected**: 
   - Saves 1-9: ✅ Success
   - Save 10+: ❌ "Too many save attempts. Please wait X seconds."

### Step 3: Test Admin Account

1. **Sign in** with admin/master account
2. **Make changes** to predictions
3. **Click "Save"**
4. **Expected**: ✅ No infinite loop error, saves successfully

### Step 4: Verify in Browser Console

Open DevTools (F12) and run:

```javascript
// Check rate limiter is initialized
import { rateLimiter } from './src/lib/rateLimiter.js';

// Before any saves
console.log('Status before saves:', rateLimiter.getStatus('PREDICTION_SAVE'));
// Should show: null (not initialized yet) or { current: 0, max: 10, remaining: 10 }

// After first save
console.log('Status after 1 save:', rateLimiter.getStatus('PREDICTION_SAVE'));
// Should show: { current: 1, max: 10, remaining: 9 }

// After 10 saves
console.log('Status after 10 saves:', rateLimiter.getStatus('PREDICTION_SAVE'));
// Should show: { current: 10, max: 10, remaining: 0 }
```

---

## ✅ Success Criteria

### Non-Admin Account
- [ ] Can save predictions without errors
- [ ] No "Maximum update depth" error
- [ ] Can save up to 10 times in 1 minute
- [ ] 11th save shows rate limit message
- [ ] Rate limit resets after 60 seconds

### Admin Account
- [ ] Can save predictions without errors
- [ ] No infinite render loops
- [ ] No console errors
- [ ] Can update official data (master-only)

---

## 🐛 If Still Having Issues

### Check Browser Console for Errors
```javascript
// Look for these errors:
"Maximum update depth exceeded" // → useEffect not working
"Too many save attempts" on first save // → Rate limiter not resetting
```

### Check Rate Limiter State
```javascript
// In browser console
import { rateLimiter } from './src/lib/rateLimiter.js';
console.log('All limits:', rateLimiter);
// Check if limits Map has correct entries
```

### Verify useEffect Ran
```javascript
// In browser console
import { rateLimiter } from './src/lib/rateLimiter.js';
const status = rateLimiter.getStatus('PREDICTION_SAVE');
console.log('Rate limit configured:', status !== null);
// Should be: true
```

---

## 📊 Expected Behavior

| Action | Expected Result |
|--------|----------------|
| 1st save | ✅ Success |
| 2nd-9th save | ✅ Success |
| 10th save | ✅ Success (last allowed) |
| 11th save | ❌ "Too many save attempts. Please wait 60 seconds." |
| Wait 60 seconds | ✅ Counter resets |
| Next save | ✅ Success (counter at 0) |

---

## 🔧 Troubleshooting

### Issue: Still getting "Maximum update depth" error

**Solution**: 
1. Hard refresh browser (Cmd+Shift+R)
2. Clear browser cache
3. Check `useEffect` has empty dependency array `[]`

### Issue: Rate limit triggers on first save

**Solution**:
1. Check browser console for old cached code
2. Hard refresh (Cmd+Shift+R)
3. Verify `getStatus()` is not being called before `check()`

### Issue: Can't save at all (non-admin)

**Solution**:
1. Check if predictions are locked by admin
2. Check browser console for RLS errors
3. Verify user is authenticated: `supabase.auth.getUser()`
4. Check user has profile in database

---

## 📝 Test Results Template

| Test Case | Status | Notes |
|-----------|--------|-------|
| Non-admin can save | ⬜ Pass / ⬜ Fail | |
| No infinite loop (admin) | ⬜ Pass / ⬜ Fail | |
| Rate limit at 10 saves | ⬜ Pass / ⬜ Fail | |
| Rate limit resets after 60s | ⬜ Pass / ⬜ Fail | |
| No console errors | ⬜ Pass / ⬜ Fail | |

---

**Fixed By**: Security Enhancement Team  
**Files Modified**: 
- `src/hooks/useSaveAllPredictions.ts`
- `src/context/AuthContext.tsx`

**Build Status**: ✅ Success (493 KB bundle)
