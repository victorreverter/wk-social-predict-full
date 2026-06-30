-- Normalize already-saved knockout penalty matches whose fetched score
-- incorrectly includes the penalty-shootout tally in home_goals/away_goals.
--
-- Example:
--   stored: 4-5 with penalties 3-4
--   fixed : 1-1 with penalties 3-4

update public.official_matches
set
  home_goals = home_goals - home_penalties,
  away_goals = away_goals - away_penalties,
  updated_at = now()
where
  status = 'FINISHED'
  and went_to_pens = true
  and home_penalties is not null
  and away_penalties is not null
  and substring(match_id from 2)::int >= 73
  and home_goals is not null
  and away_goals is not null
  and home_goals <> away_goals
  and home_goals >= home_penalties
  and away_goals >= away_penalties
  and (home_goals - home_penalties) = (away_goals - away_penalties);
