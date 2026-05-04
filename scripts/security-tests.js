/**
 * Security Testing Script
 * Run this in browser console to test RLS and rate limiting
 */

// ============================================================
// TEST 1: Rate Limiting
// ============================================================

console.group('🧪 Rate Limiting Tests');

// Test 1.1: Prediction Save Rate Limit
console.log('\n📝 Test 1.1: Prediction Save Rate Limit');
console.log('Expected: Should allow 10 saves, then block');

// This would need to be tested through the UI
// Try saving your predictions 15 times rapidly

// Test 1.2: Auth Rate Limit
console.log('\n🔐 Test 1.2: Auth Rate Limit');
console.log('Expected: Should allow 5 login attempts, then block');

// Test through UI: Try logging in with wrong credentials 6 times

// Test 1.3: Password Reset Rate Limit
console.log('\n📧 Test 1.3: Password Reset Rate Limit');
console.log('Expected: Should allow 3 resets per hour, then block');

// Test through UI: Try password reset 4 times

console.groupEnd();

// ============================================================
// TEST 2: Database Rate Limit Functions
// ============================================================

console.group('\n🗄️ Database Rate Limit Tests');

async function testRateLimitFunctions() {
  // Test check_rate_limit function
  console.log('\nTesting check_rate_limit function...');
  
  const { data, error } = await supabase.rpc('check_rate_limit', {
    action_name: 'test_action',
    max_requests: 5,
    window_seconds: 60
  });
  
  if (error) {
    console.error('❌ check_rate_limit failed:', error);
  } else {
    console.log('✅ check_rate_limit works:', data);
  }
  
  // Test get_rate_limit_status function
  console.log('\nTesting get_rate_limit_status function...');
  
  const { data: status, error: statusError } = await supabase.rpc('get_rate_limit_status', {
    action_name: 'test_action'
  });
  
  if (statusError) {
    console.error('❌ get_rate_limit_status failed:', statusError);
  } else {
    console.log('✅ get_rate_limit_status works:', status);
  }
  
  // Test check_user_permissions function
  console.log('\nTesting check_user_permissions function...');
  
  const { data: perms, error: permsError } = await supabase.rpc('check_user_permissions')();
  
  if (permsError) {
    console.error('❌ check_user_permissions failed:', permsError);
  } else {
    console.log('✅ check_user_permissions works:', perms);
  }
  
  // Test get_user_activity_summary function
  console.log('\nTesting get_user_activity_summary function...');
  
  const { data: activity, error: activityError } = await supabase.rpc('get_user_activity_summary')();
  
  if (activityError) {
    console.error('❌ get_user_activity_summary failed:', activityError);
  } else {
    console.log('✅ get_user_activity_summary works:', activity);
  }
}

// Run database tests
// testRateLimitFunctions();

console.groupEnd();

// ============================================================
// TEST 3: RLS Policy Tests
// ============================================================

console.group('\n🔒 RLS Policy Tests');

async function testRLSPolicies() {
  const currentUser = (await supabase.auth.getUser()).data.user;
  console.log('Current user:', currentUser?.id);
  
  // Test 3.1: User can read own predictions
  console.log('\n📋 Test 3.1: Read own predictions');
  const { data: ownPredictions } = await supabase
    .from('user_predictions_matches')
    .select('*')
    .eq('user_id', currentUser.id);
  
  console.log('✅ Can read own predictions:', ownPredictions?.length || 0, 'records');
  
  // Test 3.2: User can read other users' predictions (should work - public read)
  console.log('\n📋 Test 3.2: Read other users predictions (public read)');
  const { data: otherPredictions } = await supabase
    .from('user_predictions_matches')
    .select('*')
    .neq('user_id', currentUser.id);
  
  console.log('✅ Can read other predictions (public):', otherPredictions?.length || 0, 'records');
  
  // Test 3.3: User cannot INSERT predictions for another user
  console.log('\n📋 Test 3.3: Cannot INSERT for another user (should fail)');
  const fakeUserId = '00000000-0000-0000-0000-000000000000';
  const { error: insertError } = await supabase
    .from('user_predictions_matches')
    .insert({
      user_id: fakeUserId,
      match_id: 'm1',
      pred_home_goals: 1,
      pred_away_goals: 0,
      pts_earned: 0
    });
  
  if (insertError) {
    console.log('✅ Correctly blocked INSERT for other user:', insertError.message);
  } else {
    console.error('❌ SECURITY ISSUE: Allowed INSERT for other user!');
  }
  
  // Test 3.4: User cannot UPDATE another user's predictions
  console.log('\n📋 Test 3.4: Cannot UPDATE another user predictions (should fail)');
  const { error: updateError } = await supabase
    .from('user_predictions_matches')
    .update({ pred_home_goals: 99 })
    .eq('user_id', fakeUserId);
  
  if (updateError) {
    console.log('✅ Correctly blocked UPDATE for other user:', updateError.message);
  } else {
    console.error('❌ SECURITY ISSUE: Allowed UPDATE for other user!');
  }
  
  // Test 3.5: User cannot DELETE another user's predictions
  console.log('\n📋 Test 3.5: Cannot DELETE another user predictions (should fail)');
  const { error: deleteError } = await supabase
    .from('user_predictions_matches')
    .delete()
    .eq('user_id', fakeUserId);
  
  if (deleteError) {
    console.log('✅ Correctly blocked DELETE for other user:', deleteError.message);
  } else {
    console.error('❌ SECURITY ISSUE: Allowed DELETE for other user!');
  }
  
  // Test 3.6: Read official matches (should work - public)
  console.log('\n📋 Test 3.6: Read official matches (public read)');
  const { data: matches } = await supabase
    .from('official_matches')
    .select('*')
    .limit(5);
  
  console.log('✅ Can read official matches:', matches?.length || 0, 'records');
  
  // Test 3.7: Non-master cannot write official matches
  console.log('\n📋 Test 3.7: Cannot write official matches (non-master, should fail)');
  const { error: writeMatchError } = await supabase
    .from('official_matches')
    .insert({
      match_id: 'test_' + Date.now(),
      home_goals: 1,
      away_goals: 0,
      status: 'FINISHED'
    });
  
  if (writeMatchError) {
    console.log('✅ Correctly blocked official match write:', writeMatchError.message);
  } else {
    console.error('❌ SECURITY ISSUE: Allowed non-master to write official matches!');
  }
  
  // Test 3.8: Check profile read (should work - public)
  console.log('\n📋 Test 3.8: Read profiles (public read)');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, total_points')
    .limit(5);
  
  console.log('✅ Can read profiles:', profiles?.length || 0, 'records');
  
  // Test 3.9: Cannot update another user's profile
  console.log('\n📋 Test 3.9: Cannot update another profile (should fail)');
  const otherProfile = profiles?.find(p => p.id !== currentUser.id);
  if (otherProfile) {
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ display_name: 'Hacker' })
      .eq('id', otherProfile.id);
    
    if (profileUpdateError) {
      console.log('✅ Correctly blocked profile update:', profileUpdateError.message);
    } else {
      console.error('❌ SECURITY ISSUE: Allowed updating another profile!');
    }
  }
  
  // Test 3.10: Try privilege escalation (set is_master = true)
  console.log('\n📋 Test 3.10: Cannot escalate privileges (should fail)');
  const { error: escalateError } = await supabase
    .from('profiles')
    .update({ is_master: true })
    .eq('id', currentUser.id);
  
  if (escalateError) {
    console.log('✅ Correctly blocked privilege escalation:', escalateError.message);
  } else {
    // Check if it actually worked
    const { data: checkProfile } = await supabase
      .from('profiles')
      .select('is_master')
      .eq('id', currentUser.id)
      .single();
    
    if (checkProfile?.is_master) {
      console.error('❌ SECURITY ISSUE: Privilege escalation succeeded!');
      // Revert it
      await supabase.from('profiles').update({ is_master: false }).eq('id', currentUser.id);
    } else {
      console.log('✅ Privilege escalation silently failed (is_master not changed)');
    }
  }
}

// Run RLS tests
// testRLSPolicies();

console.groupEnd();

// ============================================================
// TEST 4: Rate Limits Table
// ============================================================

console.group('\n⏱️ Rate Limits Table Tests');

async function testRateLimitsTable() {
  // Check if rate_limits table exists
  console.log('\n📊 Test 4.1: Check rate_limits table');
  const { data: rateLimits, error: rlError } = await supabase
    .from('rate_limits')
    .select('*')
    .limit(5);
  
  if (rlError) {
    console.error('❌ rate_limits table query failed:', rlError.message);
  } else {
    console.log('✅ rate_limits table exists, current entries:', rateLimits?.length || 0);
  }
}

// testRateLimitsTable();

console.groupEnd();

// ============================================================
// RUN ALL TESTS
// ============================================================

console.log('\n\n🚀 To run all tests, execute:');
console.log('await testRateLimitFunctions();');
console.log('await testRLSPolicies();');
console.log('await testRateLimitsTable();');
console.log('\nOr uncomment the function calls above and refresh the page.');

// Auto-run if desired
// (async () => {
//   await testRateLimitFunctions();
//   await testRLSPolicies();
//   await testRateLimitsTable();
// })();
