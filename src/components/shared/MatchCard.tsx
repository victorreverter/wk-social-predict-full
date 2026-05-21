import React from 'react';
import { useApp } from '../../context/AppContext';
import { useMatchLock } from '../../hooks/useMatchLock';
import type { Match, Team, ResultType } from '../../types';
import './MatchCard.css';

interface Props {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
}

export const MatchCard: React.FC<Props> = ({ match, homeTeam, awayTeam }) => {
    const { state, updateGroupMatchScore, updateGroupMatchEasyResult } = useApp();
    const { isLocked: isMatchTimeLocked, formatted: lockCountdown, urgency } = useMatchLock(match);
    const { mode, officialMatches } = state;

    const handleEasyResult = (result: ResultType) => {
        updateGroupMatchEasyResult(match.id, result);
    };

    const handleHardScoreChange = (type: 'home' | 'away', val: string) => {
        const num = val === '' ? null : parseInt(val, 10);
        if (num !== null && (isNaN(num) || num < 0)) return;

        if (type === 'home') {
            updateGroupMatchScore(match.id, { ...match.score, homeGoals: num });
        } else {
            updateGroupMatchScore(match.id, { ...match.score, awayGoals: num });
        }
    };

    const official = officialMatches[match.id];

    const renderOfficialResult = () => {
        if (!official) {
            return (
                <div className="match-official-result pending">
                    <span className="result-label">Official:</span>
                    <span className="result-score">Pending</span>
                </div>
            );
        }

        if (official.status !== 'FINISHED' || official.home_goals === null || official.away_goals === null) {
            return (
                <div className="match-official-result pending">
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
            <div className={`match-official-result ${statusClass}`}>
                <span className="result-label">Official:</span>
                <span className="result-score">{scoreText}</span>
            </div>
        );
    };

    return (
        <div className={`match-card glass-panel ${match.status === 'FINISHED' ? 'finished' : ''}`}>
            <div className="match-card-header">
                <span className="match-card-id">{match.id.toUpperCase()}</span>
                <span className="match-card-date">
                    {match.date && !match.date.includes('TBD') 
                        ? <span className="user-time">{new Date(match.date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })} your time</span> 
                        : <span className="user-time">TBD</span>
                    }
                    {match.localTime && match.localTime !== 'TBD' 
                        ? <span className="venue-time"> • {match.localTime} match time</span> 
                        : ''}
                </span>
                {lockCountdown && (
                    <span className={`lock-countdown ${urgency}`}>
                        {lockCountdown}
                    </span>
                )}
            </div>
            <div className="match-teams">
                <div className="team home">
                    <span className="team-name">{homeTeam.name}</span>
                    <span className="team-name-abbr">{homeTeam.code}</span>
                    <img src={`${import.meta.env.BASE_URL}flags/${homeTeam.code}.svg`} className="team-flag" alt="" />
                    {mode === 'HARD' && (
                        <input
                            type="number"
                            min="0"
                            className="score-input"
                            value={match.score.homeGoals === null ? '' : match.score.homeGoals}
                            onChange={(e) => handleHardScoreChange('home', e.target.value)}
                             placeholder="-"
                            disabled={isMatchTimeLocked}
                        />
                    )}
                </div>

                <div className="match-divider">VS</div>

                <div className="team away">
                    {mode === 'HARD' && (
                        <input
                            type="number"
                            min="0"
                            className="score-input"
                            value={match.score.awayGoals === null ? '' : match.score.awayGoals}
                            onChange={(e) => handleHardScoreChange('away', e.target.value)}
                            placeholder="-"
                            disabled={isMatchTimeLocked}
                        />
                    )}
                    <img src={`${import.meta.env.BASE_URL}flags/${awayTeam.code}.svg`} className="team-flag" alt="" />
                    <span className="team-name">{awayTeam.name}</span>
                    <span className="team-name-abbr">{awayTeam.code}</span>
                </div>
            </div>

            {renderOfficialResult()}

            {mode === 'EASY' && (
                <div className="easy-controls">
                    <button
                        className={`btn-easy win-btn ${match.result === 'HOME_WIN' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('HOME_WIN')}
                        disabled={isMatchTimeLocked}
                    >
                        W
                    </button>
                    <button
                        className={`btn-easy draw-btn ${match.result === 'DRAW' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('DRAW')}
                        disabled={isMatchTimeLocked}
                    >
                        D
                    </button>
                    <button
                        className={`btn-easy win-btn ${match.result === 'AWAY_WIN' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('AWAY_WIN')}
                        disabled={isMatchTimeLocked}
                    >
                        W
                    </button>
                </div>
            )}
        </div>
    );
};
