import React from 'react';
import type { Match, Team, ResultType } from '../../types';
import { useApp } from '../../context/AppContext';
import { useMatchLock } from '../../hooks/useMatchLock';
import './BracketMatchNode.css';

interface Props {
    match: Match;
    homeTeam?: Team;
    awayTeam?: Team;
}

export const BracketMatchNode: React.FC<Props> = React.memo(({ match, homeTeam, awayTeam }) => {
    const { state, updateKnockoutMatchEasyResult, updateKnockoutMatchScore } = useApp();
    const { isLocked: isMatchTimeLocked, formatted: lockCountdown } = useMatchLock(match);
    const { mode, officialMatches } = state;

    const handleEasyResult = (result: ResultType) => {
        updateKnockoutMatchEasyResult(match.id, result);
    };

    const handleHardScoreChange = (type: 'home' | 'away' | 'home-pen' | 'away-pen', val: string) => {
        const numVal = val === '' ? null : parseInt(val, 10);
        const currentScore = match.score || { homeGoals: null, awayGoals: null, homePenalties: null, awayPenalties: null };
        const newScore = { ...currentScore };

        if (type === 'home') newScore.homeGoals = numVal;
        if (type === 'away') newScore.awayGoals = numVal;
        if (type === 'home-pen') newScore.homePenalties = numVal;
        if (type === 'away-pen') newScore.awayPenalties = numVal;

        updateKnockoutMatchScore(match.id, newScore);
    };

    const official = officialMatches[match.id];

    const renderTeam = (teamInfo?: Team, pens?: number | null, isHome: boolean = true) => {
        const isKnockoutTied = match.score?.homeGoals !== null &&
            match.score?.awayGoals !== null &&
            match.score?.homeGoals === match.score?.awayGoals;

        return (
            <div className={`bracket-team ${isHome ? 'home' : 'away'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {teamInfo && <img src={`${import.meta.env.BASE_URL}flags/${teamInfo.code}.svg`} className="team-flag" width={24} height={16} alt="" />}
                    <span className="team-name full">{teamInfo ? teamInfo.name : 'TBD'}</span>
                    <span className="team-name abbr">{teamInfo ? teamInfo.code : 'TBD'}</span>
                </div>

                {mode === 'HARD' ? (
                    <div className="score-inputs">
                        {(isKnockoutTied || (pens !== undefined && pens !== null)) && (
                            <input
                                type="number"
                                className="pen-input"
                                min="0"
                                placeholder="P"
                                title="Penalties"
                                value={isHome ? (match.score?.homePenalties ?? '') : (match.score?.awayPenalties ?? '')}
                                onChange={(e) => handleHardScoreChange(isHome ? 'home-pen' : 'away-pen', e.target.value)}
                                disabled={isMatchTimeLocked}
                            />
                        )}
                        <input
                            type="number"
                            className="bracket-score-input"
                            min="0"
                            placeholder="-"
                            value={isHome ? (match.score?.homeGoals ?? '') : (match.score?.awayGoals ?? '')}
                            onChange={(e) => handleHardScoreChange(isHome ? 'home' : 'away', e.target.value)}
                            disabled={isMatchTimeLocked}
                        />
                    </div>
                ) : (
                    <div className="easy-bracket-controls">
                        <button
                            className={`btn-easy-bracket ${match.result === (isHome ? 'HOME_WIN' : 'AWAY_WIN') ? 'active' : ''}`}
                            onClick={() => handleEasyResult(isHome ? 'HOME_WIN' : 'AWAY_WIN')}
                            title="Select Winner"
                            disabled={isMatchTimeLocked}
                        >
                            W
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const formattedUserDate = new Date(match.date).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const renderOfficialResult = () => {
        if (!official) {
            return (
                <div className="bracket-official-result pending">
                    <span className="result-label">Official:</span>
                    <span className="result-score">Pending</span>
                </div>
            );
        }

        if (official.status !== 'FINISHED' || official.home_goals === null || official.away_goals === null) {
            return (
                <div className="bracket-official-result pending">
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
            <div className={`bracket-official-result ${statusClass}`}>
                <span className="result-label">Official:</span>
                <span className="result-score">{scoreText}</span>
            </div>
        );
    };

    return (
        <div className="bracket-match-node glass-panel">
            <div className="match-header">
                <div className="match-id-badge">{match.id.startsWith('m') ? `M${match.id.slice(1)}` : match.id.replace('k_', '').toUpperCase()}</div>
                {match.date && !match.date.includes('TBD') && (
                    <div className="match-date-info" title={match.venue ? `Venue: ${match.venue}` : undefined}>
                        <span className="user-time" title="Your Local Time">({formattedUserDate} your time)</span>
                        {match.localTime && match.localTime !== 'TBD' && (
                            <span className="venue-time" title="Venue Local Time"> • {match.localTime} match time</span>
                )}
                {lockCountdown && (
                    <span className={`lock-countdown ${isMatchTimeLocked ? 'locked' : 'warning'}`}>
                        {lockCountdown}
                    </span>
                )}
            </div>
                )}
            </div>

            <div className="bracket-teams-container">
                {renderTeam(homeTeam, match.score.homePenalties, true)}
                <div className="bracket-divider"></div>
                {renderTeam(awayTeam, match.score.awayPenalties, false)}
            </div>

            {renderOfficialResult()}
        </div>
    );
});
