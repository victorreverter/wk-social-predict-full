import React from 'react';
import { initialTeams } from '../../utils/data-init';
import { useApp } from '../../context/AppContext';
import { hasDefinedKnockoutTeams } from '../../utils/officialMatches';
import { isMatchKnockout } from '../../utils/schedule';
import type { Match, Team } from '../../types';
import './LockedMatchCard.css';

interface Props {
    match: Match;
}

const TBD_TEAM: Team = { id: 'TBD', name: 'TBD', code: 'TBD', group: '' };

const stageLabel = (stage: string): string => {
    const map: Record<string, string> = {
        GROUP: 'Group Stage',
        R32: 'Round of 32',
        R16: 'Round of 16',
        QF: 'Quarter-Final',
        SF: 'Semi-Final',
        '3RD': '3rd Place',
        F: 'Final',
    };
    return map[stage] || stage;
};

export const LockedMatchCard: React.FC<Props> = ({ match }) => {
    const { state } = useApp();
    const { officialMatches, officialKnockoutMatches } = state;

    const isKO = isMatchKnockout(match);
    const displayMatch = isKO && hasDefinedKnockoutTeams(officialKnockoutMatches[match.id])
        ? (officialKnockoutMatches[match.id] || match)
        : match;

    const homeTeam = initialTeams.find(t => t.id === displayMatch.homeTeamId)
        || (displayMatch.homeTeamId === 'TBD' ? TBD_TEAM : { ...TBD_TEAM, id: displayMatch.homeTeamId });
    const awayTeam = initialTeams.find(t => t.id === displayMatch.awayTeamId)
        || (displayMatch.awayTeamId === 'TBD' ? TBD_TEAM : { ...TBD_TEAM, id: displayMatch.awayTeamId });

    const official = officialMatches[match.id];

    const renderOfficialResult = () => {
        if (!official || official.status !== 'FINISHED' || official.home_goals === null || official.away_goals === null) {
            return (
                <div className="locked-official-result pending">
                    <span className="result-label">Official:</span>
                    <span className="result-score">Pending</span>
                </div>
            );
        }

        const isExact =
            match.score.homeGoals === official.home_goals &&
            match.score.awayGoals === official.away_goals;

        const userOutcome =
            match.score.homeGoals !== null && match.score.awayGoals !== null
                ? (match.score.homeGoals > match.score.awayGoals ? 'home' : match.score.homeGoals < match.score.awayGoals ? 'away' : 'draw')
                : null;

        const offOutcome =
            official.home_goals > official.away_goals ? 'home' : official.home_goals < official.away_goals ? 'away' : 'draw';

        const isCorrectOutcome = userOutcome !== null && userOutcome === offOutcome;

        let statusClass = 'wrong';
        if (isExact) statusClass = 'exact';
        else if (isCorrectOutcome) statusClass = 'correct';

        let scoreText = `${official.home_goals} - ${official.away_goals}`;
        if (official.went_to_pens && official.home_penalties !== null && official.away_penalties !== null) {
            scoreText += ` (${official.home_penalties} - ${official.away_penalties} pens)`;
        }

        return (
            <div className={`locked-official-result ${statusClass}`}>
                <span className="result-label">Official:</span>
                <span className="result-score">{scoreText}</span>
            </div>
        );
    };

    const matchLabel = isKO ? match.id.replace('m', 'M').toUpperCase() : match.id.toUpperCase();

    return (
        <div className="locked-match-card glass-panel">
            <div className="locked-match-header">
                <div className="locked-match-top-row">
                    <span className="locked-match-id">{matchLabel}</span>
                    <span className="locked-match-stage">{stageLabel(match.stage)}</span>
                    {match.group && <span className="locked-match-group">Group {match.group}</span>}
                    <span className="locked-badge">🔒 Locked</span>
                </div>
                {match.date && !match.date.includes('TBD') && (
                    <div className="locked-match-date">
                        {new Date(match.date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                    </div>
                )}
            </div>

            <div className="locked-match-teams">
                <div className="locked-team home">
                    <span className="locked-team-name">{homeTeam.name}</span>
                    <span className="locked-team-name-abbr">{homeTeam.code}</span>
                    {homeTeam.code !== 'TBD' && (
                        <img src={`${import.meta.env.BASE_URL}flags/${homeTeam.code}.svg`} className="team-flag" alt="" />
                    )}
                    <span className="locked-user-score">{match.score.homeGoals ?? '-'}</span>
                </div>

                <div className="locked-match-divider">
                    <span className="locked-vs">VS</span>
                </div>

                <div className="locked-team away">
                    <span className="locked-user-score">{match.score.awayGoals ?? '-'}</span>
                    {awayTeam.code !== 'TBD' && (
                        <img src={`${import.meta.env.BASE_URL}flags/${awayTeam.code}.svg`} className="team-flag" alt="" />
                    )}
                    <span className="locked-team-name">{awayTeam.name}</span>
                    <span className="locked-team-name-abbr">{awayTeam.code}</span>
                </div>
            </div>

            {renderOfficialResult()}
        </div>
    );
};
