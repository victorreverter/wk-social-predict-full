-- ============================================================
-- Optimized RLS Policies
-- Replaces per-row `(select is_master from profiles where id = auth.uid())`
-- subqueries with a single auth.uid() IN lookup.
-- Run in Supabase SQL Editor after deploying the app.
-- ============================================================

-- ── Config: Master write ──────────────────────────────────
drop policy if exists "Master can write config" on public.config;
create policy "Master can write config"
  on public.config for all
  using (auth.uid() in (select id from public.profiles where is_master = true))
  with check (auth.uid() in (select id from public.profiles where is_master = true));

-- ── Official Matches ──────────────────────────────────────
drop policy if exists "Master can insert matches" on public.official_matches;
create policy "Master can insert matches"
  on public.official_matches for insert
  with check (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can update matches" on public.official_matches;
create policy "Master can update matches"
  on public.official_matches for update
  using (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can delete matches" on public.official_matches;
create policy "Master can delete matches"
  on public.official_matches for delete
  using (auth.uid() in (select id from public.profiles where is_master = true));

-- ── Official Awards ───────────────────────────────────────
drop policy if exists "Master can insert awards" on public.official_awards;
create policy "Master can insert awards"
  on public.official_awards for insert
  with check (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can update awards" on public.official_awards;
create policy "Master can update awards"
  on public.official_awards for update
  using (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can delete awards" on public.official_awards;
create policy "Master can delete awards"
  on public.official_awards for delete
  using (auth.uid() in (select id from public.profiles where is_master = true));

-- ── Official KO Teams ─────────────────────────────────────
drop policy if exists "Master can insert ko teams" on public.official_knockout_teams;
create policy "Master can insert ko teams"
  on public.official_knockout_teams for insert
  with check (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can update ko teams" on public.official_knockout_teams;
create policy "Master can update ko teams"
  on public.official_knockout_teams for update
  using (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can delete ko teams" on public.official_knockout_teams;
create policy "Master can delete ko teams"
  on public.official_knockout_teams for delete
  using (auth.uid() in (select id from public.profiles where is_master = true));

-- ── Official Tournament XI ─────────────────────────────────
drop policy if exists "Master can insert xi" on public.official_tournament_xi;
create policy "Master can insert xi"
  on public.official_tournament_xi for insert
  with check (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can update xi" on public.official_tournament_xi;
create policy "Master can update xi"
  on public.official_tournament_xi for update
  using (auth.uid() in (select id from public.profiles where is_master = true));

drop policy if exists "Master can delete xi" on public.official_tournament_xi;
create policy "Master can delete xi"
  on public.official_tournament_xi for delete
  using (auth.uid() in (select id from public.profiles where is_master = true));

-- ── Index support for the IN subquery ──────────────────────
create index if not exists idx_profiles_master_ids
  on public.profiles (id)
  where is_master = true;
