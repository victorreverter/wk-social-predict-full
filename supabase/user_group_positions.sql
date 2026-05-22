-- ============================================================
-- Phase 1: User Group Positions Table
-- Stores each user's predicted group rankings (1st-4th)
-- Run this in Supabase SQL Editor once to create the table.
-- ============================================================

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
