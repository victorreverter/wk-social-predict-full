import type { Match, GroupStanding } from '../types';
import { groups, initialTeams } from './data-init';
import { calculateGroupStandings } from './standings';

// 2026 World Cup Bracket Seeding Logic
// Top 2 from each of the 12 groups + 8 best 3rd-place teams (total 32 teams)

export const determineQualifiedTeams = (
    allMatches: Record<string, Match>
) => {
    let groupWinners: GroupStanding[] = [];
    let groupRunnersUp: GroupStanding[] = [];
    let allThirds: GroupStanding[] = [];

    groups.forEach((group) => {
        const standings = calculateGroupStandings(group, initialTeams, allMatches);
        if (standings.length >= 3) {
            groupWinners.push(standings[0]);
            groupRunnersUp.push(standings[1]);
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

export const generateInitialKnockoutMatches = (): Record<string, Match> => {
    const matches: Record<string, Match> = {};

    const stages = [
        { name: 'R32', count: 16 },
        { name: 'R16', count: 8 },
        { name: 'QF', count: 4 },
        { name: 'SF', count: 2 },
        { name: 'F', count: 1 }
    ];

    stages.forEach(stage => {
        for (let i = 0; i < stage.count; i++) {
            const matchId = `k_${stage.name}_${i + 1}`;
            matches[matchId] = {
                id: matchId,
                homeTeamId: 'TBD',
                awayTeamId: 'TBD',
                date: '2026-07-01T12:00:00Z',
                stage: stage.name,
                status: 'NOT_PLAYED',
                score: {
                    homeGoals: null,
                    awayGoals: null,
                    homePenalties: null,
                    awayPenalties: null,
                }
            };
        }
    });

    return matches;
};

export const updateKnockoutBracket = (
    currentKnockout: Record<string, Match>,
    groupMatches: Record<string, Match>,
    selectedThirds: string[] = []
): Record<string, Match> => {
    // Generate base empty bracket if current is empty
    let newKnockout = { ...currentKnockout };
    if (Object.keys(newKnockout).length === 0) {
        newKnockout = generateInitialKnockoutMatches();
    }

    const totalGroupMatches = Object.keys(groupMatches).length;
    const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;

    // Check if we have all 72 group matches finished
    if (totalGroupMatches === 72 && completedGroupMatches === 72) {
        const { groupWinners, groupRunnersUp, best8Thirds } = determineQualifiedTeams(groupMatches);

        // If the user hasn't selected 8 thirds yet, we don't seed the R32.
        if (selectedThirds.length === 8 && groupWinners.length === 12 && groupRunnersUp.length === 12) {
            const { allThirds } = determineQualifiedTeams(groupMatches);

            // Technically in FIFA rules the exact pairs depend on *which* 8 groups provide the 3rds. 
            // We use a simplified binding here since any 8 chosen will just drop into the 8 third-place slots sequentially for social prediction.
            const chosenThirdsStandings = allThirds.filter(t => t && selectedThirds.includes(t.teamId));

            // Standard Fixed R32 Pairing (Balanced to avoid intra-group rematches)
            const bindings = [
                [groupWinners[0], chosenThirdsStandings[0] || best8Thirds[0]],         // 1A vs 3-1
                [groupRunnersUp[1], groupRunnersUp[2]],    // 2B vs 2C
                [groupWinners[3], chosenThirdsStandings[1] || best8Thirds[1]],         // 1D vs 3-2
                [groupRunnersUp[4], groupRunnersUp[5]],    // 2E vs 2F
                [groupWinners[6], chosenThirdsStandings[2] || best8Thirds[2]],         // 1G vs 3-3
                [groupRunnersUp[7], groupRunnersUp[8]],    // 2H vs 2I
                [groupWinners[9], chosenThirdsStandings[3] || best8Thirds[3]],         // 1J vs 3-4
                [groupRunnersUp[10], groupRunnersUp[11]],  // 2K vs 2L

                [groupWinners[1], chosenThirdsStandings[4] || best8Thirds[4]],         // 1B vs 3-5
                [groupWinners[5], groupRunnersUp[0]],      // 1F vs 2A
                [groupWinners[4], chosenThirdsStandings[5] || best8Thirds[5]],         // 1E vs 3-6
                [groupWinners[8], groupRunnersUp[3]],      // 1I vs 2D
                [groupWinners[7], chosenThirdsStandings[6] || best8Thirds[6]],         // 1H vs 3-7
                [groupWinners[10], groupRunnersUp[6]],     // 1K vs 2G
                [groupWinners[2], chosenThirdsStandings[7] || best8Thirds[7]],         // 1C vs 3-8
                [groupWinners[11], groupRunnersUp[9]],     // 1L vs 2J
            ];

            bindings.forEach((pair, idx) => {
                const matchId = `k_R32_${idx + 1}`;
                if (newKnockout[matchId]) {
                    newKnockout[matchId] = {
                        ...newKnockout[matchId],
                        homeTeamId: pair[0].teamId,
                        awayTeamId: pair[1].teamId
                    };
                }
            });
        }
    } else {
        // Reset all to TBD if group is not entirely finished
        for (let i = 1; i <= 16; i++) {
            const matchId = `k_R32_${i}`;
            if (newKnockout[matchId]) {
                newKnockout[matchId] = {
                    ...newKnockout[matchId],
                    homeTeamId: 'TBD',
                    awayTeamId: 'TBD'
                };
            }
        }
    }

    // Now propagate winners logically from R32 up to F
    const propagationGuide = [
        { from: 'R32', to: 'R16', count: 8 },
        { from: 'R16', to: 'QF', count: 4 },
        { from: 'QF', to: 'SF', count: 2 },
        { from: 'SF', to: 'F', count: 1 }
    ];

    const getMatchWinner = (match?: Match): string => {
        if (!match) return 'TBD';
        if (match.status !== 'FINISHED') return 'TBD';
        if (match.result === 'HOME_WIN') return match.homeTeamId;
        if (match.result === 'AWAY_WIN') return match.awayTeamId;

        // For HARD mode score checking
        if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
            if (match.score.homeGoals > match.score.awayGoals) return match.homeTeamId;
            if (match.score.homeGoals < match.score.awayGoals) return match.awayTeamId;
            // Penalties
            if (match.score.homePenalties !== null && match.score.homePenalties !== undefined && match.score.awayPenalties !== null && match.score.awayPenalties !== undefined) {
                if (match.score.homePenalties > match.score.awayPenalties) return match.homeTeamId;
                if (match.score.homePenalties < match.score.awayPenalties) return match.awayTeamId;
            }
        }
        return 'TBD';
    };

    propagationGuide.forEach(rule => {
        for (let i = 1; i <= rule.count; i++) {
            const prevMatchHome = newKnockout[`k_${rule.from}_${i * 2 - 1}`];
            const prevMatchAway = newKnockout[`k_${rule.from}_${i * 2}`];

            const targetMatchId = `k_${rule.to}_${i}`;
            if (newKnockout[targetMatchId]) {
                newKnockout[targetMatchId] = {
                    ...newKnockout[targetMatchId],
                    homeTeamId: getMatchWinner(prevMatchHome),
                    awayTeamId: getMatchWinner(prevMatchAway)
                };
            }
        }
    });

    return newKnockout;
};
