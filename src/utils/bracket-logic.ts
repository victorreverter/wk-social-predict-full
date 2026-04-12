import type { Match, GroupStanding } from '../types';
import { groups, initialTeams } from './data-init';
import { calculateGroupStandings } from './standings';

// ─────────────────────────────────────────────────────────────────────────────
// 2026 FIFA World Cup – Official Knockout Bracket
// Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
// Match numbers mirror the official tournament numbering (73–104).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Official R32 fixture metadata.
 * homeSlot / awaySlot describe which qualified team fills each slot.
 *   W_X  = Winner of group X
 *   RU_X = Runner-up of group X
 *   T3   = one of the 8 best 3rd-placed teams (assigned dynamically)
 */
interface R32Fixture {
  matchNum: number;  // Official FIFA match number (73–88)
  date: string;      // ISO UTC date
  venue: string;
  localTime: string; // e.g. "12:00 PDT"
  homeSlot: string;
  awaySlot: string;
}

export const R32_FIXTURES: R32Fixture[] = [
  { matchNum: 73, date: '2026-06-28T19:00:00Z', venue: 'SoFi Stadium, Inglewood',            localTime: '12:00 PDT', homeSlot: 'RU_A', awaySlot: 'RU_B' },
  { matchNum: 74, date: '2026-06-29T20:30:00Z', venue: 'Gillette Stadium, Foxborough',        localTime: '16:30 EDT', homeSlot: 'W_E',  awaySlot: 'T3'   },
  { matchNum: 75, date: '2026-06-30T01:00:00Z', venue: 'Estadio BBVA, Guadalupe',             localTime: '19:00 CST', homeSlot: 'W_F',  awaySlot: 'RU_C' },
  { matchNum: 76, date: '2026-06-29T17:00:00Z', venue: 'NRG Stadium, Houston',                localTime: '12:00 CDT', homeSlot: 'W_C',  awaySlot: 'RU_F' },
  { matchNum: 77, date: '2026-06-30T21:00:00Z', venue: 'MetLife Stadium, East Rutherford',    localTime: '17:00 EDT', homeSlot: 'W_I',  awaySlot: 'T3'   },
  { matchNum: 78, date: '2026-06-30T17:00:00Z', venue: 'AT&T Stadium, Arlington',             localTime: '12:00 CDT', homeSlot: 'RU_E', awaySlot: 'RU_I' },
  { matchNum: 79, date: '2026-07-01T01:00:00Z', venue: 'Estadio Azteca, Mexico City',         localTime: '19:00 CST', homeSlot: 'W_A',  awaySlot: 'T3'   },
  { matchNum: 80, date: '2026-07-01T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta',      localTime: '12:00 EDT', homeSlot: 'W_L',  awaySlot: 'T3'   },
  { matchNum: 81, date: '2026-07-02T00:00:00Z', venue: "Levi's Stadium, Santa Clara",         localTime: '17:00 PDT', homeSlot: 'W_D',  awaySlot: 'T3'   },
  { matchNum: 82, date: '2026-07-01T20:00:00Z', venue: 'Lumen Field, Seattle',                localTime: '13:00 PDT', homeSlot: 'W_G',  awaySlot: 'T3'   },
  { matchNum: 83, date: '2026-07-02T23:00:00Z', venue: 'BMO Field, Toronto',                  localTime: '19:00 EDT', homeSlot: 'RU_K', awaySlot: 'RU_L' },
  { matchNum: 84, date: '2026-07-02T19:00:00Z', venue: 'SoFi Stadium, Inglewood',             localTime: '12:00 PDT', homeSlot: 'W_H',  awaySlot: 'RU_J' },
  { matchNum: 85, date: '2026-07-03T03:00:00Z', venue: 'BC Place, Vancouver',                 localTime: '20:00 PDT', homeSlot: 'W_B',  awaySlot: 'T3'   },
  { matchNum: 86, date: '2026-07-03T22:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens',    localTime: '18:00 EDT', homeSlot: 'W_J',  awaySlot: 'RU_H' },
  { matchNum: 87, date: '2026-07-04T01:30:00Z', venue: 'Arrowhead Stadium, Kansas City',      localTime: '20:30 CDT', homeSlot: 'W_K',  awaySlot: 'T3'   },
  { matchNum: 88, date: '2026-07-03T18:00:00Z', venue: 'AT&T Stadium, Arlington',             localTime: '13:00 CDT', homeSlot: 'RU_D', awaySlot: 'RU_G' },
];

/**
 * Official R16 fixtures: winner of match X vs winner of match Y.
 * R16 matchNums are 89–96.
 */
interface RoundFixture {
  matchNum: number;
  date: string;
  venue: string;
  localTime: string;
  homeFrom: number; // FIFA match number of the preceding match that provides the home team
  awayFrom: number; // FIFA match number of the preceding match that provides the away team
}

export const R16_FIXTURES: RoundFixture[] = [
  { matchNum: 89, date: '2026-07-04T21:00:00Z', venue: 'Lincoln Financial Field, Philadelphia', localTime: '17:00 EDT', homeFrom: 74, awayFrom: 77 },
  { matchNum: 90, date: '2026-07-04T17:00:00Z', venue: 'NRG Stadium, Houston',                  localTime: '12:00 CDT', homeFrom: 73, awayFrom: 75 },
  { matchNum: 91, date: '2026-07-05T20:00:00Z', venue: 'MetLife Stadium, East Rutherford',       localTime: '16:00 EDT', homeFrom: 76, awayFrom: 78 },
  { matchNum: 92, date: '2026-07-06T00:00:00Z', venue: 'Estadio Azteca, Mexico City',            localTime: '18:00 CST', homeFrom: 79, awayFrom: 80 },
  { matchNum: 93, date: '2026-07-06T19:00:00Z', venue: 'AT&T Stadium, Arlington',               localTime: '14:00 CDT', homeFrom: 83, awayFrom: 84 },
  { matchNum: 94, date: '2026-07-07T00:00:00Z', venue: 'Lumen Field, Seattle',                  localTime: '17:00 PDT', homeFrom: 81, awayFrom: 82 },
  { matchNum: 95, date: '2026-07-07T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta',        localTime: '12:00 EDT', homeFrom: 86, awayFrom: 88 },
  { matchNum: 96, date: '2026-07-07T20:00:00Z', venue: 'BC Place, Vancouver',                   localTime: '13:00 PDT', homeFrom: 85, awayFrom: 87 },
];

export const QF_FIXTURES: RoundFixture[] = [
  { matchNum: 97,  date: '2026-07-09T20:00:00Z', venue: 'Gillette Stadium, Foxborough',       localTime: '16:00 EDT', homeFrom: 89, awayFrom: 90 },
  { matchNum: 98,  date: '2026-07-10T19:00:00Z', venue: 'SoFi Stadium, Inglewood',            localTime: '12:00 PDT', homeFrom: 93, awayFrom: 94 },
  { matchNum: 99,  date: '2026-07-11T21:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens',   localTime: '17:00 EDT', homeFrom: 91, awayFrom: 92 },
  { matchNum: 100, date: '2026-07-12T01:00:00Z', venue: 'Arrowhead Stadium, Kansas City',     localTime: '20:00 CDT', homeFrom: 95, awayFrom: 96 },
];

export const SF_FIXTURES: RoundFixture[] = [
  { matchNum: 101, date: '2026-07-14T19:00:00Z', venue: 'AT&T Stadium, Arlington',            localTime: '14:00 CDT', homeFrom: 97,  awayFrom: 98  },
  { matchNum: 102, date: '2026-07-15T19:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta',     localTime: '15:00 EDT', homeFrom: 99,  awayFrom: 100 },
];

export const THIRD_PLACE_FIXTURE: RoundFixture = {
  matchNum: 103, date: '2026-07-18T21:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens',    localTime: '17:00 EDT', homeFrom: 101, awayFrom: 102,
};

export const FINAL_FIXTURE: RoundFixture = {
  matchNum: 104, date: '2026-07-19T20:00:00Z', venue: 'MetLife Stadium, East Rutherford',    localTime: '16:00 EDT', homeFrom: 101, awayFrom: 102,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert matchNum → stable match ID used throughout the app
// ─────────────────────────────────────────────────────────────────────────────
export const matchIdFromNum = (n: number): string => `m${n}`;

// ─────────────────────────────────────────────────────────────────────────────
// Determine which qualified teams advance from the group stage
// ─────────────────────────────────────────────────────────────────────────────
export const determineQualifiedTeams = (
  allMatches: Record<string, Match>
) => {
  const groupWinners: Record<string, GroupStanding>  = {};
  const groupRunnersUp: Record<string, GroupStanding> = {};
  const allThirds: GroupStanding[] = [];

  groups.forEach((group) => {
    const standings = calculateGroupStandings(group, initialTeams, allMatches);
    if (standings.length >= 3) {
      groupWinners[group]  = standings[0];
      groupRunnersUp[group] = standings[1];
      allThirds.push(standings[2]);
    }
  });

  // Sort thirds to find the best 8
  const sortedThirds = [...allThirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return {
    groupWinners,
    groupRunnersUp,
    best8Thirds: sortedThirds.slice(0, 8),
    allThirds: sortedThirds,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate an empty knockout bracket (all TBD) using official match numbers
// ─────────────────────────────────────────────────────────────────────────────
export const generateInitialKnockoutMatches = (): Record<string, Match> => {
  const matches: Record<string, Match> = {};

  const makeEmpty = (matchNum: number, stage: string, date: string, venue: string, localTime: string): Match => ({
    id: matchIdFromNum(matchNum),
    homeTeamId: 'TBD',
    awayTeamId: 'TBD',
    date,
    stage,
    venue,
    localTime,
    status: 'NOT_PLAYED',
    score: { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null },
  });

  R32_FIXTURES.forEach(f => { matches[matchIdFromNum(f.matchNum)] = makeEmpty(f.matchNum, 'R32', f.date, f.venue, f.localTime); });
  R16_FIXTURES.forEach(f => { matches[matchIdFromNum(f.matchNum)] = makeEmpty(f.matchNum, 'R16', f.date, f.venue, f.localTime); });
  QF_FIXTURES.forEach(f  => { matches[matchIdFromNum(f.matchNum)] = makeEmpty(f.matchNum, 'QF',  f.date, f.venue, f.localTime); });
  SF_FIXTURES.forEach(f  => { matches[matchIdFromNum(f.matchNum)] = makeEmpty(f.matchNum, 'SF',  f.date, f.venue, f.localTime); });
  matches[matchIdFromNum(THIRD_PLACE_FIXTURE.matchNum)] = makeEmpty(THIRD_PLACE_FIXTURE.matchNum, '3RD', THIRD_PLACE_FIXTURE.date, THIRD_PLACE_FIXTURE.venue, THIRD_PLACE_FIXTURE.localTime);
  matches[matchIdFromNum(FINAL_FIXTURE.matchNum)]       = makeEmpty(FINAL_FIXTURE.matchNum,       'F',   FINAL_FIXTURE.date,       FINAL_FIXTURE.venue, FINAL_FIXTURE.localTime);

  return matches;
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolve a match winner (used for propagation)
// ─────────────────────────────────────────────────────────────────────────────
const getMatchWinner = (match?: Match): string => {
  if (!match) return 'TBD';
  if (match.status !== 'FINISHED') return 'TBD';
  if (match.result === 'HOME_WIN') return match.homeTeamId;
  if (match.result === 'AWAY_WIN') return match.awayTeamId;
  if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
    if (match.score.homeGoals > match.score.awayGoals) return match.homeTeamId;
    if (match.score.homeGoals < match.score.awayGoals) return match.awayTeamId;
    if (match.score.homePenalties != null && match.score.awayPenalties != null) {
      if (match.score.homePenalties > match.score.awayPenalties) return match.homeTeamId;
      if (match.score.homePenalties < match.score.awayPenalties) return match.awayTeamId;
    }
  }
  return 'TBD';
};

const getMatchLoser = (match?: Match): string => {
  if (!match) return 'TBD';
  if (match.status !== 'FINISHED') return 'TBD';
  if (match.result === 'HOME_WIN') return match.awayTeamId;
  if (match.result === 'AWAY_WIN') return match.homeTeamId;
  if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
    if (match.score.homeGoals > match.score.awayGoals) return match.awayTeamId;
    if (match.score.homeGoals < match.score.awayGoals) return match.homeTeamId;
    if (match.score.homePenalties != null && match.score.awayPenalties != null) {
      if (match.score.homePenalties > match.score.awayPenalties) return match.awayTeamId;
      if (match.score.homePenalties < match.score.awayPenalties) return match.homeTeamId;
    }
  }
  return 'TBD';
};

// ─────────────────────────────────────────────────────────────────────────────
// setTeams helper: only mutates if something actually changed (avoids re-renders)
// ─────────────────────────────────────────────────────────────────────────────
const setTeams = (
  ko: Record<string, Match>,
  matchNum: number,
  home: string,
  away: string
): Record<string, Match> => {
  const id = matchIdFromNum(matchNum);
  const m = ko[id];
  if (!m || (m.homeTeamId === home && m.awayTeamId === away)) return ko;
  return { ...ko, [id]: { ...m, homeTeamId: home, awayTeamId: away } };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main bracket update function
// ─────────────────────────────────────────────────────────────────────────────
export const updateKnockoutBracket = (
  currentKnockout: Record<string, Match>,
  groupMatches: Record<string, Match>,
  selectedThirds: string[] = [],
  allowIncomplete: boolean = false
): Record<string, Match> => {
  let ko = Object.keys(currentKnockout).length === 0
    ? generateInitialKnockoutMatches()
    : { ...currentKnockout };

  // ── 1. Seed R32 from group results ────────────────────────────────────────
  const totalGroupMatches     = Object.keys(groupMatches).length;
  const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;
  const allGroupsDone         = totalGroupMatches === 72 && completedGroupMatches === 72;

  if (allGroupsDone || allowIncomplete) {
    const { groupWinners, groupRunnersUp, best8Thirds, allThirds } = determineQualifiedTeams(groupMatches);
    const thirdsReady = Object.keys(groupWinners).length === 12 || allowIncomplete;

    if (thirdsReady) {
      // Resolve the 8 selected third-placed teams in order (T3_0..T3_7)
      const chosenThirds = allThirds.filter(t => selectedThirds.includes(t.teamId));

      // Build a lookup: slot string → teamId
      const resolve = (slot: string, t3Index: number): string => {
        if (slot.startsWith('W_'))  return groupWinners[slot.slice(2)]?.teamId  ?? 'TBD';
        if (slot.startsWith('RU_')) return groupRunnersUp[slot.slice(3)]?.teamId ?? 'TBD';
        // T3: assigned in the order they appear in the fixture list
        return chosenThirds[t3Index]?.teamId ?? best8Thirds[t3Index]?.teamId ?? 'TBD';
      };

      // Track T3 index as we walk through fixtures
      let t3Idx = 0;
      R32_FIXTURES.forEach(f => {
        const homeIsT3 = f.homeSlot === 'T3';
        const awayIsT3 = f.awaySlot === 'T3';
        const home = homeIsT3 ? (chosenThirds[t3Idx]?.teamId   ?? best8Thirds[t3Idx]?.teamId   ?? 'TBD') : resolve(f.homeSlot, -1);
        const away = awayIsT3 ? (chosenThirds[t3Idx]?.teamId   ?? best8Thirds[t3Idx]?.teamId   ?? 'TBD') : resolve(f.awaySlot, -1);
        if (homeIsT3 || awayIsT3) t3Idx++;
        ko = setTeams(ko, f.matchNum, home, away);
      });
    } else {
      // Reset R32 to TBD
      R32_FIXTURES.forEach(f => { ko = setTeams(ko, f.matchNum, 'TBD', 'TBD'); });
    }
  } else {
    // Groups not finished – reset R32
    R32_FIXTURES.forEach(f => { ko = setTeams(ko, f.matchNum, 'TBD', 'TBD'); });
  }

  // ── 2. Propagate winners through R16 → QF → SF ───────────────────────────
  [...R16_FIXTURES, ...QF_FIXTURES, ...SF_FIXTURES].forEach(f => {
    const homeWinner = getMatchWinner(ko[matchIdFromNum(f.homeFrom)]);
    const awayWinner = getMatchWinner(ko[matchIdFromNum(f.awayFrom)]);
    ko = setTeams(ko, f.matchNum, homeWinner, awayWinner);
  });

  // ── 3. Final ──────────────────────────────────────────────────────────────
  const sf1Winner = getMatchWinner(ko[matchIdFromNum(SF_FIXTURES[0].matchNum)]);
  const sf2Winner = getMatchWinner(ko[matchIdFromNum(SF_FIXTURES[1].matchNum)]);
  ko = setTeams(ko, FINAL_FIXTURE.matchNum, sf1Winner, sf2Winner);

  // ── 4. Third-place play-off (losers of SF) ────────────────────────────────
  const sf1Loser = getMatchLoser(ko[matchIdFromNum(SF_FIXTURES[0].matchNum)]);
  const sf2Loser = getMatchLoser(ko[matchIdFromNum(SF_FIXTURES[1].matchNum)]);
  ko = setTeams(ko, THIRD_PLACE_FIXTURE.matchNum, sf1Loser, sf2Loser);

  return ko;
};
