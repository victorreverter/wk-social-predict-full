import React from 'react';
import type { GroupStanding } from '../../types';
import { initialTeams } from '../../utils/data-init';
import './GroupStandings.css';

interface Props {
    group: string;
    standings: GroupStanding[];
}

export const GroupStandings: React.FC<Props> = ({ group, standings }) => {
    return (
        <div className="group-standings glass-panel">
            <div className="group-header">
                <h3>Group {group}</h3>
            </div>

            <table className="standings-table">
                <thead>
                    <tr>
                        <th className="pos-col">#</th>
                        <th className="team-col">Team</th>
                        <th title="Played">P</th>
                        <th title="Won">W</th>
                        <th title="Drawn">D</th>
                        <th title="Lost">L</th>
                        <th title="Goals For">GF</th>
                        <th title="Goals Against">GA</th>
                        <th title="Goal Difference">GD</th>
                        <th title="Points" className="pts-col">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((standing, index) => {
                        const teamInfo = initialTeams.find(t => t.id === standing.teamId);
                        const isTopTwo = index < 2;
                        const isThird = index === 2;

                        return (
                            <tr
                                key={standing.teamId}
                                className={`
                  ${isTopTwo ? 'qualified' : ''} 
                  ${isThird ? 'possible-qualifier' : ''}
                `}
                            >
                                <td className="pos-col">{index + 1}</td>
                                <td className="team-col font-semibold">{teamInfo?.name || standing.teamId}</td>
                                <td>{standing.played}</td>
                                <td>{standing.won}</td>
                                <td>{standing.drawn}</td>
                                <td>{standing.lost}</td>
                                <td>{standing.goalsFor}</td>
                                <td>{standing.goalsAgainst}</td>
                                <td>{standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}</td>
                                <td className="pts-col">{standing.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
