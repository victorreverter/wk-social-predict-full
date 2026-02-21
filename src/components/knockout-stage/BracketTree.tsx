import React from 'react';
import { BracketMatchNode } from './BracketMatchNode';
import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import { exportBracketToImage } from '../../utils/export-image';
import './BracketTree.css';

// We map stages to columns
const STAGES = ['R32', 'R16', 'QF', 'SF', 'F'];

export const BracketTree: React.FC = () => {
    const { state } = useApp();
    const matchesList = Object.values(state.knockoutMatches);

    const handleExport = () => {
        exportBracketToImage('bracket-export-target', 'my-wc2026-bracket.png');
    };

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
                        {STAGES.map((stageName) => {
                            const stageMatches = matchesList.filter(m => m.stage === stageName);

                            return (
                                <div key={stageName} className={`bracket-column stage-${stageName.toLowerCase()}`}>
                                    <h3 className="stage-title">{stageName}</h3>

                                    <div className="matches-vertical-flow">
                                        {stageMatches.map((match) => {
                                            const homeTeam = initialTeams.find(t => t.id === match.homeTeamId);
                                            const awayTeam = initialTeams.find(t => t.id === match.awayTeamId);

                                            return (
                                                <div key={match.id} className="match-connector-wrapper">
                                                    <BracketMatchNode match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
                                                </div>
                                            );
                                        })}
                                    </div>

                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
};
