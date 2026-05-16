import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { initialTeams, groups, generateInitialGroupMatches } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import { generateInitialKnockoutMatches, updateKnockoutBracket, determineQualifiedTeams } from '../../utils/bracket-logic';
import type { Match, MatchStatus } from '../../types';

const getTeamName = (teamId: string) => initialTeams.find(t => t.id === teamId)?.name || teamId;
const getTeam = (teamId: string) => initialTeams.find(t => t.id === teamId);

interface KoPrediction {
  id: number;
  round: string;
  team_id: string;
  pts_earned: number;
}

interface AwardPrediction {
  category: string;
  value: string;
  pts_earned: number;
}

interface XIPrediction {
  position: string;
  player_name: string;
  pts_earned: number;
}

interface MatchPrediction {
  match_id: string;
  pred_home_goals: number | null;
  pred_away_goals: number | null;
  pred_home_pens: number | null;
  pred_away_pens: number | null;
  pts_earned: number;
}

interface UserPredictions {
  ko: KoPrediction[];
  awards: AwardPrediction[];
  xi: XIPrediction[];
  matches: MatchPrediction[];
  totalPts: number;
}

interface Props {
  userId: string;
  username: string;
  avatarUrl: string | null;
  onClose: () => void;
}

const AWARD_LABELS: Record<string, string> = {
  goldenBall: 'MVP', silverBall: 'Silver Ball', bronzeBall: 'Bronze Ball',
  goldenBoot: 'Top Scorer', silverBoot: 'Silver Boot', bronzeBoot: 'Bronze Boot',
  goldenGlove: 'Best GK', fifaYoungPlayer: 'Young Player',
  mostYellowCards: 'Yellow Cards', mostRedCards: 'Red Cards', fifaFairPlay: 'Fair Play',
};

const XI_POSITIONS: Record<string, string> = {
  GK: 'GK', FP1: 'FWD', FP2: 'FWD',
  FP3: 'MID', FP4: 'MID', FP5: 'MID', FP6: 'MID',
  FP7: 'DEF', FP8: 'DEF', FP9: 'DEF', FP10: 'DEF',
};

const SORTED_XI_KEYS = ['GK', 'FP7', 'FP8', 'FP9', 'FP10', 'FP3', 'FP4', 'FP5', 'FP6', 'FP1', 'FP2'];

const MATCH_STAGE_MAP: Record<string, string> = {};
for (let i = 1; i <= 72; i++) MATCH_STAGE_MAP[`m${i}`] = 'GROUP';
for (let i = 73; i <= 88; i++) MATCH_STAGE_MAP[`m${i}`] = 'R32';
for (let i = 89; i <= 96; i++) MATCH_STAGE_MAP[`m${i}`] = 'R16';
for (let i = 97; i <= 100; i++) MATCH_STAGE_MAP[`m${i}`] = 'QF';
for (let i = 101; i <= 102; i++) MATCH_STAGE_MAP[`m${i}`] = 'SF';
MATCH_STAGE_MAP['m103'] = '3RD';
MATCH_STAGE_MAP['m104'] = 'F';

const KO_BRACKET_ORDER = ['R32', 'R16', 'QF', 'SF', '3RD', 'F'] as const;

const KO_BRACKET_LABELS: Record<string, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-Finals',
  SF: 'Semi-Finals',
  '3RD': '🥉 Third Place Match',
  F: '🏆 Final',
};

export const UserPredictionsModal: React.FC<Props> = ({ userId, username, avatarUrl, onClose }) => {
  const [predictions, setPredictions] = useState<UserPredictions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchPredictions = async () => {
      setLoading(true);
      setError('');
      try {
        const [koRes, awardsRes, xiRes, matchesRes] = await Promise.all([
          supabase.from('user_predictions_knockout').select('id, round, team_id, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_awards').select('category, value, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_xi').select('position, player_name, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_matches').select('match_id, pred_home_goals, pred_away_goals, pred_home_pens, pred_away_pens, pts_earned').eq('user_id', userId),
        ]);

        if (cancelled) return;
        if (koRes.error) throw koRes.error;
        if (awardsRes.error) throw awardsRes.error;
        if (xiRes.error) throw xiRes.error;
        if (matchesRes.error) throw matchesRes.error;

        const ko = (koRes.data || []) as KoPrediction[];
        const awards = (awardsRes.data || []) as AwardPrediction[];
        const xi = (xiRes.data || []) as XIPrediction[];
        const matches = (matchesRes.data || []) as MatchPrediction[];

        const totalPts = [...ko, ...awards, ...xi, ...matches]
          .reduce((sum, p) => sum + (p.pts_earned || 0), 0);

        setPredictions({ ko, awards, xi, matches, totalPts });
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load predictions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPredictions();
    return () => { cancelled = true; };
  }, [userId]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const stats = useMemo(() => {
    if (!predictions) return null;
    const pd = predictions;

    const initialMatches = generateInitialGroupMatches();

    const predictedMatches: Record<string, Match> = {};
    pd.matches.forEach(mp => {
      if (MATCH_STAGE_MAP[mp.match_id] !== 'GROUP') return;
      const fixture = initialMatches[mp.match_id];
      if (!fixture) return;
      predictedMatches[mp.match_id] = {
        ...fixture,
        status: ((mp.pred_home_goals !== null && mp.pred_away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED') as MatchStatus,
        score: { homeGoals: mp.pred_home_goals, awayGoals: mp.pred_away_goals },
      };
    });
    const groupStandings = groups.map(group => ({
      group,
      standings: calculateGroupStandings(group, initialTeams, predictedMatches),
    }));

    const { groupWinners, groupRunnersUp, best8Thirds, allThirds } = determineQualifiedTeams(predictedMatches);
    const advancingTeamIds = new Set([
      ...Object.values(groupWinners).map(s => s.teamId),
      ...Object.values(groupRunnersUp).map(s => s.teamId),
      ...best8Thirds.map(s => s.teamId),
    ]);

    const allGroupsDone = Object.keys(predictedMatches).length === 72;

    const thirdPlaceIds = new Set(allThirds.map(t => t.teamId));
    const r32KoTeams = pd.ko.filter(k => k.round === 'R32').map(k => k.team_id);
    const selectedThirds = r32KoTeams.filter(tid => thirdPlaceIds.has(tid));

    const baseKnockout = generateInitialKnockoutMatches();
    pd.matches.forEach(mp => {
      const stage = MATCH_STAGE_MAP[mp.match_id];
      if (stage === 'GROUP' || !baseKnockout[mp.match_id]) return;
      const hasScore = mp.pred_home_goals !== null && mp.pred_away_goals !== null;
      baseKnockout[mp.match_id] = {
        ...baseKnockout[mp.match_id],
        status: (hasScore ? 'FINISHED' : 'NOT_PLAYED') as MatchStatus,
        score: {
          homeGoals: mp.pred_home_goals,
          awayGoals: mp.pred_away_goals,
          homePenalties: mp.pred_home_pens,
          awayPenalties: mp.pred_away_pens,
        },
      };
    });

    let bracket: Record<string, Match> = {};
    const knockoutMatchesByRound: Record<string, { matchId: string; homeTeamId: string; awayTeamId: string; scoreDisp: string; winner: 'home' | 'away' | 'tbd' }[]> = {};

    KO_BRACKET_ORDER.forEach(stage => { knockoutMatchesByRound[stage] = []; });

    try {
      bracket = updateKnockoutBracket(baseKnockout, predictedMatches, selectedThirds, !allGroupsDone);
    } catch (_) {}

    pd.matches.forEach(mp => {
      const stage = MATCH_STAGE_MAP[mp.match_id];
      if (stage === 'GROUP' || !KO_BRACKET_ORDER.includes(stage as any)) return;
      const bm = bracket[mp.match_id];
      const homeTeamId = bm?.homeTeamId || 'TBD';
      const awayTeamId = bm?.awayTeamId || 'TBD';

      let scoreDisp = '—';
      if (mp.pred_home_goals !== null && mp.pred_away_goals !== null) {
        scoreDisp = `${mp.pred_home_goals}-${mp.pred_away_goals}`;
        if (mp.pred_home_goals === mp.pred_away_goals && mp.pred_home_pens !== null && mp.pred_away_pens !== null) {
          scoreDisp += ` (${mp.pred_home_pens}-${mp.pred_away_pens} pens)`;
        }
      }

      let winner: 'home' | 'away' | 'tbd' = 'tbd';
      if (mp.pred_home_goals !== null && mp.pred_away_goals !== null) {
        if (mp.pred_home_goals > mp.pred_away_goals) winner = 'home';
        else if (mp.pred_away_goals > mp.pred_home_goals) winner = 'away';
        else if (mp.pred_home_pens !== null && mp.pred_away_pens !== null) {
          if (mp.pred_home_pens > mp.pred_away_pens) winner = 'home';
          else if (mp.pred_away_pens > mp.pred_home_pens) winner = 'away';
        }
      }

      knockoutMatchesByRound[stage]!.push({
        matchId: mp.match_id, homeTeamId, awayTeamId, scoreDisp, winner,
      });
    });

    KO_BRACKET_ORDER.forEach(stage => {
      if (knockoutMatchesByRound[stage]) knockoutMatchesByRound[stage]!.sort((a, b) => a.matchId.localeCompare(b.matchId));
    });

    const allMatchPts = pd.matches.reduce((s, m) => s + (m.pts_earned || 0), 0);
    const koPts = pd.ko.reduce((s, k) => s + (k.pts_earned || 0), 0);
    const awardsPts = pd.awards.reduce((s, a) => s + (a.pts_earned || 0), 0);
    const xiPts = pd.xi.reduce((s, x) => s + (x.pts_earned || 0), 0);

    const groupMatchPts = pd.matches.filter(m => MATCH_STAGE_MAP[m.match_id] === 'GROUP').reduce((s, m) => s + (m.pts_earned || 0), 0);
    const groupExact = pd.matches.filter(m => MATCH_STAGE_MAP[m.match_id] === 'GROUP' && m.pts_earned >= 3).length;
    const groupCorrect = pd.matches.filter(m => MATCH_STAGE_MAP[m.match_id] === 'GROUP' && m.pts_earned >= 1 && m.pts_earned < 3).length;

    const koR16 = pd.ko.filter(k => k.round === 'R16' && k.pts_earned > 0).length;
    const koQF = pd.ko.filter(k => k.round === 'QF' && k.pts_earned > 0).length;
    const koSF = pd.ko.filter(k => k.round === 'SF' && k.pts_earned > 0).length;
    const koF = pd.ko.filter(k => k.round === 'F' && k.pts_earned > 0).length;

    const awardsHit = pd.awards.filter(a => a.pts_earned > 0).length;
    const xiHit = pd.xi.filter(x => x.pts_earned > 0).length;

    const getKoWinner = (match: Match | undefined): string => {
      if (!match || match.status !== 'FINISHED') return '';
      if (match.score.homeGoals !== null && match.score.awayGoals !== null) {
        if (match.score.homeGoals > match.score.awayGoals) return match.homeTeamId;
        if (match.score.awayGoals > match.score.homeGoals) return match.awayTeamId;
        const hp = match.score.homePenalties ?? null;
        const ap = match.score.awayPenalties ?? null;
        if (hp !== null && ap !== null) {
          if (hp > ap) return match.homeTeamId;
          if (ap > hp) return match.awayTeamId;
        }
      }
      return '';
    };

    const getKoLoser = (match: Match | undefined): string => {
      if (!match) return '';
      const w = getKoWinner(match);
      if (!w) return '';
      return w === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    };

    const championId = getKoWinner(bracket['m104']);
    const runnerUpId = getKoLoser(bracket['m104']);
    const bronzeId = getKoWinner(bracket['m103']);

    const championPick = championId
      ? (pd.ko.find(k => k.round === 'CHAMPION' && k.team_id === championId) || { id: 0, round: 'CHAMPION', team_id: championId, pts_earned: 0 })
      : undefined;

    const runnerUpPick = runnerUpId
      ? (pd.ko.find(k => k.round === 'F' && k.team_id === runnerUpId) || { id: 0, round: 'F', team_id: runnerUpId, pts_earned: 0 })
      : undefined;

    const bronzePick = bronzeId
      ? (pd.ko.find(k => k.round === '3RD' && k.team_id === bronzeId) || { id: 0, round: '3RD', team_id: bronzeId, pts_earned: 0 })
      : null;

    return {
      allMatchPts, groupMatchPts, koPts, awardsPts, xiPts,
      groupExact, groupCorrect,
      koR16, koQF, koSF, koF,
      awardsHit, xiHit,
      championPick, runnerUpPick, bronzePick,
      groupStandings,
      advancingTeamIds,
      knockoutMatchesByRound,
    };
  }, [predictions]);

  if (loading) {
    return (
      <div className="user-preds-overlay" onClick={handleOverlayClick}>
        <div className="user-preds-modal glass-panel">
          <button className="user-preds-close" onClick={onClose} aria-label="Close">&times;</button>
          <div className="user-preds-loader">
            <span className="spinner">⏳</span>
            <p>Loading {username}'s predictions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-preds-overlay" onClick={handleOverlayClick}>
        <div className="user-preds-modal glass-panel">
          <button className="user-preds-close" onClick={onClose} aria-label="Close">&times;</button>
          <div className="user-preds-error">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!predictions) return null;
  if (!stats) return null;

  const pd = predictions;

  return (
    <div className="user-preds-overlay" onClick={handleOverlayClick}>
      <div className="user-preds-modal glass-panel">
        <button className="user-preds-close" onClick={onClose} aria-label="Close">&times;</button>

        <div className="user-preds-header">
          {avatarUrl && <img src={avatarUrl} alt="" className="user-preds-avatar" />}
          <div>
            <h2 className="text-gradient">{username}'s Predictions</h2>
            <span className="user-preds-total">{pd.totalPts} pts total</span>
          </div>
        </div>

        <div className="user-preds-points-grid">
          <div className="points-card">
            <span className="points-card-icon">📊</span>
            <span className="points-card-val">{stats.allMatchPts}</span>
            <span className="points-card-label">Matches</span>
            <span className="points-card-sub">{stats.groupExact} exact · {stats.groupCorrect} correct</span>
          </div>
          <div className="points-card">
            <span className="points-card-icon">🏆</span>
            <span className="points-card-val">{stats.koPts}</span>
            <span className="points-card-label">Bracket</span>
            <span className="points-card-sub">R16×{stats.koR16} QF×{stats.koQF} SF×{stats.koSF} F×{stats.koF}</span>
          </div>
          <div className="points-card">
            <span className="points-card-icon">🎖️</span>
            <span className="points-card-val">{stats.awardsPts}</span>
            <span className="points-card-label">Awards</span>
            <span className="points-card-sub">{stats.awardsHit} correct</span>
          </div>
          <div className="points-card">
            <span className="points-card-icon">👕</span>
            <span className="points-card-val">{stats.xiPts}</span>
            <span className="points-card-label">XI</span>
            <span className="points-card-sub">{stats.xiHit} correct</span>
          </div>
        </div>

        <div className="user-preds-body">
          {/* ── Podium ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">🏆 Tournament Podium</h3>
            <div className="bracket-podium">
              {stats.championPick ? (
                <div className="bp-item bp-champ">
                  <span>🏆</span>
                  {getTeam(stats.championPick.team_id) && (
                    <img src={`${import.meta.env.BASE_URL}flags/${getTeam(stats.championPick.team_id)?.code}.svg`} className="bp-flag" alt="" />
                  )}
                  <span className="bp-name">{getTeamName(stats.championPick.team_id)}</span>
                  <span className="bp-pts">{stats.championPick.pts_earned} pts</span>
                </div>
              ) : null}
              {stats.runnerUpPick ? (
                <div className="bp-item bp-runner">
                  <span>🥈</span>
                  {getTeam(stats.runnerUpPick.team_id) && (
                    <img src={`${import.meta.env.BASE_URL}flags/${getTeam(stats.runnerUpPick.team_id)?.code}.svg`} className="bp-flag" alt="" />
                  )}
                  <span className="bp-name">{getTeamName(stats.runnerUpPick.team_id)}</span>
                  <span className="bp-pts">{stats.runnerUpPick.pts_earned} pts</span>
                </div>
              ) : null}
              {stats.bronzePick ? (
                <div className="bp-item bp-bronze">
                  <span>🥉</span>
                  {getTeam(stats.bronzePick.team_id) && (
                    <img src={`${import.meta.env.BASE_URL}flags/${getTeam(stats.bronzePick.team_id)?.code}.svg`} className="bp-flag" alt="" />
                  )}
                  <span className="bp-name">{getTeamName(stats.bronzePick.team_id)}</span>
                  <span className="bp-pts">{stats.bronzePick.pts_earned} pts</span>
                </div>
              ) : (
                <div className="bp-item bp-bronze">
                  <span>🥉</span>
                  <span className="bp-name">TBD</span>
                </div>
              )}
              {!stats.championPick && !stats.runnerUpPick && (
                <span className="flat-empty">No podium predictions made.</span>
              )}
            </div>
          </div>

          {/* ── Group Stage ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">📊 Group Stage — Predicted Standings</h3>
            <div className="group-standings-grid">
              {stats.groupStandings.map(({ group, standings }) => (
                <div key={group} className="group-standings-block">
                  <div className="group-standings-title">Group {group}</div>
                  <table className="group-standings-table">
                    <tbody>
                      {standings.map((s, i) => {
                        const team = initialTeams.find(t => t.id === s.teamId);
                        return (
                          <tr key={s.teamId} className={stats.advancingTeamIds.has(s.teamId) ? 'gs-qualified' : ''}>
                            <td className="gs-pos">{i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : '4'}</td>
                            <td className="gs-team">
                              {team && <img src={`${import.meta.env.BASE_URL}flags/${team.code}.svg`} className="gs-flag" alt="" />}
                              <span>{team?.name || s.teamId}</span>
                            </td>
                            <td className="gs-pts">{s.points} pts</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bracket Match-by-Match ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">🏟️ Bracket — Match Results</h3>
            {KO_BRACKET_ORDER.map(stage => {
              const matches = stats.knockoutMatchesByRound[stage];
              if (!matches || matches.length === 0) return null;
              return (
                <div key={stage} className="bracket-round-section">
                  <div className="ko-round-label">{KO_BRACKET_LABELS[stage] || stage}</div>
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
            {Object.values(stats.knockoutMatchesByRound).every(arr => arr.length === 0) && (
              <span className="flat-empty">No bracket predictions made.</span>
            )}
          </div>

          {/* ── Awards ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">🎖️ Awards</h3>
            <div className="awards-list">
              {pd.awards.map(a => (
                <div key={a.category} className="award-row">
                  <span className="award-cat">{AWARD_LABELS[a.category] || a.category}</span>
                  <span className="award-val">{a.value || '—'}</span>
                  <span className={`award-pts ${a.pts_earned > 0 ? 'pts-correct' : ''}`}>
                    {a.pts_earned > 0 ? `+${a.pts_earned}` : '0'}
                  </span>
                </div>
              ))}
              {pd.awards.length === 0 && <span className="flat-empty">No award predictions made.</span>}
            </div>
          </div>

          {/* ── Tournament XI ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">👕 Tournament XI</h3>
            <div className="xi-list">
              {SORTED_XI_KEYS.map(pos => {
                const entry = pd.xi.find(x => x.position === pos);
                return (
                  <div key={pos} className="xi-row">
                    <span className="xi-pos-badge">{XI_POSITIONS[pos] || pos}</span>
                    <span className="xi-player">{entry?.player_name || '—'}</span>
                    <span className={`xi-pts ${(entry?.pts_earned ?? 0) > 0 ? 'pts-correct' : ''}`}>
                      {(entry?.pts_earned ?? 0) > 0 ? `+${entry?.pts_earned}` : '0'}
                    </span>
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
