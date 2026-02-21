import type { Team, Match, GroupStanding } from '../types';

export const calculateGroupStandings = (
    group: string,
    teams: Team[],
    matches: Record<string, Match>
): GroupStanding[] => {

    const groupTeams = teams.filter(t => t.group === group);
    const groupMatches = Object.values(matches).filter(m => m.group === group && m.status === 'FINISHED');

    // Initialize standings
    const standingsMap: Record<string, GroupStanding> = {};
    groupTeams.forEach(team => {
        standingsMap[team.id] = {
            teamId: team.id,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
        };
    });

    // Process matches
    groupMatches.forEach(match => {
        const home = standingsMap[match.homeTeamId];
        const away = standingsMap[match.awayTeamId];

        if (!home || !away) return; // defensive

        home.played += 1;
        away.played += 1;

        // Hard Mode logic (uses goals/score)
        if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
            const hg = match.score.homeGoals;
            const ag = match.score.awayGoals;

            home.goalsFor += hg;
            home.goalsAgainst += ag;
            away.goalsFor += ag;
            away.goalsAgainst += hg;

            if (hg > ag) {
                home.won += 1;
                home.points += 3;
                away.lost += 1;
            } else if (hg < ag) {
                away.won += 1;
                away.points += 3;
                home.lost += 1;
            } else {
                home.drawn += 1;
                away.drawn += 1;
                home.points += 1;
                away.points += 1;
            }
        }
        // Easy Mode logic (uses result enum)
        else if (match.result) {
            if (match.result === 'HOME_WIN') {
                home.won += 1;
                home.points += 3;
                away.lost += 1;
            } else if (match.result === 'AWAY_WIN') {
                away.won += 1;
                away.points += 3;
                home.lost += 1;
            } else if (match.result === 'DRAW') {
                home.drawn += 1;
                away.drawn += 1;
                home.points += 1;
                away.points += 1;
            }
        }

        home.goalDifference = home.goalsFor - home.goalsAgainst;
        away.goalDifference = away.goalsFor - away.goalsAgainst;
    });

    // Sort standings: Points > Goal Difference > Goals For
    // Note: Official FIFA rules also include H2H, but that's complex for this scope right now
    return Object.values(standingsMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
};
