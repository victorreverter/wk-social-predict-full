import type { Team, Match } from '../types';

export const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const initialTeams: Team[] = [
    { id: 'A1', name: 'Mexico', code: 'MEX', group: 'A' },
    { id: 'A2', name: 'South Africa', code: 'RSA', group: 'A' },
    { id: 'A3', name: 'South Korea', code: 'KOR', group: 'A' },
    { id: 'A4', name: 'UEFA Playoff D', code: 'PO-D', group: 'A' },
    { id: 'B1', name: 'Canada', code: 'CAN', group: 'B' },
    { id: 'B2', name: 'UEFA Playoff A', code: 'PO-A', group: 'B' },
    { id: 'B3', name: 'Qatar', code: 'QAT', group: 'B' },
    { id: 'B4', name: 'Switzerland', code: 'SUI', group: 'B' },
    { id: 'C1', name: 'Brazil', code: 'BRA', group: 'C' },
    { id: 'C2', name: 'Morocco', code: 'MAR', group: 'C' },
    { id: 'C3', name: 'Haiti', code: 'HAI', group: 'C' },
    { id: 'C4', name: 'Scotland', code: 'SCO', group: 'C' },
    { id: 'D1', name: 'United States', code: 'USA', group: 'D' },
    { id: 'D2', name: 'Paraguay', code: 'PAR', group: 'D' },
    { id: 'D3', name: 'Australia', code: 'AUS', group: 'D' },
    { id: 'D4', name: 'UEFA Playoff C', code: 'PO-C', group: 'D' },
    { id: 'E1', name: 'Germany', code: 'GER', group: 'E' },
    { id: 'E2', name: 'Curaçao', code: 'CUW', group: 'E' },
    { id: 'E3', name: 'Ivory Coast', code: 'CIV', group: 'E' },
    { id: 'E4', name: 'Ecuador', code: 'ECU', group: 'E' },
    { id: 'F1', name: 'Netherlands', code: 'NED', group: 'F' },
    { id: 'F2', name: 'Japan', code: 'JPN', group: 'F' },
    { id: 'F3', name: 'UEFA Playoff B', code: 'PO-B', group: 'F' },
    { id: 'F4', name: 'Tunisia', code: 'TUN', group: 'F' },
    { id: 'G1', name: 'Belgium', code: 'BEL', group: 'G' },
    { id: 'G2', name: 'Egypt', code: 'EGY', group: 'G' },
    { id: 'G3', name: 'Iran', code: 'IRN', group: 'G' },
    { id: 'G4', name: 'New Zealand', code: 'NZL', group: 'G' },
    { id: 'H1', name: 'Spain', code: 'ESP', group: 'H' },
    { id: 'H2', name: 'Cape Verde', code: 'CPV', group: 'H' },
    { id: 'H3', name: 'Saudi Arabia', code: 'KSA', group: 'H' },
    { id: 'H4', name: 'Uruguay', code: 'URU', group: 'H' },
    { id: 'I1', name: 'France', code: 'FRA', group: 'I' },
    { id: 'I2', name: 'Senegal', code: 'SEN', group: 'I' },
    { id: 'I3', name: 'IC Playoff 2', code: 'IC-2', group: 'I' },
    { id: 'I4', name: 'Norway', code: 'NOR', group: 'I' },
    { id: 'J1', name: 'Argentina', code: 'ARG', group: 'J' },
    { id: 'J2', name: 'Algeria', code: 'ALG', group: 'J' },
    { id: 'J3', name: 'Austria', code: 'AUT', group: 'J' },
    { id: 'J4', name: 'Jordan', code: 'JOR', group: 'J' },
    { id: 'K1', name: 'Portugal', code: 'POR', group: 'K' },
    { id: 'K2', name: 'IC Playoff 1', code: 'IC-1', group: 'K' },
    { id: 'K3', name: 'Uzbekistan', code: 'UZB', group: 'K' },
    { id: 'K4', name: 'Colombia', code: 'COL', group: 'K' },
    { id: 'L1', name: 'England', code: 'ENG', group: 'L' },
    { id: 'L2', name: 'Croatia', code: 'CRO', group: 'L' },
    { id: 'L3', name: 'Ghana', code: 'GHA', group: 'L' },
    { id: 'L4', name: 'Panama', code: 'PAN', group: 'L' }
];

// Generates the 6 matches per group (round-robin for 4 teams)
export const generateInitialGroupMatches = (): Record<string, Match> => {
    const matches: Record<string, Match> = {};
    let matchCounter = 1;

    groups.forEach((group) => {
        const groupTeams = initialTeams.filter(t => t.group === group);

        // Matchups for a 4-team group (1v2, 3v4, 1v3, 2v4, 1v4, 2v3)
        const matchups = [
            [0, 1], [2, 3], // Matchday 1
            [0, 2], [3, 1], // Matchday 2
            [3, 0], [1, 2], // Matchday 3
        ];

        matchups.forEach(([homeIdx, awayIdx]) => {
            const matchId = `m${matchCounter++}`;
            matches[matchId] = {
                id: matchId,
                homeTeamId: groupTeams[homeIdx].id,
                awayTeamId: groupTeams[awayIdx].id,
                date: '2026-06-11T12:00:00Z', // Placeholder date
                stage: 'GROUP',
                group: group,
                status: 'NOT_PLAYED',
                score: {
                    homeGoals: null,
                    awayGoals: null,
                }
            };
        });
    });

    return matches;
};
