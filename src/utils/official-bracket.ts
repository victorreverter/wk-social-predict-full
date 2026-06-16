import type { Match, OfficialMatch } from '../types';
import { generateInitialGroupMatches } from './data-init';
import {
  R32_FIXTURES, R16_FIXTURES, QF_FIXTURES, SF_FIXTURES,
  THIRD_PLACE_FIXTURE, FINAL_FIXTURE, T3_MATCH_ORDER,
  matchIdFromNum, getMatchWinner, getMatchLoser, setTeams,
  determineQualifiedTeams, generateInitialKnockoutMatches
} from './bracket-logic';
import { THIRD_PLACE_COMBOS } from './fifa-combos';

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

  const matchesByGroup: Record<string, string[]> = {};
  Object.entries(groupMatches).forEach(([matchId, match]) => {
    if (!matchesByGroup[match.group!]) matchesByGroup[match.group!] = [];
    matchesByGroup[match.group!].push(matchId);
  });

  const finishedGroups = new Set<string>();
  Object.entries(matchesByGroup).forEach(([group, matchIds]) => {
    const allFinished = matchIds.every(id => groupMatches[id]?.status === 'FINISHED');
    if (allFinished) finishedGroups.add(group);
  });

  const allGroupsFinished = finishedGroups.size === 12;

  const { groupWinners, groupRunnersUp, best8Thirds } = determineQualifiedTeams(groupMatches);

  let ko = generateInitialKnockoutMatches();

  R32_FIXTURES.forEach(f => {
    const needsT3 = f.homeSlot === 'T3' || f.awaySlot === 'T3';

    if (needsT3 && !allGroupsFinished) {
      return;
    }

    const resolveFixed = (slot: string): string | null => {
      if (slot.startsWith('W_')) {
        const group = slot.slice(2);
        return finishedGroups.has(group) ? (groupWinners[group]?.teamId ?? null) : null;
      }
      if (slot.startsWith('RU_')) {
        const group = slot.slice(3);
        return finishedGroups.has(group) ? (groupRunnersUp[group]?.teamId ?? null) : null;
      }
      return null;
    };

    if (needsT3 && allGroupsFinished) {
      const advancingGroups = best8Thirds.map(t => t.group).sort().join('');
      const combo = THIRD_PLACE_COMBOS[advancingGroups];
      const assignments = combo ?? best8Thirds.map((_, i) => best8Thirds[i].group);
      const thirdByGroup: Record<string, string> = {};
      best8Thirds.forEach(t => { thirdByGroup[t.group] = t.teamId; });

      const t3Idx = T3_MATCH_ORDER.indexOf(f.matchNum);
      const t3Team = t3Idx >= 0 ? (thirdByGroup[assignments[t3Idx]] ?? 'TBD') : 'TBD';

      const home = f.homeSlot === 'T3' ? t3Team : (resolveFixed(f.homeSlot) ?? 'TBD');
      const away = f.awaySlot === 'T3' ? t3Team : (resolveFixed(f.awaySlot) ?? 'TBD');
      ko = setTeams(ko, f.matchNum, home, away);
    } else if (!needsT3) {
      const homeFixed = resolveFixed(f.homeSlot);
      const awayFixed = resolveFixed(f.awaySlot);
      if (homeFixed !== null && awayFixed !== null) {
        ko = setTeams(ko, f.matchNum, homeFixed, awayFixed);
      }
    }
  });

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

  [...R16_FIXTURES, ...QF_FIXTURES, ...SF_FIXTURES].forEach(f => {
    const homeWinner = getMatchWinner(ko[matchIdFromNum(f.homeFrom)]);
    const awayWinner = getMatchWinner(ko[matchIdFromNum(f.awayFrom)]);
    ko = setTeams(ko, f.matchNum, homeWinner, awayWinner);
  });

  const sf1Winner = getMatchWinner(ko[matchIdFromNum(SF_FIXTURES[0].matchNum)]);
  const sf2Winner = getMatchWinner(ko[matchIdFromNum(SF_FIXTURES[1].matchNum)]);
  ko = setTeams(ko, FINAL_FIXTURE.matchNum, sf1Winner, sf2Winner);

  const sf1Loser = getMatchLoser(ko[matchIdFromNum(SF_FIXTURES[0].matchNum)]);
  const sf2Loser = getMatchLoser(ko[matchIdFromNum(SF_FIXTURES[1].matchNum)]);
  ko = setTeams(ko, THIRD_PLACE_FIXTURE.matchNum, sf1Loser, sf2Loser);

  return ko;
};
