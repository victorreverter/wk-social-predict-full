-- Backfill missing user_predictions_knockout rows from the saved
-- user_predictions_knockout_structure table.
--
-- This is non-destructive:
-- - it does not delete or overwrite existing knockout rows
-- - it only inserts missing rows using ON CONFLICT DO NOTHING
--
-- Why this exists:
-- Some users have visible bracket structure saved in
-- user_predictions_knockout_structure, but are missing the derived
-- user_predictions_knockout rows that the leaderboard scoring uses.

with structure_rows as (
    select
        user_id,
        match_id,
        substring(match_id from 2)::integer as match_num,
        pred_home_team_id,
        pred_away_team_id,
        pred_home_goals,
        pred_away_goals,
        pred_home_pens,
        pred_away_pens,
        pred_result
    from public.user_predictions_knockout_structure
),
round_rows as (
    select distinct
        user_id,
        case
            when match_num between 73 and 88 then 'R32'
            when match_num between 89 and 96 then 'R16'
            when match_num between 97 and 100 then 'QF'
            when match_num between 101 and 102 then 'SF'
            when match_num = 104 then 'F'
            else null
        end as round,
        pred_home_team_id as team_id
    from structure_rows
    where pred_home_team_id is not null
      and pred_home_team_id <> 'TBD'

    union

    select distinct
        user_id,
        case
            when match_num between 73 and 88 then 'R32'
            when match_num between 89 and 96 then 'R16'
            when match_num between 97 and 100 then 'QF'
            when match_num between 101 and 102 then 'SF'
            when match_num = 104 then 'F'
            else null
        end as round,
        pred_away_team_id as team_id
    from structure_rows
    where pred_away_team_id is not null
      and pred_away_team_id <> 'TBD'
),
champion_rows as (
    select
        user_id,
        'CHAMPION' as round,
        case
            when match_id <> 'm104' then null
            when pred_result = 'HOME_WIN' then pred_home_team_id
            when pred_result = 'AWAY_WIN' then pred_away_team_id
            when pred_home_goals is not null and pred_away_goals is not null and pred_home_goals > pred_away_goals then pred_home_team_id
            when pred_home_goals is not null and pred_away_goals is not null and pred_away_goals > pred_home_goals then pred_away_team_id
            when pred_home_goals is not null and pred_away_goals is not null and pred_home_goals = pred_away_goals
                 and pred_home_pens is not null and pred_away_pens is not null
                 and pred_home_pens > pred_away_pens then pred_home_team_id
            when match_id = 'm104' and pred_home_goals is not null and pred_away_goals is not null and pred_home_goals = pred_away_goals
                 and pred_home_pens is not null and pred_away_pens is not null
                 and pred_away_pens > pred_home_pens then pred_away_team_id
            else null
        end as team_id
    from structure_rows
    where match_id = 'm104'
),
rows_to_insert as (
    select user_id, round, team_id
    from round_rows
    where round is not null
      and team_id is not null

    union

    select user_id, round, team_id
    from champion_rows
    where team_id is not null
      and team_id <> 'TBD'
)
insert into public.user_predictions_knockout (user_id, round, team_id, pts_earned)
select user_id, round, team_id, 0
from rows_to_insert
on conflict (user_id, round, team_id) do nothing;
