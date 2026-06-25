import { describe, expect, it } from 'vitest';
import { buildOfficialR32TeamSet } from '../lib/scoreKnockout';
import { generateInitialGroupMatches, groups, initialTeams } from '../utils/data-init';

const buildAllGroupOfficialMatches = () => {
    const matches = generateInitialGroupMatches();

    return Object.values(matches).map(match => {
        const homeSeed = parseInt(match.homeTeamId.slice(1), 10);
        const awaySeed = parseInt(match.awayTeamId.slice(1), 10);
        const homeWins = homeSeed < awaySeed;

        return {
            match_id: match.id,
            home_goals: homeWins ? 1 : 0,
            away_goals: homeWins ? 0 : 1,
            home_penalties: null,
            away_penalties: null,
            status: 'FINISHED',
        };
    });
};

describe('buildOfficialR32TeamSet', () => {
    it('includes only winners and runners-up from closed groups before the full group stage is finished', () => {
        const groupAMatches = Object.values(generateInitialGroupMatches())
            .filter(match => match.group === 'A')
            .map(match => ({
                match_id: match.id,
                home_goals: 0,
                away_goals: 0,
                status: 'FINISHED',
            }));

        const { teams, finishedGroups, allGroupsFinished } = buildOfficialR32TeamSet(groupAMatches, [
            { group_letter: 'A', order: ['A4', 'A2', 'A1', 'A3'] },
        ]);

        expect(allGroupsFinished).toBe(false);
        expect(finishedGroups.has('A')).toBe(true);
        expect(teams.has('A4')).toBe(true);
        expect(teams.has('A2')).toBe(true);
        expect(teams.has('A1')).toBe(false);
        expect(teams.size).toBe(2);
    });

    it('adds the best eight third-placed teams once all groups are finished', () => {
        const { teams, finishedGroups, allGroupsFinished } = buildOfficialR32TeamSet(buildAllGroupOfficialMatches());

        const groupThirds = groups.map(group => initialTeams.filter(team => team.group === group)[2].id);

        expect(allGroupsFinished).toBe(true);
        expect(finishedGroups.size).toBe(12);
        expect(teams.size).toBe(32);
        expect(teams.has(groupThirds[0])).toBe(true);
        expect(teams.has(groupThirds[7])).toBe(true);
        expect(teams.has(groupThirds[8])).toBe(false);
        expect(teams.has(groupThirds[11])).toBe(false);
    });
});
