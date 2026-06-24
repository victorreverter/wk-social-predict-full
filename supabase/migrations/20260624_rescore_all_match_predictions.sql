-- Recalculate all points for actual match predictions directly in the database.
-- This updates only pts_earned and profiles.total_points.
-- It does not delete or overwrite prediction content.

create or replace function public.rescore_all_match_predictions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id uuid;
    caller_master boolean;
    pts_exact integer := 2;
    pts_outcome integer := 1;
    pts_went_pens integer := 2;
    pts_pens_winner integer := 3;
    affected_uids uuid[];
    match_rows_updated integer := 0;
    ko_game_rows_updated integer := 0;
    i integer;
begin
    caller_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
    if caller_id is null then
        return jsonb_build_object('success', false, 'message', 'Not authenticated.');
    end if;

    select is_master into caller_master
    from public.profiles
    where id = caller_id;

    if caller_master is not true then
        return jsonb_build_object('success', false, 'message', 'Only masters can rescore match predictions.');
    end if;

    select coalesce(max(case when rule_key = 'match_exact_score' then pts end), pts_exact),
           coalesce(max(case when rule_key = 'match_correct_outcome' then pts end), pts_outcome),
           coalesce(max(case when rule_key = 'match_went_to_pens' then pts end), pts_went_pens),
           coalesce(max(case when rule_key = 'match_pens_winner' then pts end), pts_pens_winner)
    into pts_exact, pts_outcome, pts_went_pens, pts_pens_winner
    from public.scoring_rules;

    update public.user_predictions_matches
    set pts_earned = 0
    where pts_earned <> 0;

    update public.user_predictions_ko_games
    set pts_earned = 0
    where pts_earned <> 0;

    with scored_group_matches as (
        select
            up.id,
            (
                case
                    when up.pred_home_goals is null or up.pred_away_goals is null then 0
                    when om.home_goals = up.pred_home_goals and om.away_goals = up.pred_away_goals then pts_exact
                    when (
                        (om.home_goals > om.away_goals and up.pred_home_goals > up.pred_away_goals)
                        or (om.home_goals < om.away_goals and up.pred_home_goals < up.pred_away_goals)
                        or (om.home_goals = om.away_goals and up.pred_home_goals = up.pred_away_goals)
                    ) then pts_outcome
                    else 0
                end
                +
                case
                    when om.went_to_pens is not true or up.pred_home_goals is null or up.pred_away_goals is null then 0
                    when om.home_penalties is not null
                         and om.away_penalties is not null
                         and up.pred_home_pens is not null
                         and up.pred_away_pens is not null
                         and (
                            (om.home_penalties > om.away_penalties and up.pred_home_pens > up.pred_away_pens)
                            or (om.home_penalties < om.away_penalties and up.pred_home_pens < up.pred_away_pens)
                         )
                    then pts_pens_winner
                         + case when up.pred_home_goals = up.pred_away_goals then pts_went_pens else 0 end
                         + case when om.home_goals <> up.pred_home_goals or om.away_goals <> up.pred_away_goals then pts_exact else 0 end
                    when up.pred_home_goals = up.pred_away_goals then pts_went_pens
                    else 0
                end
            ) as new_pts
        from public.user_predictions_matches up
        join public.official_matches om
          on om.match_id = up.match_id
        where om.status = 'FINISHED'
          and substring(om.match_id from 2)::integer <= 72
    )
    update public.user_predictions_matches up
    set pts_earned = sgm.new_pts
    from scored_group_matches sgm
    where up.id = sgm.id;

    get diagnostics match_rows_updated = row_count;

    with scored_ko_games as (
        select
            up.user_id,
            up.match_id,
            (
                case
                    when up.pred_home_goals is null or up.pred_away_goals is null then 0
                    when om.home_goals = up.pred_home_goals and om.away_goals = up.pred_away_goals then pts_exact
                    when (
                        (om.home_goals > om.away_goals and up.pred_home_goals > up.pred_away_goals)
                        or (om.home_goals < om.away_goals and up.pred_home_goals < up.pred_away_goals)
                        or (om.home_goals = om.away_goals and up.pred_home_goals = up.pred_away_goals)
                    ) then pts_outcome
                    else 0
                end
                +
                case
                    when om.went_to_pens is not true or up.pred_home_goals is null or up.pred_away_goals is null then 0
                    when om.home_penalties is not null
                         and om.away_penalties is not null
                         and up.pred_home_pens is not null
                         and up.pred_away_pens is not null
                         and (
                            (om.home_penalties > om.away_penalties and up.pred_home_pens > up.pred_away_pens)
                            or (om.home_penalties < om.away_penalties and up.pred_home_pens < up.pred_away_pens)
                         )
                    then pts_pens_winner
                         + case when up.pred_home_goals = up.pred_away_goals then pts_went_pens else 0 end
                         + case when om.home_goals <> up.pred_home_goals or om.away_goals <> up.pred_away_goals then pts_exact else 0 end
                    when up.pred_home_goals = up.pred_away_goals then pts_went_pens
                    else 0
                end
            ) as new_pts
        from public.user_predictions_ko_games up
        join public.official_matches om
          on om.match_id = up.match_id
        where om.status = 'FINISHED'
          and substring(om.match_id from 2)::integer >= 73
    )
    update public.user_predictions_ko_games up
    set pts_earned = skg.new_pts
    from scored_ko_games skg
    where up.user_id = skg.user_id
      and up.match_id = skg.match_id;

    get diagnostics ko_game_rows_updated = row_count;

    select array_agg(distinct user_id)
    into affected_uids
    from (
        select user_id from public.user_predictions_matches
        union
        select user_id from public.user_predictions_ko_games
    ) u;

    if affected_uids is not null and array_length(affected_uids, 1) is not null then
        for i in 1 .. array_length(affected_uids, 1)
        loop
            perform public.recalculate_user_points_rpc(affected_uids[i]);
        end loop;
    end if;

    return jsonb_build_object(
        'success', true,
        'match_rows_updated', match_rows_updated,
        'ko_game_rows_updated', ko_game_rows_updated,
        'users_scored', coalesce(array_length(affected_uids, 1), 0)
    );
end;
$$;
