export interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface FootballDataScoreDetail {
  home: number | null;
  away: number | null;
}

export interface FootballDataScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
  fullTime: FootballDataScoreDetail;
  halfTime: FootballDataScoreDetail;
  extraTime?: FootballDataScoreDetail;
  penalties?: FootballDataScoreDetail;
}

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED';
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score: FootballDataScore;
  lastUpdated: string;
}

export interface FootballDataMatchesResponse {
  count: number;
  filters: {
    dateFrom: string;
    dateTo: string;
    permission: string;
  };
  competition: {
    id: number;
    name: string;
    code: string;
  };
  matches: FootballDataMatch[];
}

export interface MappedMatchResult {
  internalMatchId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: 'NOT_PLAYED' | 'FINISHED';
}
