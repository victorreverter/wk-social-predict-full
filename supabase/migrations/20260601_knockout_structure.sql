-- ============================================================
-- User Knockout Bracket Structure Table
-- Stores the full match-by-match bracket for each user
-- ============================================================

create table if not exists public.user_predictions_knockout_structure (
  user_id            uuid not null references public.profiles(id) on delete cascade,
  match_id           text not null,
  pred_home_team_id  text,
  pred_away_team_id  text,
  pred_home_goals    integer,
  pred_away_goals    integer,
  pred_home_pens     integer,
  pred_away_pens     integer,
  pred_status        text not null default 'NOT_PLAYED',
  updated_at         timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.user_predictions_knockout_structure enable row level security;

drop policy if exists "Users own ko structure" on public.user_predictions_knockout_structure;
create policy "Users own ko structure" on public.user_predictions_knockout_structure for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read ko structure" on public.user_predictions_knockout_structure;
create policy "Public read ko structure" on public.user_predictions_knockout_structure for select using (true);
