import { describe, expect, it } from 'vitest';
import { normalizePenaltyShootoutScore } from '../utils/footballDataMappings';

describe('normalizePenaltyShootoutScore', () => {
    it('keeps already-correct penalty shootout scores unchanged', () => {
        expect(
            normalizePenaltyShootoutScore(1, 1, 3, 4, 'PENALTY_SHOOTOUT')
        ).toEqual({ homeGoals: 1, awayGoals: 1 });
    });

    it('subtracts penalty totals when the fetched full-time score includes the shootout', () => {
        expect(
            normalizePenaltyShootoutScore(4, 5, 3, 4, 'PENALTY_SHOOTOUT')
        ).toEqual({ homeGoals: 1, awayGoals: 1 });
    });

    it('leaves non-penalty scores untouched', () => {
        expect(
            normalizePenaltyShootoutScore(2, 1, null, null, 'REGULAR')
        ).toEqual({ homeGoals: 2, awayGoals: 1 });
    });

    it('does not mutate non-shootout durations even if penalty data exists', () => {
        expect(
            normalizePenaltyShootoutScore(3, 2, 1, 0, 'EXTRA_TIME')
        ).toEqual({ homeGoals: 3, awayGoals: 2 });
    });
});
