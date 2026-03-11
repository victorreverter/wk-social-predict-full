import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import type { Match } from '../../types';
import './SummaryView.css';

const getTeamName = (teamId: string) => {
    return initialTeams.find(t => t.id === teamId)?.name || teamId;
};

const getTeam = (teamId: string) => {
    return initialTeams.find(t => t.id === teamId);
};

const getGroupPosition = (teamId: string, groupMatches: Record<string, Match>) => {
    const team = initialTeams.find(t => t.id === teamId);
    if (!team) return '';
    const standings = calculateGroupStandings(team.group, initialTeams, groupMatches);
    const index = standings.findIndex(s => s.teamId === teamId);
    const pos = index === 0 ? '1st' : index === 1 ? '2nd' : '3rd';
    return `${pos} Group ${team.group}`;
};

const getTeamsInStage = (stagePrefix: string, count: number, matches: Record<string, Match>) => {
    const teams: string[] = [];
    for (let i = 1; i <= count; i++) {
        const match = matches[`k_${stagePrefix}_${i}`];
        if (match) {
            if (match.homeTeamId !== 'TBD') teams.push(match.homeTeamId);
            if (match.awayTeamId !== 'TBD') teams.push(match.awayTeamId);
        }
    }
    return teams;
};

const getMatchWinner = (match?: Match): string => {
    if (!match || match.status !== 'FINISHED') return '';
    if (match.result === 'HOME_WIN') return match.homeTeamId;
    if (match.result === 'AWAY_WIN') return match.awayTeamId;

    if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
        if (match.score.homeGoals > match.score.awayGoals) return match.homeTeamId;
        if (match.score.homeGoals < match.score.awayGoals) return match.awayTeamId;
        if (match.score.homePenalties !== null && match.score.homePenalties !== undefined && match.score.awayPenalties !== null && match.score.awayPenalties !== undefined) {
            if (match.score.homePenalties > match.score.awayPenalties) return match.homeTeamId;
            if (match.score.homePenalties < match.score.awayPenalties) return match.awayTeamId;
        }
    }
    return '';
};

const getMatchLoser = (match?: Match): string => {
    if (!match || match.status !== 'FINISHED') return '';
    if (match.result === 'HOME_WIN') return match.awayTeamId;
    if (match.result === 'AWAY_WIN') return match.homeTeamId;

    if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
        if (match.score.homeGoals > match.score.awayGoals) return match.awayTeamId;
        if (match.score.homeGoals < match.score.awayGoals) return match.homeTeamId;
        if (match.score.homePenalties !== null && match.score.homePenalties !== undefined && match.score.awayPenalties !== null && match.score.awayPenalties !== undefined) {
            if (match.score.homePenalties > match.score.awayPenalties) return match.awayTeamId;
            if (match.score.homePenalties < match.score.awayPenalties) return match.homeTeamId;
        }
    }
    return '';
};

// Formation rows for the 1-4-2-3-1 layout
const XI_ROWS = [
    { row: 'st', positions: ['ST'] },
    { row: 'am', positions: ['LAM', 'CAM', 'RAM'] },
    { row: 'dm', positions: ['LDM', 'RDM'] },
    { row: 'def', positions: ['LB', 'LCB', 'RCB', 'RB'] },
    { row: 'gk', positions: ['GK'] },
];

export const SummaryView: React.FC = () => {
    const { state } = useApp();
    const { groupMatches, knockoutMatches, awards, tournamentXI } = state;

    // Progression
    const classified32 = getTeamsInStage('R32', 16, knockoutMatches);
    const roundOf16 = getTeamsInStage('R16', 8, knockoutMatches);
    const quarterFinals = getTeamsInStage('QF', 4, knockoutMatches);
    const semiFinals = getTeamsInStage('SF', 2, knockoutMatches);
    const finals = getTeamsInStage('F', 1, knockoutMatches);
    const champion = getMatchWinner(knockoutMatches['k_F_1']);
    const secondPlaceWinner = getMatchLoser(knockoutMatches['k_F_1']);
    const thirdPlaceWinner = getMatchWinner(knockoutMatches['k_3RD_1']);

    return (
        <div className="summary-view fade-in">
            <header className="summary-header glass-panel">
                <h2 className="text-gradient">Your 2026 World Cup Summary</h2>
                <p>The final readout of your predictions across the entire tournament.</p>
            </header>

            <div className="summary-section glass-panel">
                <h3>👑 Tournament Champion</h3>
                <div className="champion-card">
                    <span className="champion-icon">🏆</span>
                    <div className="champion-team-wrap">
                        {getTeam(champion) && (
                            <img src={`${import.meta.env.BASE_URL}flags/${getTeam(champion)?.code}.svg`} className="champion-flag" alt="" />
                        )}
                        <h2>{getTeamName(champion)}</h2>
                    </div>
                </div>

                {secondPlaceWinner && (
                    <div className="silver-card">
                        <span className="silver-icon">🥈</span>
                        <div className="silver-team-wrap">
                            {getTeam(secondPlaceWinner) && (
                                <img src={`${import.meta.env.BASE_URL}flags/${getTeam(secondPlaceWinner)?.code}.svg`} className="silver-flag" alt="" />
                            )}
                            <h3>{getTeamName(secondPlaceWinner)}</h3>
                        </div>
                    </div>
                )}

                {thirdPlaceWinner && (
                    <div className="bronze-card">
                        <span className="bronze-icon">🥉</span>
                        <div className="bronze-team-wrap">
                            {getTeam(thirdPlaceWinner) && (
                                <img src={`${import.meta.env.BASE_URL}flags/${getTeam(thirdPlaceWinner)?.code}.svg`} className="bronze-flag" alt="" />
                            )}
                            <h3>{getTeamName(thirdPlaceWinner)}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="summary-grid">
                <div className="summary-col">
                    <div className="summary-section glass-panel">
                        <h3>Knockout Progression</h3>

                        <div className="progression-tier">
                            <h4>Finalists</h4>
                            <div className="team-list list-2">
                                {finals.map(id => (
                                    <div key={id} className="summary-team">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span>{getTeamName(id)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="progression-tier">
                            <h4>Semi-Finalists</h4>
                            <div className="team-list list-4">
                                {semiFinals.map(id => (
                                    <div key={id} className="summary-team">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span>{getTeamName(id)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="progression-tier">
                            <h4>Quarter-Finalists</h4>
                            <div className="team-list list-8">
                                {quarterFinals.map(id => (
                                    <div key={id} className="summary-team">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span>{getTeamName(id)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="progression-tier">
                            <h4>Round of 16</h4>
                            <div className="team-list list-16">
                                {roundOf16.map(id => (
                                    <div key={id} className="summary-team">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span>{getTeamName(id)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="summary-section glass-panel">
                        <h3>Tournament Awards</h3>
                        <ul className="awards-summary-list">
                            <li><span>🏆 MVP:</span> <strong>{awards.goldenBall}</strong></li>
                            <li><span>⚽ Top Scorer:</span> <strong>{awards.goldenBoot}</strong></li>
                            <li><span>🧤 Best Goalkeeper:</span> <strong>{awards.goldenGlove}</strong></li>
                            <li><span>⭐ Young Player:</span> <strong>{awards.fifaYoungPlayer}</strong></li>
                            <li><span>🤝 Fair Play Team:</span> <strong>{awards.fifaFairPlay}</strong></li>
                            <li><span>🥈 Silver Ball:</span> <strong>{awards.silverBall}</strong></li>
                            <li><span>🥉 Bronze Ball:</span> <strong>{awards.bronzeBall}</strong></li>
                            <li><span>👟 Silver Boot:</span> <strong>{awards.silverBoot}</strong></li>
                            <li><span>👞 Bronze Boot:</span> <strong>{awards.bronzeBoot}</strong></li>
                            <li><span>🟨 Most Yellow Cards:</span> <strong>{awards.mostYellowCards}</strong></li>
                            <li><span>🟥 Most Red Cards:</span> <strong>{awards.mostRedCards}</strong></li>
                        </ul>
                    </div>
                </div>

                <div className="summary-col">
                    <div className="summary-section glass-panel">
                        <h3>The 32 Classified Teams</h3>
                        <p className="section-desc">Teams that advanced from the Group Stage.</p>
                        <ul className="classified-list">
                            {classified32.map(id => (
                                <li key={id} className={`classified-team ${roundOf16.includes(id) ? 'advanced' : ''}`}>
                                    <span className="team-pos">{getGroupPosition(id, groupMatches)}</span>
                                    <div className="classified-team-info">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span className="team-name">{getTeamName(id)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* ── Team of the Tournament ── */}
            <div className="summary-section xi-summary-section glass-panel">
                <h3>⚽ Your Team of the Tournament</h3>
                <p className="section-desc">Your 1-4-2-3-1 selection for the best XI of the tournament.</p>

                <div className="xi-summary-field-wrap">
                    {/* SVG pitch (background + lines) */}
                    <svg
                        className="xi-summary-field-svg"
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
                    </svg>

                    {/* Players layout */}
                    <div className="xi-summary-players">
                        {XI_ROWS.map(({ row, positions }) => (
                            <div key={row} className={`xi-summary-row xi-row-${row}`}>
                                {positions.map(pos => (
                                    <div key={pos} className="xi-summary-slot">
                                        <div className="xi-summary-shirt">
                                            <div className="xi-shirt-icon" />
                                            <span className="xi-pos-badge">{pos}</span>
                                        </div>
                                        <span className="xi-player-label">
                                            {tournamentXI[pos] || '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
