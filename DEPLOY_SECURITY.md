# Security Enhancement Deployment Guide

**Date**: 2026-04-28  
**Version**: 1.0  

---

## Overview

This guide walks you through deploying the enhanced security measures to your Supabase database and application.

---

## 📋 Pre-Deployment Checklist

- [ ] Backup current database
- [ ] Test in staging environment first
- [ ] Review all SQL scripts
- [ ] Notify users of maintenance window (if needed)
- [ ] Have rollback plan ready

---

## 🗄️ Database Changes

### Step 1: Backup Current Database

```bash
# Export current schema
npx supabase db dump -f backup_$(date +%Y%m%d).sql

# Or use Supabase Dashboard:
# Settings → Database → Backup → Create backup
```

### Step 2: Run Enhanced Security Schema

1. **Navigate to Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar

2. **Open `supabase/schema_enhanced_security.sql`**
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   - Check for any error messages
   - Verify all policies created (should see 60+ new policies)
   - Verify rate_limits table created
   - Verify all functions created

### Step 3: Verify RLS Policies

Run these verification queries:

```sql
-- Count policies per table
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Verify rate_limits table exists
SELECT * FROM public.rate_limits LIMIT 1;

-- Verify functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN (
  'check_rate_limit',
  'reset_rate_limit',
  'get_rate_limit_status',
  'check_user_permissions',
  'get_user_activity_summary'
);
```

Expected output:
- All tables should have 3-5 policies each
- rate_limits table should be queryable
- All 5 functions should exist

---

## 💻 Application Changes

### Step 1: Update Dependencies

No new dependencies required! All changes use existing libraries.

### Step 2: Deploy Code Changes

Files modified/created:

**New Files**:
- `src/lib/rateLimiter.ts` - Rate limiting utility
- `supabase/schema_enhanced_security.sql` - Enhanced RLS
- `supabase/RLS_AUDIT.md` - RLS documentation
- `.env.example` - Environment template
- `SECURITY_AUDIT.md` - Security tracking

**Modified Files**:
- `src/hooks/useSaveAllPredictions.ts` - Added rate limiting
- `src/context/AuthContext.tsx` - Added rate limiting
- `src/main.tsx` - Initialize rate limits

### Step 3: Test Locally

```bash
# Install dependencies (if any changed)
npm install

# Run development server
npm run dev

# Test rate limiting:
# 1. Try saving predictions rapidly (should limit after 10 tries)
# 2. Try multiple login attempts (should limit after 5 tries)
# 3. Try multiple password resets (should limit after 3 tries)
```

### Step 4: Build and Deploy

```bash
# Build
npm run build

# Test production build locally
npm run preview

# Deploy to GitHub Pages (or your hosting)
git add .
git commit -m "feat: implement enhanced security measures

- Add comprehensive RLS policies to all tables
- Implement client-side and database rate limiting
- Add security audit documentation
- Prevent privilege escalation
- Add rate limits for auth, predictions, and username checks"
git push origin main
```

---

## 🔍 Post-Deployment Verification

### 1. Test Rate Limiting

**Test Prediction Save Rate Limit**:
```javascript
// In browser console, try saving rapidly:
for (let i = 0; i < 15; i++) {
  // Trigger save
  // Should see error after 10th attempt
}
```

**Expected Behavior**:
- First 10 saves: Allowed
- 11th save+: Error message with wait time

**Test Auth Rate Limit**:
```javascript
// Try logging in with wrong credentials 6 times
// Should be blocked after 5th attempt
```

**Expected Behavior**:
- First 5 attempts: Allowed
- 6th attempt+: Error message with wait time

### 2. Test RLS Policies

**Test User Isolation**:
```sql
-- As regular user, try to access another user's predictions
-- Should return empty or error
SELECT * FROM user_predictions_matches 
WHERE user_id != auth.uid();
```

**Test Master Write Access**:
```sql
-- As non-master, try to update config
UPDATE config SET value = 'test' WHERE key = 'predictions_locked_at';
-- Should fail with RLS error

-- As master, should succeed
```

**Test Privilege Escalation Prevention**:
```sql
-- Try to set is_master = true on own profile
UPDATE profiles SET is_master = true WHERE id = auth.uid();
-- Should fail or silently ignore
```

### 3. Monitor Rate Limits

```sql
-- Check current rate limits (as master)
SELECT * FROM rate_limits;

-- Get rate limit status for current user
SELECT * FROM get_rate_limit_status('PREDICTION_SAVE');
```

---

## 📊 Monitoring & Alerts

### Set Up Supabase Logs

1. Go to Supabase Dashboard → Settings → Logs
2. Enable query logging
3. Set up log drains if needed (Datadog, Logflare, etc.)

### Monitor These Events:

- **RLS policy violations** (indicates attack attempts)
- **Rate limit triggers** (indicates abuse or bugs)
- **Failed auth attempts** (brute force detection)
- **Master-only operations** (privilege escalation attempts)

### Recommended Alerts:

```sql
-- High rate limit violations (create a view)
CREATE VIEW suspicious_activity AS
SELECT 
  user_id,
  action,
  request_count,
  last_request
FROM rate_limits
WHERE request_count > 50  -- Adjust threshold
  AND last_request > now() - interval '5 minutes';
```

---

## 🔄 Rollback Plan

If issues occur, rollback in this order:

### 1. Rollback Database Changes

```sql
-- Drop enhanced policies (run in SQL Editor)
-- This will revert to base schema policies

-- Drop rate limiting functions
DROP FUNCTION IF EXISTS check_rate_limit(text, int, int);
DROP FUNCTION IF EXISTS reset_rate_limit(uuid, text);
DROP FUNCTION IF EXISTS get_rate_limit_status(text);
DROP FUNCTION IF EXISTS check_user_permissions();
DROP FUNCTION IF EXISTS get_user_activity_summary();

-- Drop rate_limits table
DROP TABLE IF EXISTS public.rate_limits;

-- Drop enhanced policies (examples - run for each table)
DROP POLICY IF EXISTS "Insert profile via trigger" ON profiles;
DROP POLICY IF EXISTS "Delete own profile" ON profiles;
DROP POLICY IF EXISTS "Own profile update no escalate" ON profiles;
-- ... continue for all enhanced policies

-- Or restore from backup:
-- npx supabase db restore -f backup_YYYYMMDD.sql
```

### 2. Rollback Code Changes

```bash
# Revert to previous commit
git revert HEAD
# Or reset to specific commit
git reset --hard <previous-commit-hash>

# Deploy rollback
npm run build
git push --force origin main
```

---

## 📈 Performance Impact

### Expected Changes:

- **Database Queries**: +5-10ms per query (RLS overhead)
- **Rate Limit Checks**: +1-2ms (in-memory, negligible)
- **Overall**: <1% performance impact

### Optimization Tips:

1. **Index Usage**: All new indexes are already created
2. **Connection Pooling**: Supabase handles this automatically
3. **Caching**: Consider caching config values in app
4. **Batch Operations**: Use upsert where possible (already implemented)

---

## 🛡️ Security Improvements Summary

### Before:
- Basic RLS on some tables
- No rate limiting
- Limited audit capabilities
- Potential privilege escalation

### After:
- ✅ Comprehensive RLS on all tables
- ✅ Multi-layer rate limiting (client + DB)
- ✅ Full audit trail capabilities
- ✅ Privilege escalation prevented
- ✅ User data isolation enforced
- ✅ Master-only operations protected
- ✅ Public transparency maintained

---

## 📞 Support & Troubleshooting

### Common Issues:

**Issue**: "policy violation for table"  
**Solution**: User is trying to access data they don't own. This is expected behavior.

**Issue**: "rate limit exceeded"  
**Solution**: User is making too many requests. Wait for window to expire or adjust limits.

**Issue**: "function does not exist"  
**Solution**: Enhanced schema not deployed. Run `schema_enhanced_security.sql`.

**Issue**: "permission denied for table"  
**Solution**: RLS policy blocking access. Check user's auth status and ownership.

### Get Help:

1. Check `SECURITY_AUDIT.md` for known issues
2. Review `RLS_AUDIT.md` for policy details
3. Check Supabase logs for error details
4. Test in SQL Editor with different user contexts

---

## ✅ Deployment Sign-Off

- [ ] Database backup created
- [ ] Enhanced schema deployed
- [ ] All policies verified
- [ ] Code deployed to staging
- [ ] Rate limiting tested
- [ ] RLS policies tested
- [ ] Performance acceptable
- [ ] Monitoring configured
- [ ] Rollback plan documented
- [ ] Production deployment approved

---

**Deployed By**: _________________  
**Deployment Date**: _________________  
**Next Security Review**: 2026-07-28

---

## Appendix: Quick Reference

### Rate Limit Defaults:

| Action | Limit | Window |
|--------|-------|--------|
| PREDICTION_SAVE | 10 | 1 minute |
| AUTH_ATTEMPT | 5 | 1 minute |
| PASSWORD_RESET | 3 | 1 hour |
| USERNAME_CHECK | 10 | 1 minute |
| DATA_FETCH | 100 | 1 minute |

### Key Files:

- `supabase/schema_enhanced_security.sql` - Deploy this to DB
- `supabase/RLS_AUDIT.md` - Policy documentation
- `src/lib/rateLimiter.ts` - Rate limiting utility
- `SECURITY_AUDIT.md` - Overall security tracking

### Important Functions:

```sql
-- Check rate limit
SELECT check_rate_limit('PREDICTION_SAVE', 10, 60);

-- Get status
SELECT * FROM get_rate_limit_status('PREDICTION_SAVE');

-- Reset user's rate limit (master only)
SELECT reset_rate_limit('user-uuid-here', 'PREDICTION_SAVE');

-- Check permissions
SELECT * FROM check_user_permissions();

-- Get activity summary
SELECT * FROM get_user_activity_summary();
```
