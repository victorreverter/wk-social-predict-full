-- Enforce per-match time locks for actual knockout game predictions.
-- This mirrors the protection already present on user_predictions_matches.

drop policy if exists "Users own ko games" on public.user_predictions_ko_games;

create policy "Users insert ko games unlocked only"
on public.user_predictions_ko_games for insert
with check (
  auth.uid() = user_id
  and not exists (
    select 1
    from public.official_matches om
    where om.match_id = user_predictions_ko_games.match_id
      and (om.locked_at is not null or public.should_match_be_locked(om.date))
  )
);

create policy "Users update ko games unlocked only"
on public.user_predictions_ko_games for update
using (
  auth.uid() = user_id
  and not exists (
    select 1
    from public.official_matches om
    where om.match_id = user_predictions_ko_games.match_id
      and (om.locked_at is not null or public.should_match_be_locked(om.date))
  )
)
with check (
  auth.uid() = user_id
  and not exists (
    select 1
    from public.official_matches om
    where om.match_id = user_predictions_ko_games.match_id
      and (om.locked_at is not null or public.should_match_be_locked(om.date))
  )
);

create policy "Users delete own ko games"
on public.user_predictions_ko_games for delete
using (auth.uid() = user_id);

