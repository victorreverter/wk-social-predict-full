import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { determineQualifiedTeams } from '../../utils/bracket-logic';
import { initialTeams } from '../../utils/data-init';
import { useAuth } from '../../context/AuthContext';
import './ThirdPlaceSelection.css';

export const ThirdPlaceSelection: React.FC = () => {
    const { state, setSelectedThirds, setActiveTab, setThirdsModalDismissed } = useApp();
    const { groupMatches, selectedThirds } = state;
    const { isLocked } = useAuth();

    const totalGroupMatches = Object.keys(groupMatches).length;
    const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;

    // We only show if all matches are done and they haven't submitted 8 teams yet.
    // Also, we prevent it entirely if the app is locked.
    const isGroupsFinished = totalGroupMatches === 72 && completedGroupMatches === 72;
    const needsSelection = isGroupsFinished && selectedThirds.length !== 8 && !isLocked;

    const [localSelection, setLocalSelection] = useState<string[]>([]);

    useEffect(() => {
        if (!needsSelection) {
            setLocalSelection([]);
        }
    }, [needsSelection]);

    useEffect(() => {
        if (state.activeTab === 'BRACKET' && needsSelection && state.isThirdsModalDismissed) {
            setThirdsModalDismissed(false);
        }
    }, [state.activeTab, needsSelection]);

    if (!needsSelection || state.isThirdsModalDismissed) return null;

    const { allThirds, best8Thirds } = determineQualifiedTeams(groupMatches);

    // Provide a helper to pre-fill the "correct" best 8 based on points
    const handleAutoSelectBest = () => {
        setLocalSelection(best8Thirds.map(t => t.teamId));
    };

    const toggleTeam = (teamId: string) => {
        setLocalSelection(prev => {
            if (prev.includes(teamId)) {
                return prev.filter(id => id !== teamId);
            }
            if (prev.length < 8) {
                return [...prev, teamId];
            }
            return prev;
        });
    };

    const handleSubmit = () => {
        if (localSelection.length === 8) {
            setSelectedThirds(localSelection);
            setActiveTab('BRACKET'); // Take user straight to bracket
        }
    };

    const handleClose = () => {
        setThirdsModalDismissed(true);
        setActiveTab('GROUP');
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content glass-panel">
                <button
                    className="modal-close-btn"
                    onClick={handleClose}
                    aria-label="Close"
                >
                    ×
                </button>
                <h2 className="text-gradient">Select Qualifying 3rd-Place Teams</h2>
                <p>The Group Stage is complete! Choose exactly 8 third-place teams to advance to the Round of 32.</p>
                <div className="thirds-grid">
                    {allThirds.map((standing, idx) => {
                        const team = initialTeams.find(t => t.id === standing.teamId);
                        const isSelected = localSelection.includes(standing.teamId);
                        const isTop8 = idx < 8; // Automatically calculate if they technically earned it

                        return (
                            <div
                                key={standing.teamId}
                                className={`third-card ${isSelected ? 'selected' : ''} ${!isSelected && localSelection.length >= 8 ? 'disabled' : ''}`}
                                onClick={() => toggleTeam(standing.teamId)}
                            >
                                <div className="third-card-header">
                                    <span className="third-rank">#{idx + 1}</span>
                                    <span className="third-name">{team?.name} (Gr. {team?.group})</span>
                                </div>
                                <div className="third-stats">
                                    PTS: {standing.points} | GD: {standing.goalDifference} | GF: {standing.goalsFor}
                                </div>
                                {isTop8 && <div className="third-badge">Top 8 Merit</div>}
                            </div>
                        );
                    })}
                </div>

                <div className="modal-actions">
                    <span className="selection-count">Selected: {localSelection.length} / 8</span>
                    <button className="btn-secondary" onClick={handleAutoSelectBest}>
                        Auto-Pick the 8 Best
                    </button>
                    <button
                        className="btn-primary"
                        disabled={localSelection.length !== 8}
                        onClick={handleSubmit}
                    >
                        Confirm & Generate Bracket
                    </button>
                    <button className="btn-cancel" onClick={() => { setThirdsModalDismissed(true); setActiveTab('GROUP'); }}>
                        Go Back to Edit Matches
                    </button>
                </div>
            </div>
        </div>
    );
};
