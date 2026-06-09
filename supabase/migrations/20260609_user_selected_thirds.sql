-- ============================================================
-- User Selected Thirds Table
-- Persists the 8 third-place teams a user selects for bracket seeding.
-- This prevents data loss when the knockout structure is rebuilt.
-- ============================================================

create table if not exists public.user_selected_thirds (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  team_ids   text[] not null,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.user_selected_thirds enable row level security;

drop policy if exists "Users own selected thirds" on public.user_selected_thirds;
create policy "Users own selected thirds" on public.user_selected_thirds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read selected thirds" on public.user_selected_thirds;
create policy "Public read selected thirds" on public.user_selected_thirds for select using (true);
