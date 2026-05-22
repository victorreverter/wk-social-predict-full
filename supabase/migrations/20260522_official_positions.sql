-- ============================================================
-- Phase 4: Official Group Positions Table
-- Admin-confirmed final group positions (1st-4th per group)
-- Used by scoreGroupPositions to compare vs user predictions
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists public.official_group_positions (
    group_letter text primary key,
    "order"      text[] not null,
    updated_at   timestamptz default now()
);

alter table public.official_group_positions enable row level security;

drop policy if exists "Public read official positions" on public.official_group_positions;
create policy "Public read official positions"
    on public.official_group_positions for select
    using (true);

drop policy if exists "Master can manage official positions" on public.official_group_positions;
create policy "Master can manage official positions"
    on public.official_group_positions for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));

-- ============================================================
-- Official Bracket Positions Table
-- Admin-confirmed teams reaching each knockout round
-- One row per round: stores array of team IDs
-- ============================================================

create table if not exists public.official_bracket (
    round       text primary key,
    team_ids    text[] not null,
    champion    text,
    updated_at  timestamptz default now()
);

alter table public.official_bracket enable row level security;

drop policy if exists "Public read official bracket" on public.official_bracket;
create policy "Public read official bracket"
    on public.official_bracket for select
    using (true);

drop policy if exists "Master can manage official bracket" on public.official_bracket;
create policy "Master can manage official bracket"
    on public.official_bracket for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));
