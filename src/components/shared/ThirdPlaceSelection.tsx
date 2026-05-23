import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import { useAuth } from '../../context/AuthContext';
import './ThirdPlaceSelection.css';

const THIRDS_DISMISSED_KEY = 'wk_thirds_modal_dismissed';

export const ThirdPlaceSelection: React.FC = () => {
    const { state, setSelectedThirds, setActiveTab, setThirdsModalDismissed } = useApp();
    const { customGroupPositions, selectedThirds } = state;
    const { isLocked } = useAuth();

    const allThirdTeamIds = Object.values(customGroupPositions)
        .filter(order => order.length >= 3)
        .map(order => order[2]);

    const needsSelection = allThirdTeamIds.length === 12 && selectedThirds.length !== 8 && !isLocked;
    const isPersistedDismissed = localStorage.getItem(THIRDS_DISMISSED_KEY) === 'true';

    const [localSelection, setLocalSelection] = useState<string[]>([]);

    useEffect(() => {
        if (!needsSelection) {
            setLocalSelection([]);
        }
    }, [needsSelection]);

    useEffect(() => {
        if (isPersistedDismissed) {
            setThirdsModalDismissed(true);
        }
    }, []);

    useEffect(() => {
        if (state.activeTab === 'BRACKET' && needsSelection && state.isThirdsModalDismissed) {
            setThirdsModalDismissed(false);
            localStorage.removeItem(THIRDS_DISMISSED_KEY);
        }
    }, [state.activeTab, needsSelection]);

    if (state.activeTab !== 'BRACKET' || !needsSelection || isPersistedDismissed || state.isThirdsModalDismissed) return null;

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
            setActiveTab('BRACKET');
        }
    };

    const handleClose = () => {
        localStorage.setItem(THIRDS_DISMISSED_KEY, 'true');
        setThirdsModalDismissed(true);
        setActiveTab('GAMES');
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
                <p>Choose exactly 8 third-place teams to advance to the Round of 32.</p>
                <div className="thirds-grid">
                    {allThirdTeamIds.map((teamId) => {
                        const team = initialTeams.find(t => t.id === teamId);
                        const isSelected = localSelection.includes(teamId);

                        return (
                            <div
                                key={teamId}
                                className={`third-card ${isSelected ? 'selected' : ''} ${!isSelected && localSelection.length >= 8 ? 'disabled' : ''}`}
                                onClick={() => toggleTeam(teamId)}
                            >
                                <div className="third-card-header">
                                    <img
                                        src={`${import.meta.env.BASE_URL}flags/${team?.code || teamId}.svg`}
                                        alt={team?.code || ''}
                                        className="third-flag"
                                    />
                                    <span className="third-name">{team?.name || teamId} (Gr. {team?.group || '?'})</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="modal-actions">
                    <span className="selection-count">Selected: {localSelection.length} / 8</span>
                    <button
                        className="btn-primary"
                        disabled={localSelection.length !== 8}
                        onClick={handleSubmit}
                    >
                        Confirm &amp; Generate Bracket
                    </button>
                    <button className="btn-cancel" onClick={handleClose}>
                        Go Back to Positions
                    </button>
                </div>
            </div>
        </div>
    );
};
