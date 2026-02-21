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

    return (
        <div className="group-view-container">
            {groups.map((group) => {
                const standings = calculateGroupStandings(group, initialTeams, groupMatches);
                const groupMatchList = Object.values(groupMatches).filter(m => m.group === group);

                return (
                    <div key={group} className="group-section">
                        <div className="group-grid">

                            <div className="group-table-wrapper">
                                <GroupStandings group={group} standings={standings} />
                            </div>

                            <div className="group-matches-wrapper">
                                <h4 className="matches-title">Matches</h4>
                                <div className="matches-list">
                                    {groupMatchList.map(match => {
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
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
