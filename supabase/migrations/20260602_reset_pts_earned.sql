-- ────────────────────────────────────────────────────────────────────────────
-- 20260602_reset_pts_earned.sql
-- One-off cleanup: zero all wrongly-awarded points and re-derive
-- profiles.total_points from the (now correct) per-row sums.
--
-- Background: a pre-tournament bug in src/lib/scoreKnockout.ts fabricated
-- a "R32 official set" from empty group standings whenever any group match
-- was FINISHED in official_matches. Users with R32 predictions that happened
-- to match the fabricated team IDs were awarded pts_earned = 2 per team.
-- This migration zeroes those phantom points and re-sums every profile total.
--
-- Run this ONCE in the Supabase SQL Editor.
-- Safe to re-run: every UPDATE / DELETE uses <> 0 / IS DISTINCT FROM guards.
-- ────────────────────────────────────────────────────────────────────────────

-- A) Zero per-row points across every prediction table
update public.user_predictions_matches     set pts_earned = 0 where pts_earned <> 0;
update public.user_predictions_knockout   set pts_earned = 0 where pts_earned <> 0;
update public.user_predictions_awards      set pts_earned = 0 where pts_earned <> 0;
update public.user_predictions_xi          set pts_earned = 0 where pts_earned <> 0;
update public.user_group_positions         set pts_earned = 0 where pts_earned <> 0;
update public.user_predictions_eredivisie  set pts_earned = 0 where pts_earned <> 0;

-- B) Re-derive profiles.total_points from the (now zero) per-row sums.
-- Use a CTE that UNIONs every distinct user_id across all six tables, so
-- every user who appears in ANY prediction table is included in the update.
-- Each subquery is LEFT JOINed from that CTE so a user missing from one
-- table still gets updated (with 0 for that table).
with users as (
    select user_id from public.user_predictions_matches
    union
    select user_id from public.user_predictions_knockout
    union
    select user_id from public.user_predictions_awards
    union
    select user_id from public.user_predictions_xi
    union
    select user_id from public.user_group_positions
    union
    select user_id from public.user_predictions_eredivisie
)
update public.profiles p
set    total_points = coalesce(m.pts, 0)
                    + coalesce(k.pts, 0)
                    + coalesce(a.pts, 0)
                    + coalesce(x.pts, 0)
                    + coalesce(g.pts, 0)
                    + coalesce(e.pts, 0)
from        users u
left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_matches    group by user_id) m on m.user_id = u.user_id
left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_knockout group by user_id) k on k.user_id = u.user_id
left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_awards   group by user_id) a on a.user_id = u.user_id
left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_xi        group by user_id) x on x.user_id = u.user_id
left join   (select user_id, sum(pts_earned) as pts from public.user_group_positions      group by user_id) g on g.user_id = u.user_id
left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_eredivisie group by user_id) e on e.user_id = u.user_id
where  p.id = u.user_id;

-- B2) Catch any profile that has no rows in any prediction table at all
-- (e.g., brand-new users). Their total_points should also be 0.
update public.profiles
set    total_points = 0
where  (total_points is null or total_points <> 0)
  and  not exists (select 1 from public.user_predictions_matches    where user_id = profiles.id)
  and  not exists (select 1 from public.user_predictions_knockout  where user_id = profiles.id)
  and  not exists (select 1 from public.user_predictions_awards    where user_id = profiles.id)
  and  not exists (select 1 from public.user_predictions_xi        where user_id = profiles.id)
  and  not exists (select 1 from public.user_group_positions      where user_id = profiles.id)
  and  not exists (select 1 from public.user_predictions_eredivisie where user_id = profiles.id);

-- C) Sanity check: confirm zero rows have any non-zero points before the
--    tournament starts. Should return no rows.
select 'KO points remaining' as check_name,
       count(*) as rows_with_pts
from   public.user_predictions_knockout
where  pts_earned <> 0
union all
select 'matches points remaining',
       count(*)
from   public.user_predictions_matches
where  pts_earned <> 0
union all
select 'awards points remaining',
       count(*)
from   public.user_predictions_awards
where  pts_earned <> 0
union all
select 'xi points remaining',
       count(*)
from   public.user_predictions_xi
where  pts_earned <> 0
union all
select 'group positions points remaining',
       count(*)
from   public.user_group_positions
where  pts_earned <> 0
union all
select 'eredivisie points remaining',
       count(*)
from   public.user_predictions_eredivisie
where  pts_earned <> 0;
