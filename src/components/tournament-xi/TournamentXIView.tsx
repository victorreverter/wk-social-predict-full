import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import './TournamentXIView.css';

type FormationConfig = {
    name: string;
    rows: {
        rowClass: string;
        slots: { dataKey: string; badge: string }[];
    }[];
};

const FORMATIONS: Record<string, FormationConfig> = {
    '4-2-3-1': {
        name: '4-2-3-1',
        rows: [
            { rowClass: 'st', slots: [{ dataKey: 'ST', badge: 'ST' }] },
            { rowClass: 'am', slots: [{ dataKey: 'LAM', badge: 'LAM' }, { dataKey: 'CAM', badge: 'CAM' }, { dataKey: 'RAM', badge: 'RAM' }] },
            { rowClass: 'dm', slots: [{ dataKey: 'LDM', badge: 'LDM' }, { dataKey: 'RDM', badge: 'RDM' }] },
            { rowClass: 'def', slots: [{ dataKey: 'LB', badge: 'LB' }, { dataKey: 'LCB', badge: 'LCB' }, { dataKey: 'RCB', badge: 'RCB' }, { dataKey: 'RB', badge: 'RB' }] },
            { rowClass: 'gk', slots: [{ dataKey: 'GK', badge: 'GK' }] },
        ]
    },
    '4-3-3': {
        name: '4-3-3',
        rows: [
            { rowClass: 'fwd', slots: [{ dataKey: 'LAM', badge: 'LW' }, { dataKey: 'ST', badge: 'ST' }, { dataKey: 'RAM', badge: 'RW' }] },
            { rowClass: 'mid', slots: [{ dataKey: 'LDM', badge: 'LCM' }, { dataKey: 'CAM', badge: 'CM' }, { dataKey: 'RDM', badge: 'RCM' }] },
            { rowClass: 'def', slots: [{ dataKey: 'LB', badge: 'LB' }, { dataKey: 'LCB', badge: 'LCB' }, { dataKey: 'RCB', badge: 'RCB' }, { dataKey: 'RB', badge: 'RB' }] },
            { rowClass: 'gk', slots: [{ dataKey: 'GK', badge: 'GK' }] },
        ]
    },
    '4-4-2': {
        name: '4-4-2',
        rows: [
            { rowClass: 'fwd-2', slots: [{ dataKey: 'CAM', badge: 'ST' }, { dataKey: 'ST', badge: 'ST' }] },
            { rowClass: 'mid', slots: [{ dataKey: 'LAM', badge: 'LM' }, { dataKey: 'LDM', badge: 'CM' }, { dataKey: 'RDM', badge: 'CM' }, { dataKey: 'RAM', badge: 'RM' }] },
            { rowClass: 'def', slots: [{ dataKey: 'LB', badge: 'LB' }, { dataKey: 'LCB', badge: 'LCB' }, { dataKey: 'RCB', badge: 'RCB' }, { dataKey: 'RB', badge: 'RB' }] },
            { rowClass: 'gk', slots: [{ dataKey: 'GK', badge: 'GK' }] },
        ]
    },
    '3-5-2': {
        name: '3-5-2',
        rows: [
            { rowClass: 'fwd-2', slots: [{ dataKey: 'ST1', badge: 'ST' }, { dataKey: 'ST2', badge: 'ST' }] },
            { rowClass: 'mid', slots: [{ dataKey: 'LM', badge: 'LM' }, { dataKey: 'LCM', badge: 'LCM' }, { dataKey: 'CAM', badge: 'CAM' }, { dataKey: 'RCM', badge: 'RCM' }, { dataKey: 'RM', badge: 'RM' }] },
            { rowClass: 'def', slots: [{ dataKey: 'LCB', badge: 'LCB' }, { dataKey: 'CB', badge: 'CB' }, { dataKey: 'RCB', badge: 'RCB' }] },
            { rowClass: 'gk', slots: [{ dataKey: 'GK', badge: 'GK' }] },
        ]
    }
};

export const TournamentXIView: React.FC = () => {
    const { state, updateTournamentXI } = useApp();
    const { tournamentXI, theme } = state;
    const { isLocked, user } = useAuth();

    const [selectedFormation, setSelectedFormation] = useState<string>('4-2-3-1');

    const activeFormation = FORMATIONS[selectedFormation];


    return (
        <div className="tournament-xi-container fade-in">
            <div className="xi-header">
                <h2>Team of the Tournament</h2>
                <p>Select your ultimate 11 in a {selectedFormation} formation</p>
                <p className="xi-hint">💡 Name matching is flexible! "Mbappé" or "mbappe" both work.</p>
            </div>


            <div className="formation-selector">
                {Object.keys(FORMATIONS).map(fmt => (
                    <button
                        key={fmt}
                        className={`formation-btn ${selectedFormation === fmt ? 'active' : ''}`}
                        onClick={() => setSelectedFormation(fmt)}
                    >
                        {fmt}
                    </button>
                ))}
            </div>

            <div className={`soccer-field ${theme}`}>
                {/* SVG Field Lines */}
                <svg
                    className="field-lines-svg"
                    viewBox="0 0 400 500"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <rect x="2" y="2" width="396" height="496" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="3" rx="8" />
                    <line x1="2" y1="250" x2="398" y2="250" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <circle cx="200" cy="250" r="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <circle cx="200" cy="250" r="4" fill="rgba(255,255,255,0.8)" />
                    <rect x="90" y="2" width="220" height="90" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <rect x="145" y="2" width="110" height="35" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <circle cx="200" cy="72" r="3" fill="rgba(255,255,255,0.8)" />
                    <path d="M 155 92 A 55 55 0 0 0 245 92" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <rect x="90" y="408" width="220" height="90" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <rect x="145" y="463" width="110" height="35" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <circle cx="200" cy="428" r="3" fill="rgba(255,255,255,0.8)" />
                    <path d="M 155 408 A 55 55 0 0 1 245 408" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    <path d="M 2 22 A 20 20 0 0 1 22 2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 378 2 A 20 20 0 0 1 398 22" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 2 478 A 20 20 0 0 0 22 498" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 378 498 A 20 20 0 0 0 398 478" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                </svg>

                <div className="players-layout">
                    {activeFormation.rows.map((group, rowIndex) => (
                        <div key={`${group.rowClass}-${rowIndex}`} className={`position-row row-${group.rowClass}`}>
                            {group.slots.map(({ dataKey, badge }, slotIndex) => (
                                <div key={`${dataKey}-${slotIndex}`} className="player-slot">
                                    <div className="player-shirt">
                                        <div className="shirt-icon"></div>
                                        <span className="position-badge">{badge}</span>
                                    </div>
                                    <input
                                        type="text"
                                        className="player-input"
                                        placeholder="Player Name"
                                        value={tournamentXI[dataKey] || ''}
                                        onChange={(e) => updateTournamentXI(dataKey, e.target.value)}
                                        maxLength={20}
                                        disabled={isLocked}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Save footer ──────────────────────────────── */}
            <div className="xi-save-footer">
                {!user ? (
                    <p className="xi-login-prompt">🔒 Sign in to save your predictions</p>
                ) : isLocked ? (
                    <p className="xi-locked-msg">🔒 Predictions are locked — the tournament has started</p>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Save your XI (along with all other predictions) using the global <strong>Save Predictions</strong> button in the top menu.
                    </p>
                )}
            </div>
        </div>
    );
};
