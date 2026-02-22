import React from 'react';
import type { Match } from '../../types';
import { BracketMatchNode } from './BracketMatchNode';
import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import { exportBracketToImage } from '../../utils/export-image';
import './BracketTree.css';

// Define the column structure for a Split Bracket
const LEFT_STAGES = ['R32', 'R16', 'QF', 'SF'];
const RIGHT_STAGES = ['SF', 'QF', 'R16', 'R32']; // Mirrored order for right side

export const BracketTree: React.FC = () => {
    const { state } = useApp();
    const matchesList = Object.values(state.knockoutMatches);

    const handleExport = () => {
        exportBracketToImage(matchesList, 'my-wc2026-bracket.jpg');
    };

    // Helper: Split an array of matches strictly in half for left/right mapping
    const getSplitMatches = (stageName: string, side: 'left' | 'right') => {
        const stageMatches = matchesList.filter(m => m.stage === stageName);
        const halfStringLength = Math.ceil(stageMatches.length / 2);
        return side === 'left' ? stageMatches.slice(0, halfStringLength) : stageMatches.slice(halfStringLength);
    };

    // Render a generic column of matches based on split
    const renderStageColumn = (stageName: string, side: 'left' | 'right') => {
        const matches = getSplitMatches(stageName, side);
        return (
            <div key={`${side}-${stageName}`} className={`bracket-column stage-${stageName.toLowerCase()} ${side}-side`}>
                <h3 className="stage-title">{stageName}</h3>
                <div className="matches-vertical-flow">
                    {matches.map((match) => {
                        const homeTeam = initialTeams.find(t => t.id === match.homeTeamId);
                        const awayTeam = initialTeams.find(t => t.id === match.awayTeamId);

                        return (
                            <div key={match.id} className={`match-connector-wrapper ${side}-connector`}>
                                <BracketMatchNode match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Extract exactly the Final match
    const finalMatch = matchesList.find(m => m.stage === 'F');
    const thirdMatch = matchesList.find(m => m.stage === '3RD');

    const getMatchWinner = (match?: Match): string => {
        if (!match || match.status !== 'FINISHED') return 'TBD';
        if (match.result === 'HOME_WIN') return match.homeTeamId;
        if (match.result === 'AWAY_WIN') return match.awayTeamId;
        if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
            if (match.score.homeGoals > match.score.awayGoals) return match.homeTeamId;
            if (match.score.homeGoals < match.score.awayGoals) return match.awayTeamId;
            if (match.score.homePenalties !== null && match.score.awayPenalties !== null && match.score.homePenalties !== undefined && match.score.awayPenalties !== undefined) {
                if (match.score.homePenalties > match.score.awayPenalties) return match.homeTeamId;
                if (match.score.homePenalties < match.score.awayPenalties) return match.awayTeamId;
            }
        }
        return 'TBD';
    };

    const championId = getMatchWinner(finalMatch);
    const championTeam = championId !== 'TBD' ? initialTeams.find(t => t.id === championId) : undefined;

    return (
        <div className="bracket-view-container">
            <div className="bracket-actions">
                <button className="btn-export" onClick={handleExport}>
                    📸 Export Bracket
                </button>
            </div>

            <div className="bracket-tree-wrapper" id="bracket-export-target">
                <div className="bracket-scroll-container">

                    <div className="bracket-columns">

                        {/* LEFT WING */}
                        {LEFT_STAGES.map(stage => renderStageColumn(stage, 'left'))}

                        {/* CENTER - FINAL & 3RD PLACE & CHAMPION */}
                        {(finalMatch || thirdMatch) && (
                            <div className="bracket-column stage-f center-final">
                                <h3 className="stage-title">FINAL</h3>

                                <div className="center-final-content">
                                    {championTeam && (
                                        <div className="champion-display">
                                            <div className="champion-badge">
                                                <img src={`${import.meta.env.BASE_URL}world_cup_trophy.png`} className="champion-trophy" alt="Trophy" />
                                                <h3 className="champion-title">CHAMPION</h3>
                                                <span className="champion-name">{championTeam.name}</span>
                                            </div>
                                        </div>
                                    )}

                                    {finalMatch && (
                                        <div className="final-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div className="matches-vertical-flow final-flow" style={{ height: 'auto' }}>
                                                <div className="match-connector-wrapper center-connector">
                                                    <BracketMatchNode
                                                        match={finalMatch}
                                                        homeTeam={initialTeams.find(t => t.id === finalMatch.homeTeamId)}
                                                        awayTeam={initialTeams.find(t => t.id === finalMatch.awayTeamId)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {thirdMatch && (
                                        <div className="third-place-container">
                                            <h3 className="stage-title third-title">3RD PLACE</h3>
                                            <div className="matches-vertical-flow final-flow">
                                                <div className="match-connector-wrapper center-connector">
                                                    <BracketMatchNode
                                                        match={thirdMatch}
                                                        homeTeam={initialTeams.find(t => t.id === thirdMatch.homeTeamId)}
                                                        awayTeam={initialTeams.find(t => t.id === thirdMatch.awayTeamId)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* RIGHT WING (Reversed Stages) */}
                        {RIGHT_STAGES.map(stage => renderStageColumn(stage, 'right'))}

                    </div>

                </div>
            </div>
        </div>
    );
};
