-- ============================================================
-- Leaderboard Scoring RPCs
-- SECURITY DEFINER functions that bypass RLS to update
-- pts_earned for ALL users and recalculate profiles.total_points.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ── Helper: Recalculate a single user's total points ─────────
create or replace function public.recalculate_user_points_rpc(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    total integer := 0;
begin
    select coalesce(sum(pts_earned), 0) into total
    from public.user_predictions_matches
    where user_id = target_user_id;

    select total + coalesce(sum(pts_earned), 0) into total
    from public.user_predictions_knockout
    where user_id = target_user_id;

    select total + coalesce(sum(pts_earned), 0) into total
    from public.user_predictions_awards
    where user_id = target_user_id;

    select total + coalesce(sum(pts_earned), 0) into total
    from public.user_predictions_xi
    where user_id = target_user_id;

    select total + coalesce(sum(pts_earned), 0) into total
    from public.user_group_positions
    where user_id = target_user_id;

    update public.profiles
    set total_points = total
    where id = target_user_id;
end;
$$;

-- ── Bulk update prediction points (master only) ────────────
-- Updates pts_earned in any user prediction table by id OR by user_id+group_letter.
-- p_updates is a JSON array of objects:
--   For tables with an 'id' PK:     {"id": "uuid", "pts_earned": int}
--   For user_group_positions:         {"user_id": "uuid", "group_letter": "text", "pts_earned": int}
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
    rec_group_letter  text;
    rec_pts           integer;
    affected_uids     uuid[] := '{}';
    update_count      integer := 0;
    i                 integer;
begin
    -- Verify caller is master
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

    -- Process each update
    for update_record in select * from jsonb_array_elements(p_updates)
    loop
        rec_pts := (update_record->>'pts_earned')::integer;

        if p_table_name = 'user_group_positions' then
            -- user_group_positions PK is (user_id, group_letter) - no 'id' column
            rec_user_id := (update_record->>'user_id')::uuid;
            rec_group_letter := update_record->>'group_letter';

            if rec_user_id is null or rec_group_letter is null then
                continue;
            end if;

            update public.user_group_positions
            set pts_earned = rec_pts
            where user_id = rec_user_id
              and group_letter = rec_group_letter;
        else
            -- All other tables have a uuid 'id' PK
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

    -- Recalculate totals for all affected users
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
