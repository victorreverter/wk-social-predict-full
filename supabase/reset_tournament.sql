-- ============================================================
-- Tournament Reset Function
-- SECURITY DEFINER bypasses RLS.
--   Masters  → reset official_matches to pending, wipe official awards/XI/eredivisie, zero all points
--   Regular  → zero own points only
--   All user predictions PRESERVED.
-- Run this in Supabase SQL Editor once after every change.
-- ============================================================

create or replace function public.reset_tournament()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id     uuid;
    caller_master boolean;
begin
    caller_id := (select (current_setting('request.jwt.claims', true)::jsonb) ->> 'sub')::uuid;
    if caller_id is null then
        return jsonb_build_object('success', false, 'message', 'Not authenticated.');
    end if;

    select is_master into caller_master
    from public.profiles
    where id = caller_id;

    if caller_master is true then
        update public.official_matches set
            home_goals = null,
            away_goals = null,
            home_penalties = null,
            away_penalties = null,
            went_to_pens = false,
            status = 'NOT_PLAYED',
            date = null,
            locked_at = null
        where true;

        delete from public.official_awards where true;
        delete from public.official_tournament_xi where true;
        delete from public.official_eredivisie where true;
        delete from public.official_group_positions where true;
        delete from public.official_bracket where true;

        -- Zero every per-table points column so leftover test/phantom points
        -- cannot survive a tournament reset. This covers all prediction tables
        -- (group matches, knockout, awards, XI, group positions, eredivisie).
        update public.user_predictions_matches   set pts_earned = 0 where pts_earned <> 0;
        update public.user_predictions_ko_games set pts_earned = 0 where pts_earned <> 0;
        update public.user_predictions_knockout set pts_earned = 0 where pts_earned <> 0;
        update public.user_predictions_awards    set pts_earned = 0 where pts_earned <> 0;
        update public.user_predictions_xi        set pts_earned = 0 where pts_earned <> 0;
        update public.user_group_positions       set pts_earned = 0 where pts_earned <> 0;
        update public.user_predictions_eredivisie set pts_earned = 0 where pts_earned <> 0;

        -- Re-derive profiles.total_points from the (now correct) per-row sums.
        -- This keeps the leaderboard consistent after a reset. Use a CTE
        -- UNION of every distinct user_id across the six prediction tables
        -- so users with rows in some tables but not others still get updated.
        with users as (
            select user_id from public.user_predictions_matches
            union
            select user_id from public.user_predictions_ko_games
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
                            + coalesce(kg.pts, 0)
                            + coalesce(k.pts, 0)
                            + coalesce(a.pts, 0)
                            + coalesce(x.pts, 0)
                            + coalesce(g.pts, 0)
                            + coalesce(e.pts, 0)
        from        users u
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_matches    group by user_id) m  on m.user_id  = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_ko_games  group by user_id) kg on kg.user_id = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_knockout group by user_id) k  on k.user_id  = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_awards   group by user_id) a  on a.user_id  = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_xi        group by user_id) x  on x.user_id  = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_group_positions      group by user_id) g  on g.user_id  = u.user_id
        left join   (select user_id, sum(pts_earned) as pts from public.user_predictions_eredivisie group by user_id) e on e.user_id = u.user_id
        where  p.id = u.user_id;

        -- B2) Catch any profile that has no rows in any prediction table at all
        -- (e.g., brand-new users). Their total_points should also be 0.
        update public.profiles
        set    total_points = 0
        where  (total_points is null or total_points <> 0)
          and  not exists (select 1 from public.user_predictions_matches    where user_id = profiles.id)
          and  not exists (select 1 from public.user_predictions_ko_games  where user_id = profiles.id)
          and  not exists (select 1 from public.user_predictions_knockout  where user_id = profiles.id)
          and  not exists (select 1 from public.user_predictions_awards    where user_id = profiles.id)
          and  not exists (select 1 from public.user_predictions_xi        where user_id = profiles.id)
          and  not exists (select 1 from public.user_group_positions      where user_id = profiles.id)
          and  not exists (select 1 from public.user_predictions_eredivisie where user_id = profiles.id);

        return jsonb_build_object('success', true, 'message', 'Tournament fully reset.');
    else
        -- Regular user: zero their own points across all tables and re-sum total.
        update public.user_predictions_matches     set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_predictions_ko_games   set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_predictions_knockout   set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_predictions_awards      set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_predictions_xi          set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_group_positions         set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.user_predictions_eredivisie  set pts_earned = 0 where user_id = caller_id and pts_earned <> 0;
        update public.profiles set total_points = 0 where id = caller_id;

        return jsonb_build_object('success', true, 'message', 'Your points have been cleared.');
    end if;
exception
    when others then
        return jsonb_build_object('success', false, 'message', SQLERRM);
end;
$$;

-- ============================================================
-- User Predictions Reset Function
-- SECURITY DEFINER bypasses RLS.
--   Deletes ALL the calling user's predictions from every table.
--   Admins should use reset_tournament() above instead.
-- ============================================================

create or replace function public.reset_user_predictions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id uuid;
begin
    caller_id := (select (current_setting('request.jwt.claims', true)::jsonb) ->> 'sub')::uuid;
    if caller_id is null then
        return jsonb_build_object('success', false, 'message', 'Not authenticated.');
    end if;

    delete from public.user_predictions_matches              where user_id = caller_id;
    delete from public.user_predictions_ko_games              where user_id = caller_id;
    delete from public.user_predictions_knockout               where user_id = caller_id;
    delete from public.user_predictions_knockout_structure     where user_id = caller_id;
    delete from public.user_predictions_awards                 where user_id = caller_id;
    delete from public.user_predictions_xi                     where user_id = caller_id;
    delete from public.user_predictions_eredivisie             where user_id = caller_id;
    delete from public.user_group_positions                    where user_id = caller_id;

    update public.profiles set total_points = 0 where id = caller_id;

    return jsonb_build_object('success', true, 'message', 'Your predictions have been cleared.');
exception
    when others then
        return jsonb_build_object('success', false, 'message', SQLERRM);
end;
$$;
