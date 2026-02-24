import React from 'react';
import { useApp } from '../../context/AppContext';
import { groups, initialTeams } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import { MatchCard } from '../shared/MatchCard';
import { GroupStandings } from './GroupStandings';
import './GroupView.css';

export const GroupView: React.FC = () => {
    const { state } = useApp();
    const { groupMatches } = state;
    const [activeGroup, setActiveGroup] = React.useState<string>(groups[0]);

    // Determine what to display based on the selected tab
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
