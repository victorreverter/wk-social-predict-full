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
                <div className="field-lines">
                    <div className="center-circle"></div>
                    <div className="halfway-line"></div>
                    <div className="penalty-area top">
                        <div className="six-yard-box"></div>
                        <div className="penalty-spot"></div>
                        <div className="penalty-arc"></div>
                    </div>
                    <div className="penalty-area bottom">
                        <div className="six-yard-box"></div>
                        <div className="penalty-spot"></div>
                        <div className="penalty-arc"></div>
                    </div>
                </div>

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
