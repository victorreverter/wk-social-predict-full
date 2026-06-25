import type { Match, OfficialMatch } from '../types';

export const hasPublishedOfficialKnockoutMatch = (official?: OfficialMatch): boolean => {
  if (!official) return false;

  return Boolean(
    official.date ||
    official.locked_at ||
    official.status === 'FINISHED' ||
    official.home_goals !== null ||
    official.away_goals !== null
  );
};

export const hasDefinedKnockoutTeams = (match?: Match): boolean => {
  if (!match) return false;

  return match.homeTeamId !== 'TBD' && match.awayTeamId !== 'TBD';
};
