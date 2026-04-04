import React from 'react';
import { useApp } from '../../context/AppContext';
import type { Match, Team, ResultType } from '../../types';
import './MatchCard.css';

interface Props {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
}

export const MatchCard: React.FC<Props> = ({ match, homeTeam, awayTeam }) => {
    const { state, updateGroupMatchScore, updateGroupMatchEasyResult } = useApp();
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
                        ? new Date(match.date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) + ' local' 
                        : 'TBD'
                    }
                    {match.localTime ? ` • ${match.localTime} match` : ''}
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
                    >
                        W
                    </button>
                    <button
                        className={`btn-easy draw-btn ${match.result === 'DRAW' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('DRAW')}
                    >
                        D
                    </button>
                    <button
                        className={`btn-easy win-btn ${match.result === 'AWAY_WIN' ? 'active' : ''}`}
                        onClick={() => handleEasyResult('AWAY_WIN')}
                    >
                        W
                    </button>
                </div>
            )}
        </div>
    );
};
