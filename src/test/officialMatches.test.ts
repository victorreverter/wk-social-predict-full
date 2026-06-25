import { describe, expect, it } from 'vitest';
import { hasDefinedKnockoutTeams, hasPublishedOfficialKnockoutMatch } from '../utils/officialMatches';
import type { Match } from '../types';

describe('official knockout visibility', () => {
    it('treats a defined knockout matchup as visible even before official publish metadata exists', () => {
        const match: Match = {
            id: 'm73',
            homeTeamId: 'USA',
            awayTeamId: 'MEX',
            date: '2026-06-28T19:00:00Z',
            stage: 'R32',
            venue: 'SoFi Stadium, Inglewood',
            localTime: '12:00 PDT',
            status: 'NOT_PLAYED',
            score: { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null },
        };

        expect(hasDefinedKnockoutTeams(match)).toBe(true);
        expect(hasPublishedOfficialKnockoutMatch(undefined)).toBe(false);
    });

    it('keeps TBD knockout placeholders hidden', () => {
        const match: Match = {
            id: 'm74',
            homeTeamId: 'TBD',
            awayTeamId: 'USA',
            date: '2026-06-29T20:30:00Z',
            stage: 'R32',
            venue: 'Gillette Stadium, Foxborough',
            localTime: '16:30 EDT',
            status: 'NOT_PLAYED',
            score: { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null },
        };

        expect(hasDefinedKnockoutTeams(match)).toBe(false);
    });
});
