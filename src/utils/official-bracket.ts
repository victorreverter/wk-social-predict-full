import type { Match, OfficialMatch } from '../types';
import { generateInitialGroupMatches } from './data-init';
import { generateInitialKnockoutMatches, updateKnockoutBracket, determineQualifiedTeams } from './bracket-logic';

export const deriveOfficialKnockoutBracket = (
  officialMatches: Record<string, OfficialMatch>
): Record<string, Match> => {
  const groupMatches = generateInitialGroupMatches();
  let hasOfficialGroupData = false;

  Object.keys(groupMatches).forEach(id => {
    const om = officialMatches[id];
    if (om && om.home_goals !== null && om.away_goals !== null) {
      groupMatches[id].score.homeGoals = om.home_goals;
      groupMatches[id].score.awayGoals = om.away_goals;
      groupMatches[id].status = 'FINISHED';
      hasOfficialGroupData = true;
    }
  });

  if (!hasOfficialGroupData) {
    return generateInitialKnockoutMatches();
  }

  const { best8Thirds } = determineQualifiedTeams(groupMatches);
  const thirdsIds = best8Thirds.map(t => t.teamId);

  let ko = generateInitialKnockoutMatches();
  ko = updateKnockoutBracket(ko, groupMatches, thirdsIds, true);

  Object.keys(ko).forEach(id => {
    const om = officialMatches[id];
    if (om) {
      if (om.home_goals !== null && om.away_goals !== null) {
        ko[id].score.homeGoals = om.home_goals;
        ko[id].score.awayGoals = om.away_goals;
        ko[id].status = 'FINISHED';
      }
      if (om.home_penalties !== null && om.away_penalties !== null) {
        ko[id].score.homePenalties = om.home_penalties;
        ko[id].score.awayPenalties = om.away_penalties;
      }
    }
  });

  ko = updateKnockoutBracket(ko, groupMatches, thirdsIds, true);

  return ko;
};
