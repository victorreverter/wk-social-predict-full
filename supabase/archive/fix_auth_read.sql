-- ============================================================
-- High-priority security fixes #3 & #4
-- 1. Require authentication for ALL read operations
-- 2. Hide is_master from public (authenticated-only profile read)
-- Run ONCE in Supabase SQL Editor
-- ============================================================

-- ── #3: Profiles — require auth to read (hides is_master from anon) ──
drop policy if exists "Public read profiles" on public.profiles;
create policy "Authenticated read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- ── #4: Prediction tables — require auth to read ────────────
drop policy if exists "Public read match preds" on public.user_predictions_matches;
create policy "Authenticated read match preds"
  on public.user_predictions_matches for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read award preds" on public.user_predictions_awards;
create policy "Authenticated read award preds"
  on public.user_predictions_awards for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read ko preds" on public.user_predictions_knockout;
create policy "Authenticated read ko preds"
  on public.user_predictions_knockout for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read xi preds" on public.user_predictions_xi;
create policy "Authenticated read xi preds"
  on public.user_predictions_xi for select
  using (auth.role() = 'authenticated');

-- ── Also lock official data to authenticated-only ───────────
-- While official_matches/awards/knockout are "game results," 
-- requiring auth prevents anonymous scraping
drop policy if exists "Public read official matches" on public.official_matches;
create policy "Authenticated read official matches"
  on public.official_matches for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read official awards" on public.official_awards;
create policy "Authenticated read official awards"
  on public.official_awards for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read knockout teams" on public.official_knockout_teams;
create policy "Authenticated read knockout teams"
  on public.official_knockout_teams for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read official xi" on public.official_tournament_xi;
create policy "Authenticated read official xi"
  on public.official_tournament_xi for select
  using (auth.role() = 'authenticated');

-- ── Also lock config + scoring_rules to authenticated ───────
drop policy if exists "Public read config" on public.config;
create policy "Authenticated read config"
  on public.config for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public read rules" on public.scoring_rules;
create policy "Authenticated read rules"
  on public.scoring_rules for select
  using (auth.role() = 'authenticated');

-- ── Verify all policies ─────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
