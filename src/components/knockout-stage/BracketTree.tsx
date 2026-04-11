import React, { useState, useEffect } from 'react';
import type { Match } from '../../types';
import { BracketMatchNode } from './BracketMatchNode';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { initialTeams } from '../../utils/data-init';
import { exportBracketToImage } from '../../utils/export-image';
import './BracketTree.css';

// Define the column structure for a Split Bracket
const LEFT_STAGES = ['R32', 'R16', 'QF', 'SF'];
const RIGHT_STAGES = ['SF', 'QF', 'R16', 'R32']; // Mirrored order for right side

/**
 * Explicit visual ordering of matches per stage per side.
 * Derived from the official 2026 FIFA bracket tree:
 *   LEFT side feeds → SF M101 (via QF M97 + QF M98)
 *   RIGHT side feeds → SF M102 (via QF M99 + QF M100)
 *
 * Left R32 chains:
 *   Chain A (→ QF M97): M74,M77 → R16 M89; M73,M75 → R16 M90
 *   Chain B (→ QF M98): M83,M84 → R16 M93; M81,M82 → R16 M94
 * Right R32 chains:
 *   Chain C (→ QF M99): M76,M78 → R16 M91; M79,M80 → R16 M92
 *   Chain D (→ QF M100): M86,M88 → R16 M95; M85,M87 → R16 M96
 */
const BRACKET_VISUAL_ORDER: { left: Record<string, number[]>; right: Record<string, number[]> } = {
    left: {
        R32: [74, 77, 73, 75, 83, 84, 81, 82],
        R16: [89, 90, 93, 94],
        QF:  [97, 98],
        SF:  [101],
    },
    right: {
        SF:  [102],
        QF:  [99, 100],
        R16: [91, 92, 95, 96],
        R32: [76, 78, 79, 80, 86, 88, 85, 87],
    },
};

export const BracketTree: React.FC = () => {
    const { state } = useApp();
    const { profile } = useAuth();
    const [userName, setUserName] = useState('');
    const matchesList = Object.values(state.knockoutMatches);

    useEffect(() => {
        if (profile) {
            const displayName = profile.display_name || profile.username;
            if (displayName) {
                const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                setUserName(capitalizedName);
            }
        }
    }, [profile]);

    const handleExport = () => {
        exportBracketToImage(matchesList, 'my-wc2026-bracket.jpg');
    };

    // Returns matches in the correct visual order for the given stage side,
    // mapped explicitly from the official 2026 FIFA bracket tree progression.
    const getVisualMatches = (stageName: string, side: 'left' | 'right') => {
        const orderNums = BRACKET_VISUAL_ORDER[side][stageName] ?? [];
        return orderNums
            .map(num => matchesList.find(m => m.id === `m${num}`))
            .filter((m): m is Match => m !== undefined);
    };

    // Render a generic column of matches in official bracket order
    const renderStageColumn = (stageName: string, side: 'left' | 'right') => {
        const matches = getVisualMatches(stageName, side);
        const stageLabelMap: Record<string, string> = {
            R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Final', SF: 'Semi-Final'
        };
        return (
            <div key={`${side}-${stageName}`} className={`bracket-column stage-${stageName.toLowerCase()} ${side}-side`}>
                <h3 className="stage-title">{stageLabelMap[stageName] ?? stageName}</h3>
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
                <div className="bracket-user-prediction-input-container">
                    <div className="prediction-input-wrapper">
                        <input
                            type="text"
                            className="user-prediction-input"
                            placeholder="Enter Prediction Name..."
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            maxLength={40}
                            autoComplete="off"
                        />
                    </div>
                </div>

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
                                                <span className="champion-title-count">{
                                                    ['Brazil'].includes(championTeam.name) ? '6th Title' :
                                                        ['Germany', 'Italy'].includes(championTeam.name) ? '5th Title' :
                                                            ['Argentina'].includes(championTeam.name) ? '4th Title' :
                                                                ['France', 'Uruguay'].includes(championTeam.name) ? '3rd Title' :
                                                                    ['Spain', 'England'].includes(championTeam.name) ? '2nd Title' :
                                                                        '1st Title'
                                                }</span>
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
