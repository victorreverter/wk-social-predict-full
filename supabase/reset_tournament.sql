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

        update public.user_group_positions set pts_earned = 0 where true;
        update public.profiles set total_points = 0 where true;

        return jsonb_build_object('success', true, 'message', 'Tournament fully reset.');
    else
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

    delete from public.user_predictions_matches    where user_id = caller_id;
    delete from public.user_predictions_knockout     where user_id = caller_id;
    delete from public.user_predictions_awards       where user_id = caller_id;
    delete from public.user_predictions_xi           where user_id = caller_id;
    delete from public.user_predictions_eredivisie   where user_id = caller_id;
    delete from public.user_group_positions          where user_id = caller_id;

    update public.profiles set total_points = 0 where id = caller_id;

    return jsonb_build_object('success', true, 'message', 'Your predictions have been cleared.');
exception
    when others then
        return jsonb_build_object('success', false, 'message', SQLERRM);
end;
$$;
