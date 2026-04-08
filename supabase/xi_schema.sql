-- ============================================================
-- WC 2026 – Tournament XI Extension
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── Table: Official Tournament XI (Master enters this) ─────
create table if not exists public.official_tournament_xi (
  position    text primary key,  -- 'GK' | 'FP1'..'FP10'
  player_name text not null,
  updated_at  timestamptz not null default now()
);

alter table public.official_tournament_xi enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='official_tournament_xi' and policyname='Public read official xi') then
    execute 'create policy "Public read official xi" on public.official_tournament_xi for select using (true)';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='official_tournament_xi' and policyname='Master can write xi') then
    execute $p$create policy "Master can write xi" on public.official_tournament_xi for all
      using  ((select is_master from public.profiles where id = auth.uid()))
      with check ((select is_master from public.profiles where id = auth.uid()))$p$;
  end if;
end $$;

-- ── Table: User Tournament XI Predictions ──────────────────
create table if not exists public.user_predictions_xi (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  position    text not null,   -- e.g. 'GK', 'LCB', 'ST', etc.
  player_name text not null,
  pts_earned  integer not null default 0,
  unique (user_id, position)
);

alter table public.user_predictions_xi enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_predictions_xi' and policyname='Users own xi preds') then
    execute $p$create policy "Users own xi preds" on public.user_predictions_xi for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id)$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_predictions_xi' and policyname='Public read xi preds') then
    execute 'create policy "Public read xi preds" on public.user_predictions_xi for select using (true)';
  end if;
end $$;

-- ── Scoring rules for XI ───────────────────────────────────
insert into public.scoring_rules (rule_key, pts, description) values
  ('xi_gk_match',     5, 'Correct Goalkeeper in Tournament XI'),
  ('xi_player_match', 3, 'Correct field player in Tournament XI')
on conflict (rule_key) do nothing;
