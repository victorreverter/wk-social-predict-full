-- ============================================================
-- Tournament Reset Function
-- SECURITY DEFINER bypasses RLS.
--   Masters  → wipe ALL users' predictions, results & points
--   Regular  → wipe only caller's own predictions & points
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
        -- Master: wipe everything for everyone
        delete from public.user_predictions_matches;
        delete from public.user_predictions_knockout;
        delete from public.user_predictions_awards;
        delete from public.user_predictions_xi;
        delete from public.user_predictions_eredivisie;
        delete from public.official_awards;
        delete from public.official_tournament_xi;
        delete from public.official_eredivisie;

        -- Preserve date and match_id columns; only clear results
        update public.official_matches
        set home_goals = null, away_goals = null,
            home_penalties = null, away_penalties = null,
            went_to_pens = false, status = 'NOT_PLAYED',
            locked_at = null, updated_at = now();

        update public.profiles set total_points = 0 where true;

        return jsonb_build_object('success', true, 'message', 'Tournament fully reset.');
    else
        -- Regular user: wipe only own predictions & points
        delete from public.user_predictions_matches where user_id = caller_id;
        delete from public.user_predictions_knockout where user_id = caller_id;
        delete from public.user_predictions_awards  where user_id = caller_id;
        delete from public.user_predictions_xi      where user_id = caller_id;
        delete from public.user_predictions_eredivisie where user_id = caller_id;
        update public.profiles set total_points = 0 where id = caller_id;

        return jsonb_build_object('success', true, 'message', 'Your predictions have been cleared.');
    end if;
exception
    when others then
        return jsonb_build_object('success', false, 'message', SQLERRM);
end;
$$;
