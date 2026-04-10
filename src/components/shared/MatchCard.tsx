import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Match, Team, ResultType } from '../../types';
import './MatchCard.css';

interface Props {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
}

export const MatchCard: React.FC<Props> = ({ match, homeTeam, awayTeam }) => {
    const { state, updateGroupMatchScore, updateGroupMatchEasyResult } = useApp();
    const { isLocked } = useAuth();
    const { mode } = state;

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
            </div>
            <div className="match-teams">
                <div className="team home">
                    <span className="team-name">{homeTeam.name}</span>
                    <img src={`${import.meta.env.BASE_URL}flags/${homeTeam.code}.svg`} className="team-flag" alt="" />
                    {mode === 'HARD' && (
                        <input
                            type="number"
                            min="0"
                            className="score-input"
                            value={match.score.homeGoals === null ? '' : match.score.homeGoals}
                            onChange={(e) => handleHardScoreChange('home', e.target.value)}
                            placeholder="-"
                            disabled={isLocked}
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
                            disabled={isLocked}
                        />
                    )}
                    <img src={`${import.meta.env.BASE_URL}flags/${awayTeam.code}.svg`} className="team-flag" alt="" />
                    <span className="team-name">{awayTeam.name}</span>
                </div>
            </div>

            {mode === 'EASY' && (
                <div className="easy-controls">
                    <button
                        className={`btn-easy win-btn ${match.result === 'HOME_WIN' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('HOME_WIN')}
                        disabled={isLocked}
                    >
                        W
                    </button>
                    <button
                        className={`btn-easy draw-btn ${match.result === 'DRAW' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('DRAW')}
                        disabled={isLocked}
                    >
                        D
                    </button>
                    <button
                        className={`btn-easy win-btn ${match.result === 'AWAY_WIN' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('AWAY_WIN')}
                        disabled={isLocked}
                    >
                        W
                    </button>
                </div>
            )}
        </div>
    );
};
