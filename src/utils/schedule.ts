import type { Match } from '../types';

export interface DailySchedule {
  dateKey: string;
  displayDate: string;
  shortLabel: string;
  fullLabel: string;
  matches: Match[];
  hasGames: boolean;
}

const START_DATE = '2026-05-01';
const END_DATE = '2026-12-31';

const addOneDay = (date: Date): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const toDateKey = (d: Date): string => d.toLocaleDateString('en-CA');

const toShortLabel = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

const toFullLabel = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const toDisplayDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

export const getDailySchedules = (
  groupMatches: Record<string, Match>,
  knockoutMatches: Record<string, Match>
): DailySchedule[] => {
  const allMatches = [...Object.values(groupMatches), ...Object.values(knockoutMatches)]
    .filter(m => m.date && !m.date.includes('TBD'));

  const matchByDay = new Map<string, Match[]>();
  allMatches.forEach(match => {
    const key = toDateKey(new Date(match.date));
    if (!matchByDay.has(key)) matchByDay.set(key, []);
    matchByDay.get(key)!.push(match);
  });
  matchByDay.forEach(matches => {
    matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  const start = new Date(START_DATE + 'T00:00:00Z');
  const end = new Date(END_DATE + 'T00:00:00Z');
  const allDates: DailySchedule[] = [];

  for (let d = new Date(start); d <= end; d = addOneDay(d)) {
    const key = toDateKey(d);
    const matches = matchByDay.get(key) || [];
    allDates.push({
      dateKey: key,
      displayDate: toDisplayDate(d),
      shortLabel: toShortLabel(d),
      fullLabel: toFullLabel(d),
      matches,
      hasGames: matches.length > 0,
    });
  }

  return allDates;
};

export const getMonthForDateKey = (dateKey: string): string => {
  const d = new Date(dateKey + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const findTodayIndex = (schedules: DailySchedule[]): number => {
  const today = new Date();
  const todayKey = toDateKey(today);
  const idx = schedules.findIndex(s => s.dateKey >= todayKey);
  return idx === -1 ? schedules.length - 1 : idx;
};

export const isMatchKnockout = (match: Match): boolean => {
  return ['R32', 'R16', 'QF', 'SF', '3RD', 'F'].includes(match.stage);
};
