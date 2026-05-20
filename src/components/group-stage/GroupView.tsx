import React, { useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { groups, initialTeams } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import { MatchCard } from '../shared/MatchCard';
import { GroupStandings } from './GroupStandings';
import './GroupView.css';

export const GroupView: React.FC = () => {
    const { state, setMode, resetUserPredictions, autoFillGroups, setThirdsModalDismissed } = useApp();
    const { isLocked, isEaseModeEnabled } = useAuth();
    const { groupMatches, mode } = state;
    const { addToast } = useToast();
    const [activeGroup, setActiveGroup] = React.useState<string>(groups[0]);

    const handleReset = useCallback(async () => {
        try {
            await resetUserPredictions();
            addToast('✅ All your predictions, points, and progress have been reset. Start fresh!', 'success');
        } catch (error: any) {
            console.error('Reset failed:', error);
            addToast(error?.message || 'Reset failed.', 'error');
        }
    }, [resetUserPredictions, addToast]);

    useEffect(() => {
        if (!isEaseModeEnabled && mode === 'EASY') {
            setMode('HARD');
        }
    }, [isEaseModeEnabled, mode, setMode]);

    const totalGroupMatches = Object.keys(groupMatches).length;
    const completedGroupMatches = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;
    const isGroupsFinished = totalGroupMatches === 72 && completedGroupMatches === 72;

    const standings = calculateGroupStandings(activeGroup, initialTeams, groupMatches);
    const groupMatchList = Object.values(groupMatches).filter(m => m.group === activeGroup);

    return (
        <div className="group-view-container">
            <div className="group-selector-ribbon">
                {groups.map((group) => (
                    <button
                        key={group}
                        className={`group-tab-btn ${activeGroup === group ? 'active' : ''}`}
                        onClick={() => setActiveGroup(group)}
                    >
                        {group}
                    </button>
                ))}
            </div>

            <div className="group-actions-toolbar glass-panel">
                {isEaseModeEnabled && (
                    <div className="mode-switcher">
                        <button
                            className={`mode-btn ${mode === 'EASY' ? 'active' : ''}`}
                            onClick={() => setMode('EASY')}
                        >
                            Easy Mode
                        </button>
                        <button
                            className={`mode-btn ${mode === 'HARD' ? 'active' : ''}`}
                            onClick={() => setMode('HARD')}
                        >
                            Hard Mode
                        </button>
                    </div>
                )}

                {!isLocked && (
                    <div className="auto-fill-tooltip-wrapper">
                        <button
                            className="auto-fill-btn"
                            onClick={autoFillGroups}
                            aria-describedby="autofill-tooltip"
                        >
                            Auto-Fill Groups
                        </button>
                        <span
                            className="auto-fill-tooltip"
                            id="autofill-tooltip"
                            role="tooltip"
                        >
                            Fills all groups with <strong>completely random</strong> scores — no football logic or knowledge involved!
                        </span>
                    </div>
                )}

                {!isLocked && (
                    <button className="reset-btn" onClick={handleReset}>
                        Reset
                    </button>
                )}

                {isGroupsFinished && !isLocked && (
                    <button
                        className="select-thirds-btn"
                        onClick={() => setThirdsModalDismissed(false)}
                    >
                        Select 3rds
                    </button>
                )}
            </div>

            <div key={activeGroup} className="group-section">
                <div className="group-grid">

                    <div className="group-table-wrapper">
                        <GroupStandings group={activeGroup} standings={standings} />
                    </div>

                    <div className="group-matches-wrapper">
                        <h4 className="matches-title">Matches</h4>
                        <div className="matches-list">
                            {/* Partition matches into 3 fixtures (Matchdays) of 2 games each */}
                            {[0, 1, 2].map(fixtureIndex => {
                                const fixtureMatches = groupMatchList.slice(fixtureIndex * 2, fixtureIndex * 2 + 2);

                                return (
                                    <div key={`fixture-${fixtureIndex + 1}`} className="fixture-group">
                                        <h5 className="fixture-title">Fixture {fixtureIndex + 1}</h5>
                                        {fixtureMatches.map(match => {
                                            const homeTeam = initialTeams.find(t => t.id === match.homeTeamId);
                                            const awayTeam = initialTeams.find(t => t.id === match.awayTeamId);

                                            if (!homeTeam || !awayTeam) return null;

                                            return (
                                                <MatchCard
                                                    key={match.id}
                                                    match={match}
                                                    homeTeam={homeTeam}
                                                    awayTeam={awayTeam}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
