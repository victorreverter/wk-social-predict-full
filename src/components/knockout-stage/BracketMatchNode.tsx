import React from 'react';
import type { Match, Team, ResultType } from '../../types';
import { useApp } from '../../context/AppContext';
import './BracketMatchNode.css';

interface Props {
    match: Match;
    homeTeam?: Team;
    awayTeam?: Team;
}

export const BracketMatchNode: React.FC<Props> = React.memo(({ match, homeTeam, awayTeam }) => {
    const { state, updateKnockoutMatchEasyResult, updateKnockoutMatchScore } = useApp();
    const { mode } = state;

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

    const renderTeam = (teamInfo?: Team, pens?: number | null, isHome: boolean = true) => {
        return (
            <div className={`bracket-team ${isHome ? 'home' : 'away'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {teamInfo && <img src={`${import.meta.env.BASE_URL}flags/${teamInfo.code}.svg`} className="team-flag" crossOrigin="anonymous" width={24} height={16} alt="" />}
                    <span className="team-name">{teamInfo ? teamInfo.name : 'TBD'}</span>
                </div>

                {mode === 'HARD' ? (
                    <div className="score-inputs">
                        {pens !== undefined && pens !== null && (
                            <input
                                type="number"
                                className="pen-input"
                                min="0"
                                placeholder="P"
                                title="Penalties"
                                value={isHome ? (match.score?.homePenalties ?? '') : (match.score?.awayPenalties ?? '')}
                                onChange={(e) => handleHardScoreChange(isHome ? 'home-pen' : 'away-pen', e.target.value)}
                            />
                        )}
                        <input
                            type="number"
                            className="bracket-score-input"
                            min="0"
                            placeholder="-"
                            value={isHome ? (match.score?.homeGoals ?? '') : (match.score?.awayGoals ?? '')}
                            onChange={(e) => handleHardScoreChange(isHome ? 'home' : 'away', e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="easy-bracket-controls">
                        <button
                            className={`btn-easy-bracket ${match.result === (isHome ? 'HOME_WIN' : 'AWAY_WIN') ? 'active' : ''}`}
                            onClick={() => handleEasyResult(isHome ? 'HOME_WIN' : 'AWAY_WIN')}
                            title="Select Winner"
                        >
                            W
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bracket-match-node glass-panel">
            <div className="match-id-badge">{match.id.replace('k_', '').toUpperCase()}</div>

            <div className="bracket-teams-container">
                {renderTeam(homeTeam, match.score.homePenalties, true)}
                <div className="bracket-divider"></div>
                {renderTeam(awayTeam, match.score.awayPenalties, false)}
            </div>
        </div>
    );
});
