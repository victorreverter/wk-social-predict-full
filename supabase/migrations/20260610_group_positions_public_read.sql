-- Add public read policy for user_group_positions so other users
-- can see group position predictions in the leaderboard modal.
-- Previously only the owner could read their own group positions.

drop policy if exists "Public read group positions" on public.user_group_positions;
create policy "Public read group positions" on public.user_group_positions for select using (true);
