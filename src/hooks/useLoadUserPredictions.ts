import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { determineQualifiedTeams, generateInitialKnockoutMatches, R32_FIXTURES, matchIdFromNum } from '../utils/bracket-logic';

export const useLoadUserPredictions = () => {
    const { session } = useAuth();
    const { state, loadFullState } = useApp();
    const lastLoadedUserId = useRef<string | null>(null);

    useEffect(() => {
        if (!session?.user) return;
        if (lastLoadedUserId.current === session.user.id) return;

        const loadPredictions = async () => {
            try {
                const [matchesRes, koRes, awardsRes, xiRes, groupPosRes, koStructRes, thirdsRes] = await Promise.all([
                    supabase.from('user_predictions_matches').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_knockout').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_awards').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_xi').select('*').eq('user_id', session.user.id),
                    supabase.from('user_group_positions').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_knockout_structure').select('*').eq('user_id', session.user.id),
                    supabase.from('user_selected_thirds').select('*').eq('user_id', session.user.id).maybeSingle(),
                ]);

                if (matchesRes.error || koRes.error || awardsRes.error || xiRes.error || groupPosRes.error) {
                    const msg = [matchesRes.error?.message, koRes.error?.message, awardsRes.error?.message, xiRes.error?.message, groupPosRes.error?.message]
                        .filter(Boolean).join('; ');
                    if (import.meta.env.DEV) console.error('Load predictions failed:', msg);
                    return;
                }

                if (koStructRes.error && import.meta.env.DEV) {
                    console.warn('Knockout structure load skipped:', koStructRes.error.message);
                }

                if (matchesRes.data.length === 0 && awardsRes.data.length === 0 && xiRes.data.length === 0 && groupPosRes.data?.length === 0 && (koStructRes.data?.length || 0) === 0) {
                    return;
                }

                const buildMatchObj = (m: any, existingMatch: any) => ({
                    ...existingMatch,
                    score: {
                        homeGoals: m.pred_home_goals,
                        awayGoals: m.pred_away_goals,
                        homePenalties: m.pred_home_pens,
                        awayPenalties: m.pred_away_pens,
                    },
                    result: (m.pred_home_goals !== null && m.pred_away_goals !== null) 
                        ? (m.pred_home_goals > m.pred_away_goals ? 'HOME_WIN' : (m.pred_home_goals < m.pred_away_goals ? 'AWAY_WIN' : 'DRAW')) 
                        : null,
                    status: (m.pred_home_goals !== null && m.pred_away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED'
                });

                const loadedGroups = { ...state.groupMatches };
                const loadedKo = { ...state.knockoutMatches };

                // Restore full knockout bracket structure from DB if available
                const koStructData = koStructRes.data as any[] | null;
                if (koStructData && koStructData.length > 0) {
                    const baseKo = generateInitialKnockoutMatches();
                    koStructData.forEach((row: any) => {
                        const id = row.match_id;
                        if (baseKo[id]) {
                            const hasScore = row.pred_home_goals !== null && row.pred_away_goals !== null;
                            baseKo[id] = {
                                ...baseKo[id],
                                homeTeamId: row.pred_home_team_id || 'TBD',
                                awayTeamId: row.pred_away_team_id || 'TBD',
                                score: {
                                    homeGoals: row.pred_home_goals,
                                    awayGoals: row.pred_away_goals,
                                    homePenalties: row.pred_home_pens,
                                    awayPenalties: row.pred_away_pens,
                                },
                                status: row.pred_status || (hasScore ? 'FINISHED' : 'NOT_PLAYED'),
                                result: hasScore
                                    ? (row.pred_home_goals > row.pred_away_goals ? 'HOME_WIN'
                                        : row.pred_home_goals < row.pred_away_goals ? 'AWAY_WIN'
                                        : 'DRAW')
                                    : undefined,
                            };
                        }
                    });
                    Object.assign(loadedKo, baseKo);
                }

                // Also overlay match predictions (scores) on top of loaded structure
                // (for backwards compatibility or additional data)
                matchesRes.data.forEach((m: any) => {
                    const id = m.match_id;
                    if (loadedGroups[id]) {
                        loadedGroups[id] = buildMatchObj(m, loadedGroups[id]);
                    } else if (loadedKo[id]) {
                        loadedKo[id] = buildMatchObj(m, loadedKo[id]);
                    }
                });

                const loadedAwards = { ...state.awards };
                awardsRes.data.forEach((a: any) => {
                    if (a.category in loadedAwards) {
                        (loadedAwards as any)[a.category] = a.value;
                    }
                });

                const loadedXI = { ...state.tournamentXI };
                xiRes.data.forEach((x: any) => {
                    if (x.position in loadedXI) {
                        (loadedXI as any)[x.position] = x.player_name;
                    }
                });

                const loadedPositions = { ...state.customGroupPositions };
                groupPosRes.data?.forEach((p: any) => {
                    if (p.group_letter && Array.isArray(p.order) && p.order.length === 4) {
                        loadedPositions[p.group_letter] = p.order;
                    }
                });

                // ── Rehydrate selectedThirds ──
                // 1. Primary source: user_selected_thirds table (explicitly persisted)
                let loadedSelectedThirds: string[] = [];
                if (thirdsRes.data && Array.isArray((thirdsRes.data as any).team_ids)) {
                    loadedSelectedThirds = [...(thirdsRes.data as any).team_ids];
                }

                // 2. Fallback: extract from the saved R32 bracket
                if (loadedSelectedThirds.length !== 8) {
                    const t3Teams = new Set<string>();
                    R32_FIXTURES.forEach(f => {
                        const match = loadedKo[matchIdFromNum(f.matchNum)];
                        if (match) {
                            if (f.homeSlot === 'T3' && match.homeTeamId !== 'TBD') t3Teams.add(match.homeTeamId);
                            if (f.awaySlot === 'T3' && match.awayTeamId !== 'TBD') t3Teams.add(match.awayTeamId);
                        }
                    });
                    loadedSelectedThirds = [...t3Teams];
                }

                // 3. Last-resort fallback: match-based + position-based inference
                if (loadedSelectedThirds.length !== 8) {
                    const { allThirds } = determineQualifiedTeams(loadedGroups);
                    const matchBasedThirdIds = new Set(allThirds.map(t => t.teamId));
                    const positionBasedThirdIds = new Set<string>();
                    Object.values(loadedPositions).forEach(order => {
                        if (order && order.length >= 3) {
                            positionBasedThirdIds.add(order[2]);
                        }
                    });
                    const thirdPlaceIds = new Set([...matchBasedThirdIds, ...positionBasedThirdIds]);
                    const r32Teams = koRes.data.filter((k: any) => k.round === 'R32').map((k: any) => k.team_id);
                    loadedSelectedThirds = r32Teams.filter((teamId: string) => thirdPlaceIds.has(teamId));
                }

                loadFullState({
                    groupMatches: loadedGroups,
                    knockoutMatches: loadedKo,
                    awards: loadedAwards,
                    tournamentXI: loadedXI,
                    selectedThirds: loadedSelectedThirds.length > 0 ? loadedSelectedThirds : state.selectedThirds,
                    customGroupPositions: loadedPositions
                });
                
            } catch (err) {
                if (import.meta.env.DEV) console.error('Load predictions error:', err);
            }
        };

        const loadAndMark = () => {
            loadPredictions();
            lastLoadedUserId.current = session.user.id;
        };
        setTimeout(loadAndMark, 500);

        const onReset = () => { lastLoadedUserId.current = null; };
        window.addEventListener('predictions-reset', onReset);
        return () => {
            window.removeEventListener('predictions-reset', onReset);
        };
    }, [session?.user?.id]);
};
