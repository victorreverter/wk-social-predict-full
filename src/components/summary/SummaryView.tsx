import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import type { Match } from '../../types';
import './SummaryView.css';

const getTeamName = (teamId: string) => {
    return initialTeams.find(t => t.id === teamId)?.name || teamId;
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

export const SummaryView: React.FC = () => {
    const { state } = useApp();
    const { groupMatches, knockoutMatches, awards } = state;

    // Progression
    const classified32 = getTeamsInStage('R32', 16, knockoutMatches);
    const roundOf16 = getTeamsInStage('R16', 8, knockoutMatches);
    const quarterFinals = getTeamsInStage('QF', 4, knockoutMatches);
    const semiFinals = getTeamsInStage('SF', 2, knockoutMatches);
    const finals = getTeamsInStage('F', 1, knockoutMatches);
    const champion = getMatchWinner(knockoutMatches['k_F_1']);

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
                    <h2>{getTeamName(champion)}</h2>
                </div>
            </div>

            <div className="summary-grid">
                <div className="summary-col">
                    <div className="summary-section glass-panel">
                        <h3>Knockout Progression</h3>

                        <div className="progression-tier">
                            <h4>Finalists</h4>
                            <div className="team-list list-2">
                                {finals.map(id => <div key={id} className="summary-team">{getTeamName(id)}</div>)}
                            </div>
                        </div>

                        <div className="progression-tier">
                            <h4>Semi-Finalists</h4>
                            <div className="team-list list-4">
                                {semiFinals.map(id => <div key={id} className="summary-team">{getTeamName(id)}</div>)}
                            </div>
                        </div>

                        <div className="progression-tier">
                            <h4>Quarter-Finalists</h4>
                            <div className="team-list list-8">
                                {quarterFinals.map(id => <div key={id} className="summary-team">{getTeamName(id)}</div>)}
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
                                    <span className="team-name">{getTeamName(id)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
