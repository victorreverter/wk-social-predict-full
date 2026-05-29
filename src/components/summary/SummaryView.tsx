import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { initialTeams } from '../../utils/data-init';
import type { Match } from '../../types';
import './SummaryView.css';

const getTeamName = (teamId: string) => {
    return initialTeams.find(t => t.id === teamId)?.name || teamId;
};

const getTeam = (teamId: string) => {
    return initialTeams.find(t => t.id === teamId);
};

const getGroupPosition = (teamId: string, customGroupPositions: Record<string, string[]>) => {
    const team = initialTeams.find(t => t.id === teamId);
    if (!team) return '';
    const order = customGroupPositions[team.group];
    if (!order) return '';
    const index = order.indexOf(teamId);
    const pos = index === 0 ? '1st' : index === 1 ? '2nd' : '3rd';
    return `${pos} Group ${team.group}`;
};

const getTeamsInStage = (stageCode: string, matches: Record<string, Match>) => {
    const teams: string[] = [];
    Object.values(matches).forEach(match => {
        if (match.stage === stageCode) {
            if (match.homeTeamId !== 'TBD') teams.push(match.homeTeamId);
            if (match.awayTeamId !== 'TBD') teams.push(match.awayTeamId);
        }
    });
    return teams;
};

const getMatchWinner = (match?: Match): string => {
    if (!match) return '';
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
    if (!match) return '';
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

const getMatchScoreDisplay = (match: Match): string => {
    if (match.score.homeGoals === null || match.score.awayGoals === null) return '—';
    let d = `${match.score.homeGoals}-${match.score.awayGoals}`;
    if (match.score.homeGoals === match.score.awayGoals && match.stage !== 'GROUP') {
        const hp = match.score.homePenalties ?? null;
        const ap = match.score.awayPenalties ?? null;
        if (hp !== null && ap !== null) d += ` (${hp}-${ap} pens)`;
    }
    return d;
};

const getMatchWinnerLabel = (match: Match): 'home' | 'away' | null => {
    if (match.result === 'HOME_WIN') return 'home';
    if (match.result === 'AWAY_WIN') return 'away';
    if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
        if (match.score.homeGoals > match.score.awayGoals) return 'home';
        if (match.score.homeGoals < match.score.awayGoals) return 'away';
        if (match.stage !== 'GROUP') {
            const hp = match.score.homePenalties ?? null;
            const ap = match.score.awayPenalties ?? null;
            if (hp !== null && ap !== null) {
                if (hp > ap) return 'home';
                if (ap > hp) return 'away';
            }
        }
    }
    return null;
};

const KO_ORDER = ['R32', 'R16', 'QF', 'SF', '3RD', 'F'] as const;

const KO_LABELS: Record<string, string> = {
    R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Finals',
    SF: 'Semi-Finals', '3RD': '🥉 Third Place Match', F: '🏆 Final',
};

export const SummaryView: React.FC = () => {
    const { state } = useApp();
    const { knockoutMatches, awards, customGroupPositions } = state;

    // Progression
    const classified32 = getTeamsInStage('R32', knockoutMatches);
    const roundOf16 = getTeamsInStage('R16', knockoutMatches);
    const champion = getMatchWinner(knockoutMatches['m104']);
    const secondPlaceWinner = getMatchLoser(knockoutMatches['m104']);
    const thirdPlaceWinner = getMatchWinner(knockoutMatches['m103']);

    const bracketByRound = useMemo(() => {
        const result: Record<string, { matchId: string; homeTeamId: string; awayTeamId: string; scoreDisp: string; winner: string | null }[]> = {};
        KO_ORDER.forEach(stage => { result[stage] = []; });
        Object.values(knockoutMatches).forEach(m => {
            if (!KO_ORDER.includes(m.stage as any)) return;
            result[m.stage]!.push({
                matchId: m.id,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                scoreDisp: getMatchScoreDisplay(m),
                winner: getMatchWinnerLabel(m),
            });
        });
        KO_ORDER.forEach(stage => {
            if (result[stage]) result[stage]!.sort((a, b) => a.matchId.localeCompare(b.matchId));
        });
        return result;
    }, [knockoutMatches]);

    return (
        <div className="summary-view fade-in">
            <header className="summary-header glass-panel">
                <h2 className="text-gradient">Your 2026 World Cup Summary</h2>
                <p>The final readout of your predictions across the entire tournament.</p>
            </header>

            <div className="summary-section glass-panel">
                <h3>👑 Tournament Podium</h3>
                <div className="champion-card">
                    <span className="champion-icon">🏆</span>
                    <div className="champion-team-wrap">
                        {getTeam(champion) && (
                            <img src={`${import.meta.env.BASE_URL}flags/${getTeam(champion)?.code}.svg`} className="champion-flag" alt="" />
                        )}
                        <h2 className="summary-full-name">{getTeamName(champion)}</h2>
                        <h2 className="summary-abbr-name">{getTeam(champion)?.code || champion}</h2>
                    </div>
                </div>

                {secondPlaceWinner && (
                    <div className="silver-card">
                        <span className="silver-icon">🥈</span>
                        <div className="silver-team-wrap">
                            {getTeam(secondPlaceWinner) && (
                                <img src={`${import.meta.env.BASE_URL}flags/${getTeam(secondPlaceWinner)?.code}.svg`} className="silver-flag" alt="" />
                            )}
                            <h3 className="summary-full-name">{getTeamName(secondPlaceWinner)}</h3>
                            <h3 className="summary-abbr-name">{getTeam(secondPlaceWinner)?.code || secondPlaceWinner}</h3>
                        </div>
                    </div>
                )}

                {thirdPlaceWinner ? (
                    <div className="bronze-card">
                        <span className="bronze-icon">🥉</span>
                        <div className="bronze-team-wrap">
                            {getTeam(thirdPlaceWinner) && (
                                <img src={`${import.meta.env.BASE_URL}flags/${getTeam(thirdPlaceWinner)?.code}.svg`} className="bronze-flag" alt="" />
                            )}
                            <h3 className="summary-full-name">{getTeamName(thirdPlaceWinner)}</h3>
                            <h3 className="summary-abbr-name">{getTeam(thirdPlaceWinner)?.code || thirdPlaceWinner}</h3>
                        </div>
                    </div>
                ) : (
                    <div className="bronze-card">
                        <span className="bronze-icon">🥉</span>
                        <div className="bronze-team-wrap">
                            <h3>TBD</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="summary-grid">
                <div className="summary-col">
                    <div className="summary-section glass-panel">
                        <h3>🏟️ Knockout — Match Results</h3>
                        {KO_ORDER.map(stage => {
                            const matches = bracketByRound[stage];
                            if (!matches || matches.length === 0) return null;
                            return (
                                <div key={stage} className="bracket-round-section">
                                    <div className="ko-round-label">{KO_LABELS[stage]}</div>
                                    {matches.map(m => {
                                        const homeTeam = getTeam(m.homeTeamId);
                                        const awayTeam = getTeam(m.awayTeamId);
                                        return (
                                            <div key={m.matchId} className="bracket-match-row">
                                                <span className={`bm-team bm-home ${m.winner === 'home' ? 'bm-winner' : ''}`}>
                                                    {homeTeam && <img src={`${import.meta.env.BASE_URL}flags/${homeTeam.code}.svg`} className="bm-flag" alt="" />}
                                                    <span>{homeTeam?.name || m.homeTeamId}</span>
                                                    {m.winner === 'home' && <span className="bm-trophy">🏆</span>}
                                                </span>
                                                <span className="bm-score">{m.scoreDisp}</span>
                                                <span className={`bm-team bm-away ${m.winner === 'away' ? 'bm-winner' : ''}`}>
                                                    {m.winner === 'away' && <span className="bm-trophy">🏆</span>}
                                                    <span>{awayTeam?.name || m.awayTeamId}</span>
                                                    {awayTeam && <img src={`${import.meta.env.BASE_URL}flags/${awayTeam.code}.svg`} className="bm-flag" alt="" />}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    <div className="summary-section glass-panel">
                        <h3>Tournament Awards</h3>
                        <ul className="awards-summary-list">
                            <li><span>🏆 MVP:</span> <strong>{awards.goldenBall}</strong></li>
                            <li><span>⚽ Top Scorer:</span> <strong>{awards.goldenBoot}</strong></li>
                            <li><span>🧤 Best Goalkeeper:</span> <strong>{awards.goldenGlove}</strong></li>
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
                                    <span className="team-pos">{getGroupPosition(id, customGroupPositions)}</span>
                                    <div className="classified-team-info">
                                        {getTeam(id) && <img src={`${import.meta.env.BASE_URL}flags/${getTeam(id)?.code}.svg`} className="summary-flag" alt="" />}
                                        <span className="team-name">{getTeamName(id)}</span>
                                        <span className="team-name-abbr">{getTeam(id)?.code || id}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
