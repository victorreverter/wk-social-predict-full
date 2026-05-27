-- ============================================================
-- Combined migration: Group Positions tables + scoring
-- Run in Supabase SQL Editor (supabase.com → SQL Editor → paste → Run)
-- ============================================================

-- Phase 1: User Group Positions Table (stores user's predicted rankings 1st-4th)
create table if not exists public.user_group_positions (
    user_id      uuid references public.profiles(id) on delete cascade not null,
    group_letter text not null,
    "order"      text[] not null,
    primary key (user_id, group_letter)
);

alter table public.user_group_positions enable row level security;

create policy "Users can read own group positions"
    on public.user_group_positions for select
    using (auth.uid() = user_id);

create policy "Users can insert own group positions"
    on public.user_group_positions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own group positions"
    on public.user_group_positions for update
    using (auth.uid() = user_id);

create policy "Users can delete own group positions"
    on public.user_group_positions for delete
    using (auth.uid() = user_id);

-- Phase 3: Add pts_earned column + scoring rule
alter table public.user_group_positions
    add column if not exists pts_earned integer not null default 0;

insert into public.scoring_rules (rule_key, pts, description) values
    ('group_position_correct', 2, 'Correct predicted position in group (1st-4th)')
on conflict (rule_key) do nothing;

-- Phase 4: Official Group Positions & Bracket tables (for admin)
create table if not exists public.official_group_positions (
    group_letter text primary key,
    "order"      text[] not null,
    updated_at   timestamptz default now()
);

alter table public.official_group_positions enable row level security;

create policy "Public read official positions"
    on public.official_group_positions for select
    using (true);

create policy "Master can manage official positions"
    on public.official_group_positions for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));

create table if not exists public.official_bracket (
    round       text primary key,
    team_ids    text[] not null,
    champion    text,
    updated_at  timestamptz default now()
);

alter table public.official_bracket enable row level security;

create policy "Public read official bracket"
    on public.official_bracket for select
    using (true);

create policy "Master can manage official bracket"
    on public.official_bracket for all
    using ((select is_master from public.profiles where id = auth.uid()))
    with check ((select is_master from public.profiles where id = auth.uid()));
