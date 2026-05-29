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

            <table className="standings-table standings-table--compact">
                <thead>
                    <tr>
                        <th className="pos-col">#</th>
                        <th className="team-col">Team</th>
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
                                <td className="team-col font-semibold">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={`${import.meta.env.BASE_URL}flags/${teamInfo?.code || 'PO-A'}.svg`} className="team-flag" alt="" />
                                        <span>{teamInfo?.name || standing.teamId}</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
