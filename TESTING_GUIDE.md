# Security Testing Guide

**Date**: 2026-04-28  
**Status**: Ready for Testing

---

## 🎯 Testing Overview

This guide covers testing all security enhancements implemented on 2026-04-28.

---

## 📋 Prerequisites

- [x] Enhanced schema deployed to Supabase
- [x] Code changes committed and pulled
- [x] Development server running (`npm run dev`)
- [x] Supabase project accessible

---

## 🧪 Test Suite 1: Manual UI Testing

### Test 1.1: Rate Limiting - Prediction Saves

**Steps**:
1. Open app at `http://localhost:5173`
2. Sign in with a test account
3. Complete group stage and bracket predictions
4. Click "Save" button rapidly 15 times

**Expected Result**:
- ✅ First 10 saves: Success message
- ✅ 11th save+: Error: "Too many save attempts. Please wait X seconds."
- ✅ Counter resets after 60 seconds

**Pass Criteria**: User sees rate limit message after 10 rapid saves

---

### Test 1.2: Rate Limiting - Login Attempts

**Steps**:
1. Open app at `http://localhost:5173`
2. Go to login modal
3. Try logging in with wrong credentials 6 times rapidly

**Expected Result**:
- ✅ First 5 attempts: Normal error (wrong credentials)
- ✅ 6th attempt+: Error: "Too many login attempts. Please try again in 1 minute(s)."

**Pass Criteria**: Login blocked after 5 failed attempts

---

### Test 1.3: Rate Limiting - Password Reset

**Steps**:
1. Open app at `http://localhost:5173`
2. Go to login modal → "Forgot Password?"
3. Request password reset 4 times

**Expected Result**:
- ✅ First 3 requests: Success message
- ✅ 4th request: Error: "Too many password reset requests..."

**Pass Criteria**: Password reset blocked after 3 requests in 1 hour

---

### Test 1.4: Rate Limiting - Username Check

**Steps**:
1. Open app at `http://localhost:5173`
2. Go to signup
3. Type different usernames rapidly 15 times

**Expected Result**:
- ✅ First 10 checks: Work normally
- ✅ 11th check+: Error: "Too many username checks..."

**Pass Criteria**: Username validation blocked after 10 rapid checks

---

## 🧪 Test Suite 2: Browser Console Testing

### Setup

1. Open app in browser
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Copy/paste contents of `src/lib/security-tests.js`
5. Press Enter to load the test script

### Run Automated Tests

```javascript
// Run all tests
await testRateLimitFunctions();
await testRLSPolicies();
await testRateLimitsTable();
```

---

### Test 2.1: Database Functions

**Command**: `await testRateLimitFunctions();`

**Expected Output**:
```
✅ check_rate_limit works: true
✅ get_rate_limit_status works: {...}
✅ check_user_permissions works: {...}
✅ get_user_activity_summary works: {...}
```

**Pass Criteria**: All 4 functions return successfully

---

### Test 2.2: RLS - User Isolation

**Command**: `await testRLSPolicies();`

**Expected Output**:
```
✅ Can read own predictions: X records
✅ Can read other predictions (public): X records
✅ Correctly blocked INSERT for other user: new row violates row-level security policy
✅ Correctly blocked UPDATE for other user: new row violates row-level security policy
✅ Correctly blocked DELETE for other user: new row violates row-level security policy
```

**Pass Criteria**: All user isolation tests pass

---

### Test 2.3: RLS - Official Data Protection

**Command**: Part of `await testRLSPolicies();`

**Expected Output**:
```
✅ Can read official matches: X records
✅ Correctly blocked official match write: permission denied
✅ Can read profiles: X records
✅ Correctly blocked profile update: ...
✅ Privilege escalation silently failed OR Correctly blocked privilege escalation
```

**Pass Criteria**: Non-master users cannot write official data

---

### Test 2.4: Rate Limits Table

**Command**: `await testRateLimitsTable();`

**Expected Output**:
```
✅ rate_limits table exists, current entries: X
```

**Pass Criteria**: Table exists and is queryable

---

## 🧪 Test Suite 3: Supabase SQL Editor Testing

### Access SQL Editor

1. Go to Supabase Dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar

### Test 3.1: Verify RLS Policies

```sql
-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result**: Each table should have 3-6 policies

**Pass Criteria**: 
- profiles: 5+ policies
- config: 3 policies
- official_matches: 5+ policies
- user_predictions_matches: 5+ policies
- All other tables: 3+ policies

---

### Test 3.2: Verify Functions Exist

```sql
-- Check security functions
SELECT proname as function_name
FROM pg_proc 
WHERE proname IN (
  'check_rate_limit',
  'reset_rate_limit',
  'get_rate_limit_status',
  'check_user_permissions',
  'get_user_activity_summary'
)
ORDER BY proname;
```

**Expected Result**: All 5 functions listed

**Pass Criteria**: 5 rows returned

---

### Test 3.3: Test Rate Limit Function

```sql
-- Test rate limiting
SELECT check_rate_limit('test_action', 5, 60);
-- Should return: true (first call)

SELECT check_rate_limit('test_action', 5, 60);
-- Should return: true (within limit)

-- Run 3 more times...
SELECT check_rate_limit('test_action', 5, 60);
-- Should return: false (exceeded limit)
```

**Pass Criteria**: Returns false after 5 calls

---

### Test 3.4: Check Rate Limit Status

```sql
SELECT * FROM get_rate_limit_status('test_action');
```

**Expected Result**: Shows request count, timestamps, remaining

**Pass Criteria**: Returns valid status object

---

### Test 3.5: Reset Rate Limit (Master Only)

```sql
-- As master, reset rate limit
SELECT reset_rate_limit(auth.uid(), 'test_action');
-- Should succeed

-- Check status after reset
SELECT * FROM get_rate_limit_status('test_action');
-- Should show 0 requests
```

**Pass Criteria**: Rate limit reset successfully

---

### Test 3.6: User Permissions Check

```sql
SELECT * FROM check_user_permissions();
```

**Expected Result**: Shows user permissions

**Pass Criteria**: Returns valid permission object

---

### Test 3.7: Activity Summary

```sql
SELECT * FROM get_user_activity_summary();
```

**Expected Result**: Shows prediction counts and timestamps

**Pass Criteria**: Returns valid activity summary

---

## 🧪 Test Suite 4: Privilege Escalation Testing

### Test 4.1: Direct SQL Escalation Attempt

In Supabase SQL Editor:

```sql
-- Try to set yourself as master
UPDATE profiles SET is_master = true WHERE id = auth.uid();
```

**Expected Result**:
- Option A: Error "new row violates row-level security policy"
- Option B: Update succeeds but is_master remains false (silent failure)

**Pass Criteria**: is_master does NOT change to true

---

### Test 4.2: Check User Is Master Status

```sql
-- Verify your current status
SELECT id, username, is_master FROM profiles WHERE id = auth.uid();
```

**Expected Result**: is_master = false (for regular users)

**Pass Criteria**: Status unchanged after escalation attempt

---

## 🧪 Test Suite 5: Performance Testing

### Test 5.1: RLS Performance Impact

```sql
-- Time a simple query
EXPLAIN ANALYZE
SELECT * FROM user_predictions_matches
WHERE user_id = auth.uid();
```

**Expected Result**: Execution time < 100ms for typical datasets

**Pass Criteria**: Query completes quickly (RLS adds minimal overhead)

---

### Test 5.2: Rate Limit Performance

In browser console:

```javascript
// Time rate limit check
console.time('rateLimit');
const result = rateLimiter.check('PREDICTION_SAVE');
console.timeEnd('rateLimit');
console.log('Result:', result);
```

**Expected Result**: < 1ms (in-memory check)

**Pass Criteria**: Negligible performance impact

---

## 📊 Test Results Template

### Manual UI Tests

| Test | Status | Notes |
|------|--------|-------|
| 1.1 Prediction Save Rate Limit | ⬜ Pass / ⬜ Fail | |
| 1.2 Login Rate Limit | ⬜ Pass / ⬜ Fail | |
| 1.3 Password Reset Rate Limit | ⬜ Pass / ⬜ Fail | |
| 1.4 Username Check Rate Limit | ⬜ Pass / ⬜ Fail | |

### Browser Console Tests

| Test | Status | Notes |
|------|--------|-------|
| 2.1 Database Functions | ⬜ Pass / ⬜ Fail | |
| 2.2 User Isolation | ⬜ Pass / ⬜ Fail | |
| 2.3 Official Data Protection | ⬜ Pass / ⬜ Fail | |
| 2.4 Rate Limits Table | ⬜ Pass / ⬜ Fail | |

### SQL Editor Tests

| Test | Status | Notes |
|------|--------|-------|
| 3.1 RLS Policies Count | ⬜ Pass / ⬜ Fail | |
| 3.2 Functions Exist | ⬜ Pass / ⬜ Fail | |
| 3.3 Rate Limit Function | ⬜ Pass / ⬜ Fail | |
| 3.4 Rate Limit Status | ⬜ Pass / ⬜ Fail | |
| 3.5 Reset Rate Limit | ⬜ Pass / ⬜ Fail | |
| 3.6 User Permissions | ⬜ Pass / ⬜ Fail | |
| 3.7 Activity Summary | ⬜ Pass / ⬜ Fail | |

### Security Tests

| Test | Status | Notes |
|------|--------|-------|
| 4.1 Privilege Escalation | ⬜ Pass / ⬜ Fail | |
| 4.2 Master Status Check | ⬜ Pass / ⬜ Fail | |

### Performance Tests

| Test | Status | Notes |
|------|--------|-------|
| 5.1 RLS Performance | ⬜ Pass / ⬜ Fail | Time: ___ ms |
| 5.2 Rate Limit Performance | ⬜ Pass / ⬜ Fail | Time: ___ ms |

---

## 🐛 Troubleshooting

### Issue: Rate limit not triggering

**Solution**: Check if rate limiter initialized in main.tsx:
```javascript
// Should be present:
initializeRateLimits()
```

### Issue: RLS policy errors

**Solution**: Verify schema was deployed correctly:
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### Issue: Functions don't exist

**Solution**: Re-run `schema_enhanced_security.sql` in SQL Editor

### Issue: Tests fail in browser

**Solution**: Ensure you're logged in and have a user profile

---

## ✅ Success Criteria

All tests should pass with:
- ✅ Rate limiting working for all 5 actions
- ✅ User isolation enforced (can't access others' data)
- ✅ Official data protected (master-only write)
- ✅ Privilege escalation prevented
- ✅ All 5 security functions working
- ✅ Performance impact < 1%

---

## 📝 Next Steps After Testing

1. **If all tests pass**: Ready for production deployment
2. **If tests fail**: Document failures, fix issues, re-test
3. **Performance concerns**: Adjust rate limits or optimize queries
4. **Document results**: Fill in test results template above

---

**Testing Completed By**: _________________  
**Date**: _________________  
**Overall Status**: ⬜ Pass / ⬜ Fail
