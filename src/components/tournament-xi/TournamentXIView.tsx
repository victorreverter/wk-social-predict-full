import React from 'react';
import { useApp } from '../../context/AppContext';
import './TournamentXIView.css';

export const TournamentXIView: React.FC = () => {
    const { state, updateTournamentXI } = useApp();
    const { tournamentXI, theme } = state;

    // Define positions in a 1-4-2-3-1 layout
    const positionGroups = [
        { row: 'ST', positions: ['ST'] },
        { row: 'AM', positions: ['LAM', 'CAM', 'RAM'] },
        { row: 'DM', positions: ['LDM', 'RDM'] },
        { row: 'DEF', positions: ['LB', 'LCB', 'RCB', 'RB'] },
        { row: 'GK', positions: ['GK'] }
    ];

    const getPositionLabel = (pos: string) => {
        return pos;
    };

    const handleNameChange = (pos: string, value: string) => {
        updateTournamentXI(pos, value);
    };

    return (
        <div className="tournament-xi-container fade-in">
            <div className="xi-header">
                <h2>Team of the Tournament</h2>
                <p>Select your ultimate 11 in a 1-4-2-3-1 formation</p>
            </div>

            <div className={`soccer-field ${theme}`}>
                {/* SVG Field Lines — scales perfectly with parent */}
                <svg
                    className="field-lines-svg"
                    viewBox="0 0 400 500"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Outer border */}
                    <rect x="2" y="2" width="396" height="496" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="3" rx="8" />

                    {/* Halfway line */}
                    <line x1="2" y1="250" x2="398" y2="250" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />

                    {/* Center circle */}
                    <circle cx="200" cy="250" r="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    {/* Center spot */}
                    <circle cx="200" cy="250" r="4" fill="rgba(255,255,255,0.8)" />

                    {/* Top penalty area */}
                    <rect x="90" y="2" width="220" height="90" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    {/* Top 6-yard box */}
                    <rect x="145" y="2" width="110" height="35" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    {/* Top penalty spot */}
                    <circle cx="200" cy="72" r="3" fill="rgba(255,255,255,0.8)" />
                    {/* Top penalty arc (outside box) */}
                    <path d="M 155 92 A 55 55 0 0 0 245 92" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />

                    {/* Bottom penalty area */}
                    <rect x="90" y="408" width="220" height="90" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    {/* Bottom 6-yard box */}
                    <rect x="145" y="463" width="110" height="35" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                    {/* Bottom penalty spot */}
                    <circle cx="200" cy="428" r="3" fill="rgba(255,255,255,0.8)" />
                    {/* Bottom penalty arc (outside box going down) */}
                    <path d="M 155 408 A 55 55 0 0 1 245 408" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />

                    {/* Corner arcs */}
                    <path d="M 2 22 A 20 20 0 0 1 22 2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 378 2 A 20 20 0 0 1 398 22" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 2 478 A 20 20 0 0 0 22 498" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                    <path d="M 378 498 A 20 20 0 0 0 398 478" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                </svg>

                <div className="players-layout">
                    {positionGroups.map((group) => (
                        <div key={group.row} className={`position-row row-${group.row.toLowerCase()}`}>
                            {group.positions.map((pos) => (
                                <div key={pos} className="player-slot">
                                    <div className="player-shirt">
                                        <div className="shirt-icon"></div>
                                        <span className="position-badge">{getPositionLabel(pos)}</span>
                                    </div>
                                    <input
                                        type="text"
                                        className="player-input"
                                        placeholder="Player Name"
                                        value={tournamentXI[pos] || ''}
                                        onChange={(e) => handleNameChange(pos, e.target.value)}
                                        maxLength={20}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
