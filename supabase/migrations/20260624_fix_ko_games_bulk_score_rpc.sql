-- Fix bulk scoring for knockout game predictions.
-- user_predictions_ko_games is keyed by (user_id, match_id), not by a UUID id.

create or replace function public.bulk_update_prediction_points(
    p_table_name text,
    p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id         uuid;
    caller_master     boolean;
    update_record     jsonb;
    rec_id            uuid;
    rec_user_id       uuid;
    rec_match_id      text;
    rec_group_letter  text;
    rec_pts           integer;
    affected_uids     uuid[] := '{}';
    update_count      integer := 0;
    i                 integer;
begin
    caller_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
    if caller_id is null then
        return jsonb_build_object('success', false, 'message', 'Not authenticated.');
    end if;

    select is_master into caller_master
    from public.profiles
    where id = caller_id;

    if caller_master is not true then
        return jsonb_build_object('success', false, 'message', 'Only masters can bulk-update scores.');
    end if;

    for update_record in select * from jsonb_array_elements(p_updates)
    loop
        rec_id := null;
        rec_user_id := null;
        rec_match_id := null;
        rec_group_letter := null;
        rec_pts := (update_record->>'pts_earned')::integer;

        if p_table_name = 'user_group_positions' then
            rec_user_id := (update_record->>'user_id')::uuid;
            rec_group_letter := update_record->>'group_letter';

            if rec_user_id is null or rec_group_letter is null then
                continue;
            end if;

            update public.user_group_positions
            set pts_earned = rec_pts
            where user_id = rec_user_id
              and group_letter = rec_group_letter;

        elsif p_table_name = 'user_predictions_ko_games' then
            rec_user_id := (update_record->>'user_id')::uuid;
            rec_match_id := update_record->>'match_id';

            if rec_user_id is null or rec_match_id is null then
                continue;
            end if;

            update public.user_predictions_ko_games
            set pts_earned = rec_pts
            where user_id = rec_user_id
              and match_id = rec_match_id;

        else
            rec_id := (update_record->>'id')::uuid;

            if rec_id is null then
                continue;
            end if;

            case p_table_name
                when 'user_predictions_matches' then
                    update public.user_predictions_matches
                    set pts_earned = rec_pts
                    where id = rec_id;

                    select user_id into rec_user_id
                    from public.user_predictions_matches
                    where id = rec_id;

                when 'user_predictions_knockout' then
                    update public.user_predictions_knockout
                    set pts_earned = rec_pts
                    where id = rec_id;

                    select user_id into rec_user_id
                    from public.user_predictions_knockout
                    where id = rec_id;

                when 'user_predictions_awards' then
                    update public.user_predictions_awards
                    set pts_earned = rec_pts
                    where id = rec_id;

                    select user_id into rec_user_id
                    from public.user_predictions_awards
                    where id = rec_id;

                when 'user_predictions_xi' then
                    update public.user_predictions_xi
                    set pts_earned = rec_pts
                    where id = rec_id;

                    select user_id into rec_user_id
                    from public.user_predictions_xi
                    where id = rec_id;

                else
                    return jsonb_build_object('success', false, 'message', 'Unknown table: ' || p_table_name);
            end case;
        end if;

        if rec_user_id is not null and not (rec_user_id = any(affected_uids)) then
            affected_uids := array_append(affected_uids, rec_user_id);
        end if;

        update_count := update_count + 1;
    end loop;

    if array_length(affected_uids, 1) is not null then
        for i in 1 .. array_length(affected_uids, 1)
        loop
            perform public.recalculate_user_points_rpc(affected_uids[i]);
        end loop;
    end if;

    return jsonb_build_object(
        'success', true,
        'updated', update_count,
        'users_scored', coalesce(array_length(affected_uids, 1), 0)
    );
end;
$$;
