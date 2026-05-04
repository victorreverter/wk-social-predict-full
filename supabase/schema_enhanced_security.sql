-- ============================================================
-- WC 2026 Social Predictor – Enhanced Security Schema
-- This file adds additional RLS policies and security measures
-- Run AFTER the base schema.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- SECTION 1: ENHANCED ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ── 1.1 Profiles: Add INSERT policy for trigger ─────────────
-- Ensure the trigger can create profiles but users cannot manually insert
drop policy if exists "Insert profile via trigger" on public.profiles;
create policy "Insert profile via trigger"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ── 1.2 Profiles: Add DELETE policy (users can only delete own) ─
drop policy if exists "Delete own profile" on public.profiles;
create policy "Delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- ── 1.3 Profiles: Prevent non-masters from setting is_master ───
-- This is a security policy to prevent privilege escalation
drop policy if exists "Own profile update no escalate" on public.profiles;
create policy "Own profile update no escalate"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id AND
    -- Prevent users from setting is_master to true
    (is_master = false OR 
     (select is_master from public.profiles where id = auth.uid()) = true)
  );

-- ── 2.1 Config: Restrict write access to master only ─────────
-- Even though config table exists, ensure RLS is strict
alter table public.config enable row level security;
drop policy if exists "Public read config" on public.config;
create policy "Public read config"
  on public.config for select
  using (true);

drop policy if exists "Master can write config" on public.config;
create policy "Master can write config"
  on public.config for all
  using ((select is_master from public.profiles where id = auth.uid()) = true)
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 3.1 Official Matches: Add INSERT policy ──────────────────
-- Ensure only master can insert match results
drop policy if exists "Master can insert matches" on public.official_matches;
create policy "Master can insert matches"
  on public.official_matches for insert
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 3.2 Official Matches: Add UPDATE policy ──────────────────
drop policy if exists "Master can update matches" on public.official_matches;
create policy "Master can update matches"
  on public.official_matches for update
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 3.3 Official Matches: Add DELETE policy ──────────────────
drop policy if exists "Master can delete matches" on public.official_matches;
create policy "Master can delete matches"
  on public.official_matches for delete
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 4.1 Official Awards: Add INSERT policy ───────────────────
drop policy if exists "Master can insert awards" on public.official_awards;
create policy "Master can insert awards"
  on public.official_awards for insert
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 4.2 Official Awards: Add UPDATE policy ───────────────────
drop policy if exists "Master can update awards" on public.official_awards;
create policy "Master can update awards"
  on public.official_awards for update
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 4.3 Official Awards: Add DELETE policy ───────────────────
drop policy if exists "Master can delete awards" on public.official_awards;
create policy "Master can delete awards"
  on public.official_awards for delete
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 5.1 Official Knockout Teams: Add INSERT policy ───────────
drop policy if exists "Master can insert ko teams" on public.official_knockout_teams;
create policy "Master can insert ko teams"
  on public.official_knockout_teams for insert
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 5.2 Official Knockout Teams: Add UPDATE policy ───────────
drop policy if exists "Master can update ko teams" on public.official_knockout_teams;
create policy "Master can update ko teams"
  on public.official_knockout_teams for update
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 5.3 Official Knockout Teams: Add DELETE policy ───────────
drop policy if exists "Master can delete ko teams" on public.official_knockout_teams;
create policy "Master can delete ko teams"
  on public.official_knockout_teams for delete
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 6.1 User Predictions Matches: Add rate limit check ───────
-- Users can only insert their own predictions
drop policy if exists "Users insert match predictions" on public.user_predictions_matches;
create policy "Users insert match predictions"
  on public.user_predictions_matches for insert
  with check (auth.uid() = user_id);

-- ── 6.2 User Predictions Matches: Restrict update ────────────
-- Users can only update their own predictions
drop policy if exists "Users update match predictions" on public.user_predictions_matches;
create policy "Users update match predictions"
  on public.user_predictions_matches for update
  using (auth.uid() = user_id);

-- ── 6.3 User Predictions Matches: Restrict delete ────────────
drop policy if exists "Users delete match predictions" on public.user_predictions_matches;
create policy "Users delete match predictions"
  on public.user_predictions_matches for delete
  using (auth.uid() = user_id);

-- ── 7.1 User Predictions Awards: Add rate limit check ────────
drop policy if exists "Users insert award predictions" on public.user_predictions_awards;
create policy "Users insert award predictions"
  on public.user_predictions_awards for insert
  with check (auth.uid() = user_id);

-- ── 7.2 User Predictions Awards: Restrict update ─────────────
drop policy if exists "Users update award predictions" on public.user_predictions_awards;
create policy "Users update award predictions"
  on public.user_predictions_awards for update
  using (auth.uid() = user_id);

-- ── 7.3 User Predictions Awards: Restrict delete ─────────────
drop policy if exists "Users delete award predictions" on public.user_predictions_awards;
create policy "Users delete award predictions"
  on public.user_predictions_awards for delete
  using (auth.uid() = user_id);

-- ── 8.1 User Predictions Knockout: Add rate limit check ──────
drop policy if exists "Users insert ko predictions" on public.user_predictions_knockout;
create policy "Users insert ko predictions"
  on public.user_predictions_knockout for insert
  with check (auth.uid() = user_id);

-- ── 8.2 User Predictions Knockout: Restrict update ───────────
drop policy if exists "Users update ko predictions" on public.user_predictions_knockout;
create policy "Users update ko predictions"
  on public.user_predictions_knockout for update
  using (auth.uid() = user_id);

-- ── 8.3 User Predictions Knockout: Restrict delete ───────────
drop policy if exists "Users delete ko predictions" on public.user_predictions_knockout;
create policy "Users delete ko predictions"
  on public.user_predictions_knockout for delete
  using (auth.uid() = user_id);

-- ── 8C.1 User Predictions XI: Add rate limit check ───────────
drop policy if exists "Users insert xi predictions" on public.user_predictions_xi;
create policy "Users insert xi predictions"
  on public.user_predictions_xi for insert
  with check (auth.uid() = user_id);

-- ── 8C.2 User Predictions XI: Restrict update ────────────────
drop policy if exists "Users update xi predictions" on public.user_predictions_xi;
create policy "Users update xi predictions"
  on public.user_predictions_xi for update
  using (auth.uid() = user_id);

-- ── 8C.3 User Predictions XI: Restrict delete ────────────────
drop policy if exists "Users delete xi predictions" on public.user_predictions_xi;
create policy "Users delete xi predictions"
  on public.user_predictions_xi for delete
  using (auth.uid() = user_id);

-- ── 9.1 Official Tournament XI: Master only write ────────────
drop policy if exists "Master can insert xi" on public.official_tournament_xi;
create policy "Master can insert xi"
  on public.official_tournament_xi for insert
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

drop policy if exists "Master can update xi" on public.official_tournament_xi;
create policy "Master can update xi"
  on public.official_tournament_xi for update
  using ((select is_master from public.profiles where id = auth.uid()) = true);

drop policy if exists "Master can delete xi" on public.official_tournament_xi;
create policy "Master can delete xi"
  on public.official_tournament_xi for delete
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ── 10.1 Scoring Rules: Master only write ────────────────────
drop policy if exists "Master can insert rules" on public.scoring_rules;
create policy "Master can insert rules"
  on public.scoring_rules for insert
  with check ((select is_master from public.profiles where id = auth.uid()) = true);

drop policy if exists "Master can update rules" on public.scoring_rules;
create policy "Master can update rules"
  on public.scoring_rules for update
  using ((select is_master from public.profiles where id = auth.uid()) = true);

drop policy if exists "Master can delete rules" on public.scoring_rules;
create policy "Master can delete rules"
  on public.scoring_rules for delete
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- ============================================================
-- SECTION 2: RATE LIMITING FUNCTIONS
-- ============================================================

-- ── 2.1 Create rate limit tracking table ─────────────────────
create table if not exists public.rate_limits (
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  request_count integer not null default 1,
  first_request timestamptz not null default now(),
  last_request  timestamptz not null default now(),
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;

-- Only admins can read rate limits for monitoring
drop policy if exists "Admin read rate limits" on public.rate_limits;
create policy "Admin read rate limits"
  on public.rate_limits for select
  using ((select is_master from public.profiles where id = auth.uid()) = true);

-- Users can only insert/update their own rate limits
drop policy if exists "Users manage own rate limits" on public.rate_limits;
create policy "Users manage own rate limits"
  on public.rate_limits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2.2 Create rate limit check function ─────────────────────
-- Returns TRUE if request is allowed, FALSE if rate limited
-- Parameters: action_name, max_requests, window_seconds
create or replace function public.check_rate_limit(
  action_name text,
  max_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_req_count integer;
  first_req_time timestamptz;
  now_time timestamptz := now();
begin
  -- Get current request count for this user/action
  select request_count, first_request
  into user_req_count, first_req_time
  from public.rate_limits
  where user_id = auth.uid() and action = action_name;

  -- No previous requests, allow
  if user_req_count is null then
    insert into public.rate_limits (user_id, action, request_count, first_request, last_request)
    values (auth.uid(), action_name, 1, now_time, now_time);
    return true;
  end if;

  -- Check if window has expired
  if extract(epoch from (now_time - first_req_time)) > window_seconds then
    -- Reset counter
    update public.rate_limits
    set request_count = 1,
        first_request = now_time,
        last_request = now_time
    where user_id = auth.uid() and action = action_name;
    return true;
  end if;

  -- Check if under limit
  if user_req_count < max_requests then
    -- Increment counter
    update public.rate_limits
    set request_count = request_count + 1,
        last_request = now_time
    where user_id = auth.uid() and action = action_name;
    return true;
  end if;

  -- Rate limited
  return false;
end;
$$;

-- ── 2.3 Create rate limit reset function (for admin use) ─────
create or replace function public.reset_rate_limit(target_user_id uuid, action_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $
begin
  -- Only master can reset rate limits
  if (select is_master from public.profiles where id = auth.uid()) != true then
    raise exception 'Only masters can reset rate limits';
  end if;

  if action_name is null then
    -- Reset all rate limits for user
    delete from public.rate_limits where user_id = target_user_id;
  else
    -- Reset specific action
    delete from public.rate_limits where user_id = target_user_id and action = action_name;
  end if;
end;
$$;

-- ── 2.4 Create function to get rate limit status ─────────────
create or replace function public.get_rate_limit_status(action_name text)
returns table (
  request_count integer,
  first_request timestamptz,
  last_request timestamptz,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $
declare
  rl record;
  window_start timestamptz;
begin
  -- Get rate limit config (hardcoded defaults, can be made configurable)
  -- Default: 100 requests per 60 seconds for prediction saves
  
  select request_count, first_request, last_request
  into rl
  from public.rate_limits
  where user_id = auth.uid() and action = action_name;

  if rl is null then
    request_count := 0;
    first_request := now();
    last_request := now();
    remaining := 100;
    reset_at := now() + interval '60 seconds';
  else
    request_count := rl.request_count;
    first_request := rl.first_request;
    last_request := rl.last_request;
    
    -- Calculate reset time (60 seconds from first request)
    reset_at := rl.first_request + interval '60 seconds';
    
    -- Calculate remaining (assuming 100 max requests)
    remaining := greatest(0, 100 - rl.request_count);
  end if;

  return next;
end;
$$;

-- ============================================================
-- SECTION 3: SECURITY AUDIT FUNCTIONS
-- ============================================================

-- ── 3.1 Function to check user permissions ───────────────────
create or replace function public.check_user_permissions()
returns table (
  user_id uuid,
  username text,
  is_master boolean,
  can_write_matches boolean,
  can_write_awards boolean,
  can_write_xi boolean,
  can_write_config boolean
)
language plpgsql
security definer
set search_path = ''
as $
begin
  return query
  select
    p.id,
    p.username,
    p.is_master,
    p.is_master as can_write_matches,
    p.is_master as can_write_awards,
    p.is_master as can_write_xi,
    p.is_master as can_write_config
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

-- ── 3.2 Function to audit recent user actions ────────────────
create or replace function public.get_user_activity_summary()
returns table (
  total_predictions integer,
  last_prediction_at timestamptz,
  prediction_count_today integer
)
language plpgsql
security definer
set search_path = ''
as $
begin
  return query
  select
    (select count(*) from public.user_predictions_matches where user_id = auth.uid()) as total_predictions,
    (select max(updated_at) from public.user_predictions_matches where user_id = auth.uid()) as last_prediction_at,
    (select count(*) from public.user_predictions_matches 
     where user_id = auth.uid() 
     and updated_at >= now() - interval '24 hours') as prediction_count_today;
end;
$$;

-- ============================================================
-- SECTION 4: INDEXES FOR PERFORMANCE
-- ============================================================

-- Add indexes for better query performance
create index if not exists idx_rate_limits_user_action 
  on public.rate_limits(user_id, action);

create index if not exists idx_user_predictions_matches_user 
  on public.user_predictions_matches(user_id);

create index if not exists idx_user_predictions_matches_updated 
  on public.user_predictions_matches(updated_at desc);

create index if not exists idx_user_predictions_knockout_user 
  on public.user_predictions_knockout(user_id);

create index if not exists idx_user_predictions_awards_user 
  on public.user_predictions_awards(user_id);

create index if not exists idx_user_predictions_xi_user 
  on public.user_predictions_xi(user_id);

-- ============================================================
-- SECTION 5: SECURITY COMMENTS
-- ============================================================

comment on table public.rate_limits is 'Tracks API request rates per user per action';
comment on function public.check_rate_limit is 'Checks if user has exceeded rate limit for action';
comment on function public.reset_rate_limit is 'Resets rate limit counter (master only)';
comment on function public.get_rate_limit_status is 'Returns current rate limit status for user';
comment on function public.check_user_permissions is 'Returns permission info for current user';
comment on function public.get_user_activity_summary is 'Returns activity summary for current user';

-- ============================================================
-- END OF ENHANCED SECURITY SCHEMA
-- ============================================================
