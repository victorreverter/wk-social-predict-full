import React from 'react';
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

                        {/* CENTER - FINAL */}
                        {finalMatch && (
                            <div className="bracket-column stage-f center-final">
                                <h3 className="stage-title">FINAL</h3>
                                <div className="matches-vertical-flow final-flow">
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

                        {/* RIGHT WING (Reversed Stages) */}
                        {RIGHT_STAGES.map(stage => renderStageColumn(stage, 'right'))}

                    </div>

                </div>
            </div>
        </div>
    );
};
