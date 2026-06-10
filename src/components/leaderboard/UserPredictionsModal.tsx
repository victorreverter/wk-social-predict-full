import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { initialTeams, groups, generateInitialGroupMatches } from '../../utils/data-init';
import { calculateGroupStandings } from '../../utils/standings';
import { generateInitialKnockoutMatches, determineQualifiedTeams, seedBracketFromPositions, propagateKnockoutWinners } from '../../utils/bracket-logic';
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
  koStructure: any[];
  groupPositions: Record<string, string[]>;
  selectedThirds: string[];
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
  goldenGlove: 'Best Goalkeeper', fifaYoungPlayer: 'Young Player',
  mostYellowCards: 'Yellow Cards', mostRedCards: 'Red Cards', fifaFairPlay: 'Fair Play',
};

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
        const [koRes, awardsRes, xiRes, matchesRes, koStructRes, groupPosRes, thirdsRes] = await Promise.all([
          supabase.from('user_predictions_knockout').select('id, round, team_id, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_awards').select('category, value, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_xi').select('position, player_name, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_matches').select('match_id, pred_home_goals, pred_away_goals, pred_home_pens, pred_away_pens, pts_earned').eq('user_id', userId),
          supabase.from('user_predictions_knockout_structure').select('match_id, pred_home_team_id, pred_away_team_id, pred_home_goals, pred_away_goals, pred_home_pens, pred_away_pens, pred_status, pred_result').eq('user_id', userId),
          supabase.from('user_group_positions').select('group_letter, "order", pts_earned').eq('user_id', userId),
          supabase.from('user_selected_thirds').select('*').eq('user_id', userId).maybeSingle(),
        ]);

        if (cancelled) return;
        if (koRes.error) throw koRes.error;
        if (awardsRes.error) throw awardsRes.error;
        if (xiRes.error) throw xiRes.error;
        if (matchesRes.error) throw matchesRes.error;
        if (koStructRes.error) throw koStructRes.error;
        if (groupPosRes.error) throw groupPosRes.error;
        if (thirdsRes.error && thirdsRes.status !== 406) throw thirdsRes.error;

        const ko = (koRes.data || []) as KoPrediction[];
        const awards = (awardsRes.data || []) as AwardPrediction[];
        const xi = (xiRes.data || []) as XIPrediction[];
        const matches = (matchesRes.data || []) as MatchPrediction[];
        const koStructure = (koStructRes.data || []) as any[];
        const groupPositions: Record<string, string[]> = {};
        if (groupPosRes.data) {
          (groupPosRes.data as any[]).forEach((p: any) => {
            if (p.group_letter && Array.isArray(p.order) && p.order.length === 4) {
              groupPositions[p.group_letter] = p.order;
            }
          });
        }
        const savedSelectedThirds: string[] = thirdsRes.data && Array.isArray((thirdsRes.data as any).team_ids)
          ? [...(thirdsRes.data as any).team_ids]
          : [];

        const totalPts = [...ko, ...awards, ...xi, ...matches]
          .reduce((sum, p) => sum + (p.pts_earned || 0), 0);

        setPredictions({ ko, awards, xi, matches, koStructure, groupPositions, selectedThirds: savedSelectedThirds, totalPts });
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

    const hasGroupPositions = Object.keys(pd.groupPositions).length === 12
      && Object.values(pd.groupPositions).every(order => order && order.length === 4);

    const groupStandings = groups.map(group => {
      const order = pd.groupPositions[group];
      if (order && order.length === 4) {
        const standings = order.map((teamId) => ({
          teamId,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
        }));
        return { group, standings };
      }
      return {
        group,
        standings: calculateGroupStandings(group, initialTeams, predictedMatches),
      };
    });

    const { groupWinners, groupRunnersUp, best8Thirds, allThirds } = determineQualifiedTeams(predictedMatches);
    const hasGroupPositionsBracket = hasGroupPositions;
    const advancingTeamIds = hasGroupPositionsBracket
      ? new Set<string>(groups.flatMap(g => {
          const order = pd.groupPositions[g];
          return order ? [order[0], order[1], order[2]] : [];
        }))
      : new Set([
          ...Object.values(groupWinners).map(s => s.teamId),
          ...Object.values(groupRunnersUp).map(s => s.teamId),
          ...best8Thirds.map(s => s.teamId),
        ]);

    const thirdPlaceIds = new Set(allThirds.map(t => t.teamId));
    const r32KoTeams = pd.ko.filter(k => k.round === 'R32').map(k => k.team_id);
    let selectedThirds = pd.selectedThirds;
    if (selectedThirds.length !== 8) {
      selectedThirds = r32KoTeams.filter(tid => thirdPlaceIds.has(tid));
    }

    // ── 1. Seed bracket from group positions (primary source for team identities) ──
    let bracket: Record<string, Match> = {};
    const knockoutMatchesByRound: Record<string, { matchId: string; homeTeamId: string; awayTeamId: string; scoreDisp: string; winner: 'home' | 'away' | 'tbd' }[]> = {};

    KO_BRACKET_ORDER.forEach(stage => { knockoutMatchesByRound[stage] = []; });

    if (hasGroupPositions) {
      bracket = seedBracketFromPositions(generateInitialKnockoutMatches(), pd.groupPositions, selectedThirds);
    } else {
      bracket = generateInitialKnockoutMatches();
    }

    // ── 2. Overlay scores & results from structure or match predictions (NEVER team IDs) ──
    const hasStructure = pd.koStructure && pd.koStructure.length > 0;
    if (hasStructure) {
      pd.koStructure.forEach((row: any) => {
        const id = row.match_id;
        if (!bracket[id]) return;
        const hasScore = row.pred_home_goals !== null && row.pred_away_goals !== null;
        bracket[id] = {
          ...bracket[id],
          status: (row.pred_status || (hasScore ? 'FINISHED' : 'NOT_PLAYED')) as MatchStatus,
          result: row.pred_result
            || (hasScore
              ? (row.pred_home_goals > row.pred_away_goals ? 'HOME_WIN'
                  : row.pred_home_goals < row.pred_away_goals ? 'AWAY_WIN'
                  : 'DRAW')
              : undefined),
          score: {
            homeGoals: row.pred_home_goals,
            awayGoals: row.pred_away_goals,
            homePenalties: row.pred_home_pens,
            awayPenalties: row.pred_away_pens,
          },
        };
      });
    } else {
      pd.matches.forEach(mp => {
        const stage = MATCH_STAGE_MAP[mp.match_id];
        if (stage === 'GROUP' || !bracket[mp.match_id]) return;
        const hasScore = mp.pred_home_goals !== null && mp.pred_away_goals !== null;
        const hg = mp.pred_home_goals;
        const ag = mp.pred_away_goals;
        bracket[mp.match_id] = {
          ...bracket[mp.match_id],
          status: (hasScore ? 'FINISHED' : 'NOT_PLAYED') as MatchStatus,
          result: hasScore
            ? (hg! > ag! ? 'HOME_WIN'
                : hg! < ag! ? 'AWAY_WIN'
                : 'DRAW')
            : undefined,
          score: {
            homeGoals: hg,
            awayGoals: ag,
            homePenalties: mp.pred_home_pens,
            awayPenalties: mp.pred_away_pens,
          },
        };
      });
    }

    // ── 3. Propagate winners (R16 → Final) ──
    try {
      bracket = propagateKnockoutWinners(bracket);
    } catch (_) {}

    // ── 4. Overlay KO round picks onto TBD slots (structure-all-TBD fallback) ──
    const structureAllTbd = hasStructure && pd.koStructure.every(
      (row: any) => row.pred_home_team_id === 'TBD' && row.pred_away_team_id === 'TBD'
    );
    if (structureAllTbd) {
      const koPicksByRound: Record<string, string[]> = {};
      pd.ko.forEach(k => {
        if (k.round !== 'CHAMPION') {
          if (!koPicksByRound[k.round]) koPicksByRound[k.round] = [];
          koPicksByRound[k.round].push(k.team_id);
        }
      });
      KO_BRACKET_ORDER.forEach(stage => {
        const picks = koPicksByRound[stage];
        if (!picks || picks.length === 0) return;
        const matchIds = Object.keys(MATCH_STAGE_MAP).filter(mid => MATCH_STAGE_MAP[mid] === stage);
        matchIds.sort();
        let pickIdx = 0;
        for (const matchId of matchIds) {
          const m = bracket[matchId];
          if (!m) continue;
          if (m.homeTeamId === 'TBD' && pickIdx < picks.length) {
            m.homeTeamId = picks[pickIdx++];
          }
          if (m.awayTeamId === 'TBD' && pickIdx < picks.length) {
            m.awayTeamId = picks[pickIdx++];
          }
        }
      });
    }

    // ── 5. Build knockoutMatchesByRound for rendering ──
    KO_BRACKET_ORDER.forEach(stage => {
      const matchIds = Object.keys(MATCH_STAGE_MAP).filter(mid => MATCH_STAGE_MAP[mid] === stage);
      matchIds.sort();
      matchIds.forEach(matchId => {
        const bm = bracket[matchId];
        if (!bm) return;
        const homeTeamId = bm.homeTeamId || 'TBD';
        const awayTeamId = bm.awayTeamId || 'TBD';

        let winner: 'home' | 'away' | 'tbd' = 'tbd';
        if (bm.result === 'HOME_WIN') winner = 'home';
        else if (bm.result === 'AWAY_WIN') winner = 'away';
        else if (bm.score.homeGoals !== null && bm.score.awayGoals !== null) {
          if (bm.score.homeGoals > bm.score.awayGoals) winner = 'home';
          else if (bm.score.awayGoals > bm.score.homeGoals) winner = 'away';
          else if (bm.score.homePenalties != null && bm.score.awayPenalties != null) {
            if (bm.score.homePenalties > bm.score.awayPenalties) winner = 'home';
            else if (bm.score.awayPenalties > bm.score.homePenalties) winner = 'away';
          }
        }

        knockoutMatchesByRound[stage]!.push({
          matchId, homeTeamId, awayTeamId, scoreDisp: '—', winner,
        });
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
    const groupExact = pd.matches.filter(m => MATCH_STAGE_MAP[m.match_id] === 'GROUP' && m.pts_earned >= 2).length;
    const groupCorrect = pd.matches.filter(m => MATCH_STAGE_MAP[m.match_id] === 'GROUP' && m.pts_earned === 1).length;

    const koR16 = pd.ko.filter(k => k.round === 'R16' && k.pts_earned > 0).length;
    const koQF = pd.ko.filter(k => k.round === 'QF' && k.pts_earned > 0).length;
    const koSF = pd.ko.filter(k => k.round === 'SF' && k.pts_earned > 0).length;
    const koF = pd.ko.filter(k => k.round === 'F' && k.pts_earned > 0).length;

    const awardsHit = pd.awards.filter(a => a.pts_earned > 0).length;
    const xiHit = pd.xi.filter(x => x.pts_earned > 0).length;

    const getKoWinner = (match: Match | undefined): string => {
      if (!match || match.status !== 'FINISHED') return '';
      if (match.result === 'HOME_WIN') return match.homeTeamId;
      if (match.result === 'AWAY_WIN') return match.awayTeamId;
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

    const championId = getKoWinner(bracket['m104']) || pd.ko.find(k => k.round === 'CHAMPION')?.team_id || '';
    const runnerUpId = getKoLoser(bracket['m104']) || (() => {
      const fPicks = pd.ko.filter(k => k.round === 'F').map(k => k.team_id);
      if (fPicks.length >= 2) return fPicks.find(id => id !== championId) || fPicks[0];
      return fPicks[0] || '';
    })();
    const bronzeId = getKoWinner(bracket['m103']) || pd.ko.find(k => k.round === '3RD')?.team_id || '';

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
            <span className="points-card-label">Knockout</span>
            <span className="points-card-sub">R16×{stats.koR16} QF×{stats.koQF} SF×{stats.koSF} F×{stats.koF}</span>
          </div>
          <div className="points-card">
            <span className="points-card-icon">🎖️</span>
            <span className="points-card-val">{stats.awardsPts}</span>
            <span className="points-card-label">Awards</span>
            <span className="points-card-sub">{stats.awardsHit} correct</span>
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
            <h3 className="flat-section-title">🏟️ Knockout — Match Results</h3>
            {Object.values(stats.knockoutMatchesByRound).every(arr => arr.length === 0) ? (
              <span className="flat-empty">No bracket predictions made. Set group positions and select third-place teams to populate the bracket.</span>
            ) : (
              KO_BRACKET_ORDER.map(stage => {
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
              })
            )}
          </div>

          {/* ── Awards ── */}
          <div className="flat-section">
            <h3 className="flat-section-title">🎖️ Awards</h3>
            <div className="awards-list">
              {pd.awards.filter(a => ['goldenBall', 'goldenBoot', 'goldenGlove'].includes(a.category)).map(a => (
                <div key={a.category} className="award-row">
                  <span className="award-cat">{AWARD_LABELS[a.category] || a.category}</span>
                  <span className="award-val">{a.value || '—'}</span>
                  <span className={`award-pts ${a.pts_earned > 0 ? 'pts-correct' : ''}`}>
                    {a.pts_earned > 0 ? `+${a.pts_earned}` : '0'}
                  </span>
                </div>
              ))}
              {pd.awards.filter(a => ['goldenBall', 'goldenBoot', 'goldenGlove'].includes(a.category)).length === 0 && <span className="flat-empty">No award predictions made.</span>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
