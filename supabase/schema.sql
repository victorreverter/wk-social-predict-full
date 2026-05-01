-- ============================================================
-- WC 2026 Social Predictor – Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard)
-- ============================================================

-- ── 0. Extensions ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── 1. Profiles ────────────────────────────────────────────
-- One row per authenticated user. Created automatically via trigger.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  is_master     boolean not null default false,  -- Only the admin is master
  total_points  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Expose to RLS: users can read all profiles, only edit own.
alter table public.profiles enable row level security;
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles"  on public.profiles for select using (true);

drop policy if exists "Own profile update" on public.profiles;
create policy "Own profile update"    on public.profiles for update using (auth.uid() = id);

-- ── 2. Prediction Lock ────────────────────────────────────
-- A single-row configuration table.
create table if not exists public.config (
  key   text primary key,
  value text not null
);

-- Date/time (ISO 8601 UTC) after which regular user predictions are locked.
insert into public.config (key, value)
values ('predictions_locked_at', '2026-06-11T18:00:00Z')
on conflict (key) do nothing;

-- ── 3. Official Match Results (Master Only) ───────────────
create table if not exists public.official_matches (
  match_id        text primary key,  -- Mirrors app match IDs: 'm1'..'m104'
  home_goals      integer,
  away_goals      integer,
  home_penalties  integer,
  away_penalties  integer,
  went_to_pens    boolean not null default false,
  status          text not null default 'NOT_PLAYED',  -- NOT_PLAYED | FINISHED
  updated_at      timestamptz not null default now()
);

alter table public.official_matches enable row level security;
drop policy if exists "Public read official matches" on public.official_matches;
create policy "Public read official matches"  on public.official_matches for select using (true);

drop policy if exists "Master can write matches" on public.official_matches;
create policy "Master can write matches"      on public.official_matches for all
  using  ((select is_master from public.profiles where id = auth.uid()))
  with check ((select is_master from public.profiles where id = auth.uid()));

-- ── 4. Official Awards (Master Only) ─────────────────────
create table if not exists public.official_awards (
  category  text primary key,  -- golden_ball | golden_boot | golden_glove | etc.
  value     text,              -- Player or team name
  updated_at timestamptz not null default now()
);

alter table public.official_awards enable row level security;
drop policy if exists "Public read official awards" on public.official_awards;
create policy "Public read official awards"  on public.official_awards for select using (true);

drop policy if exists "Master can write awards" on public.official_awards;
create policy "Master can write awards"      on public.official_awards for all
  using  ((select is_master from public.profiles where id = auth.uid()))
  with check ((select is_master from public.profiles where id = auth.uid()));

-- ── 5. Official Knockout Progression (Master Only) ───────
-- Tracks which team IDs actually reached each round.
create table if not exists public.official_knockout_teams (
  round    text not null,    -- R32 | R16 | QF | SF | F | CHAMPION
  team_id  text not null,
  primary key (round, team_id)
);

alter table public.official_knockout_teams enable row level security;
drop policy if exists "Public read knockout teams" on public.official_knockout_teams;
create policy "Public read knockout teams"  on public.official_knockout_teams for select using (true);

drop policy if exists "Master can write ko teams" on public.official_knockout_teams;
create policy "Master can write ko teams"   on public.official_knockout_teams for all
  using  ((select is_master from public.profiles where id = auth.uid()))
  with check ((select is_master from public.profiles where id = auth.uid()));

-- ── 6. User Match Predictions ────────────────────────────
create table if not exists public.user_predictions_matches (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  match_id        text not null,
  pred_home_goals integer,
  pred_away_goals integer,
  pred_home_pens  integer,
  pred_away_pens  integer,
  pred_went_pens  boolean,
  pts_earned      integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table public.user_predictions_matches enable row level security;
drop policy if exists "Users own match predictions" on public.user_predictions_matches;
create policy "Users own match predictions" on public.user_predictions_matches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read match preds" on public.user_predictions_matches;
create policy "Public read match preds" on public.user_predictions_matches for select using (true);

-- ── 7. User Award Predictions ────────────────────────────
create table if not exists public.user_predictions_awards (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null,
  value      text,
  pts_earned integer not null default 0,
  unique (user_id, category)
);

alter table public.user_predictions_awards enable row level security;
drop policy if exists "Users own award predictions" on public.user_predictions_awards;
create policy "Users own award predictions" on public.user_predictions_awards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read award preds" on public.user_predictions_awards;
create policy "Public read award preds" on public.user_predictions_awards for select using (true);

-- ── 8. User Knockout Progression Predictions ─────────────
create table if not exists public.user_predictions_knockout (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  round      text not null,
  team_id    text not null,
  pts_earned integer not null default 0,
  unique (user_id, round, team_id)
);

alter table public.user_predictions_knockout enable row level security;
drop policy if exists "Users own ko predictions" on public.user_predictions_knockout;
create policy "Users own ko predictions" on public.user_predictions_knockout for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read ko preds" on public.user_predictions_knockout;
create policy "Public read ko preds" on public.user_predictions_knockout for select using (true);


-- ── 8B. Official Tournament XI (Master Only) ──────────────
create table if not exists public.official_tournament_xi (
  position   text primary key,  -- 'GK', 'FP1', 'FP2', ..., 'FP10'
  player_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.official_tournament_xi enable row level security;
drop policy if exists "Public read official xi" on public.official_tournament_xi;
create policy "Public read official xi"  on public.official_tournament_xi for select using (true);

drop policy if exists "Master can write official xi" on public.official_tournament_xi;
create policy "Master can write official xi" on public.official_tournament_xi for all
  using  ((select is_master from public.profiles where id = auth.uid()))
  with check ((select is_master from public.profiles where id = auth.uid()));


-- ── 8C. User Tournament XI Predictions ────────────────────
create table if not exists public.user_predictions_xi (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  position    text not null,   -- e.g. ST, CAM, etc. depending on formation
  player_name text not null,
  pts_earned  integer not null default 0,
  unique (user_id, position)
);

alter table public.user_predictions_xi enable row level security;
drop policy if exists "Users own xi predictions" on public.user_predictions_xi;
create policy "Users own xi predictions" on public.user_predictions_xi for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read xi preds" on public.user_predictions_xi;
create policy "Public read xi preds" on public.user_predictions_xi for select using (true);


-- ── 9. Trigger: Auto-create profile on sign-up ───────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 9B. RPC: Ensure profile exists (bypasses RLS) ──────────
create or replace function public.ensure_profile(target_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  prof record;
  uname text;
begin
  select * into prof from public.profiles where id = target_id;
  if prof.id is not null then
    return jsonb_build_object('found', true, 'id', prof.id);
  end if;
  
  select coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1), 'user_' || left(target_id::text, 8))
  into uname from auth.users where id = target_id;
  
  insert into public.profiles (id, username, display_name, is_master, total_points)
  values (target_id, uname, uname, false, 0)
  on conflict (id) do nothing;
  
  return jsonb_build_object('created', true, 'id', target_id);
end;
$$;

-- ── 10. Scoring Rules (editable by master) ───────────────
create table if not exists public.scoring_rules (
  rule_key    text primary key,
  pts         integer not null,
  description text
);

insert into public.scoring_rules (rule_key, pts, description) values
  ('match_exact_score',      3,  'Exact scoreline'),
  ('match_correct_outcome',  1,  'Correct W/D/L but wrong score'),
  ('match_went_to_pens',     2,  'Correct: game went to penalties'),
  ('match_pens_winner',      3,  'Correct penalty shootout winner'),
  ('award_major',           10,  'Golden Ball / Boot / Glove'),
  ('award_minor',            5,  'Fair Play, Young Player, Cards'),
  ('ko_reach_r16',           2,  'Team correctly predicted in R16'),
  ('ko_reach_qf',            5,  'Team correctly predicted in QF'),
  ('ko_reach_sf',           10,  'Team correctly predicted in SF'),
  ('ko_reach_final',        15,  'Team correctly predicted in Final'),
  ('ko_champion',           25,  'Correct World Cup Champion'),
  ('xi_goalkeeper',          5,  'Correct Goalkeeper in Tournament XI'),
  ('xi_field_player',        3,  'Correct Field Player in Tournament XI')
on conflict (rule_key) do nothing;

alter table public.scoring_rules enable row level security;
drop policy if exists "Public read rules" on public.scoring_rules;
create policy "Public read rules"   on public.scoring_rules for select using (true);

drop policy if exists "Master can edit rules" on public.scoring_rules;
create policy "Master can edit rules" on public.scoring_rules for all
  using  ((select is_master from public.profiles where id = auth.uid()))
  with check ((select is_master from public.profiles where id = auth.uid()));

-- ── 11. Leaderboard View ─────────────────────────────────
create or replace view public.leaderboard as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.total_points,
  rank() over (order by p.total_points desc) as rank
from public.profiles p
where p.is_master = false
order by p.total_points desc;
