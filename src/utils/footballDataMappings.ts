import { initialTeams, GROUP_MATCH_SCHEDULE_DATA } from './data-init';
import { matchIdFromNum } from './bracket-logic';
import type { FootballDataMatch, MappedMatchResult } from '../types/footballData';

const FIFA_TO_INTERNAL: Record<string, string> = {
  MEX: 'A1', RSA: 'A2', KOR: 'A3', CZE: 'A4',
  CAN: 'B1', BIH: 'B2', QAT: 'B3', SUI: 'B4',
  BRA: 'C1', MAR: 'C2', HAI: 'C3', SCO: 'C4',
  USA: 'D1', PAR: 'D2', AUS: 'D3', TUR: 'D4',
  GER: 'E1', CUW: 'E2', CIV: 'E3', ECU: 'E4',
  NED: 'F1', JPN: 'F2', SWE: 'F3', TUN: 'F4',
  BEL: 'G1', EGY: 'G2', IRN: 'G3', NZL: 'G4',
  ESP: 'H1', CPV: 'H2', KSA: 'H3', URU: 'H4',
  FRA: 'I1', SEN: 'I2', IRQ: 'I3', NOR: 'I4',
  ARG: 'J1', ALG: 'J2', AUT: 'J3', JOR: 'J4',
  POR: 'K1', COD: 'K2', UZB: 'K3', COL: 'K4',
  ENG: 'L1', CRO: 'L2', GHA: 'L3', PAN: 'L4',
};

export function resolveInternalTeamId(apiTeam: { id: number; name: string; tla: string; shortName: string }): string | null {
  if (apiTeam.tla && FIFA_TO_INTERNAL[apiTeam.tla.toUpperCase()]) {
    return FIFA_TO_INTERNAL[apiTeam.tla.toUpperCase()];
  }

  const team = initialTeams.find(t => {
    const internalName = t.name.toLowerCase();
    const apiName = apiTeam.name.toLowerCase();
    const apiShort = (apiTeam.shortName || '').toLowerCase();
    return internalName === apiName
      || internalName === apiShort
      || apiName.includes(internalName)
      || internalName.includes(apiName.split(' ')[0]);
  });

  return team?.id ?? null;
}

export function mapApiMatchToInternal(
  apiMatch: FootballDataMatch,
  allGroupMatches: Record<string, { homeTeamId: string; awayTeamId: string; date: string; stage: string; group?: string }>
): MappedMatchResult | null {
  const homeId = resolveInternalTeamId(apiMatch.homeTeam);
  const awayId = resolveInternalTeamId(apiMatch.awayTeam);

  if (!homeId || !awayId) return null;

  const apiDate = apiMatch.utcDate.substring(0, 10);

  const matched = Object.entries(allGroupMatches).find(([, m]) => {
    const mDate = m.date.substring(0, 10);
    return mDate === apiDate
      && m.homeTeamId === homeId
      && m.awayTeamId === awayId;
  });

  if (!matched) return null;

  const score = apiMatch.score;
  const isFinished = apiMatch.status === 'FINISHED';
  const ft = score.fullTime;

  return {
    internalMatchId: matched[0],
    homeGoals: isFinished ? ft.home : null,
    awayGoals: isFinished ? ft.away : null,
    homePenalties: (isFinished && score.penalties) ? score.penalties.home : null,
    awayPenalties: (isFinished && score.penalties) ? score.penalties.away : null,
    status: isFinished ? 'FINISHED' : 'NOT_PLAYED',
  };
}

export function buildGroupMatchLookup(): Record<string, { homeTeamId: string; awayTeamId: string; date: string; stage: string; group?: string }> {
  const lookup: Record<string, { homeTeamId: string; awayTeamId: string; date: string; stage: string; group?: string }> = {};

  for (let i = 1; i <= 72; i++) {
    const schedule = GROUP_MATCH_SCHEDULE_DATA[i];
    if (!schedule) continue;
    lookup[matchIdFromNum(i)] = {
      homeTeamId: '',
      awayTeamId: '',
      date: schedule.date,
      stage: 'GROUP',
      group: '',
    };
  }

  return lookup;
}
