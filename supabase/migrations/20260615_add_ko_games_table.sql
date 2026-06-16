-- ============================================================
-- User Predictions for Actual Knockout Games (Games Tab)
-- Stores match-by-match predictions for real knockout fixtures
-- as they become known during the tournament.
-- Separate from user_predictions_knockout_structure (pre-tournament bracket).
-- ============================================================

create table if not exists public.user_predictions_ko_games (
  user_id            uuid not null references public.profiles(id) on delete cascade,
  match_id           text not null,
  pred_home_goals    integer,
  pred_away_goals    integer,
  pred_home_pens     integer,
  pred_away_pens     integer,
  pts_earned         integer not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.user_predictions_ko_games enable row level security;

drop policy if exists "Users own ko games" on public.user_predictions_ko_games;
create policy "Users own ko games" on public.user_predictions_ko_games for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read ko games" on public.user_predictions_ko_games;
create policy "Public read ko games" on public.user_predictions_ko_games for select using (true);

-- ============================================================
-- Update recalculate_user_points_rpc to include the new table
-- ============================================================
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
    from public.user_predictions_ko_games
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

-- ============================================================
-- Update bulk_update_prediction_points to handle the new table
-- ============================================================
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

                when 'user_predictions_ko_games' then
                    update public.user_predictions_ko_games
                    set pts_earned = rec_pts
                    where id = rec_id;

                    select user_id into rec_user_id
                    from public.user_predictions_ko_games
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
