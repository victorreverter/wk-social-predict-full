import type { OfficialMatch } from '../types';

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
