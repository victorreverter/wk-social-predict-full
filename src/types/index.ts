// types/index.ts

export type PredictionMode = 'EASY' | 'HARD';
export type ViewTab = 'GROUP' | 'BRACKET' | 'AWARDS' | 'SUMMARY';
export type MatchStatus = 'NOT_PLAYED' | 'FINISHED';
export type ResultType = 'HOME_WIN' | 'AWAY_WIN' | 'DRAW';
export type Theme = 'light' | 'dark';

export interface Team {
  id: string;
  name: string;
  code: string; // e.g. 'ARG', 'BRZ', or 'A1'
  flagUrl?: string;
  group: string; // 'A' through 'L'
}

export interface MatchScore {
  homeGoals: number | null;
  awayGoals: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO string
  stage: string; // 'GROUP', 'R32', 'R16', 'QF', 'SF', 'F'
  group?: string; // e.g., 'A'
  score: MatchScore;
  status: MatchStatus;
  result?: ResultType; // Derived in Easy mode, calculated in Hard
}

export interface GroupStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface AwardsState {
  goldenBall: string;
  silverBall: string;
  bronzeBall: string;
  goldenBoot: string;
  silverBoot: string;
  bronzeBoot: string;
  goldenGlove: string;
  fifaYoungPlayer: string;
  mostYellowCards: string;
  mostRedCards: string;
  fifaFairPlay: string;
}

export interface AppState {
  mode: PredictionMode;
  theme: Theme;
  activeTab: ViewTab;
  groupMatches: Record<string, Match>; // key is match ID
  knockoutMatches: Record<string, Match>;
  selectedThirds: string[]; // IDs of the chosen 8 best 3rd placed teams
  isThirdsModalDismissed: boolean;
  isHelpModalOpen: boolean;
  awards: AwardsState;
}

