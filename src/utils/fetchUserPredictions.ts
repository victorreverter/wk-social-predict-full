import { supabase } from '../lib/supabase';
import { generateInitialGroupMatches, getDefaultGroupPositions } from './data-init';
import { generateInitialKnockoutMatches, R32_FIXTURES, matchIdFromNum, determineQualifiedTeams } from './bracket-logic';
import type { Match, MatchScore, AwardsState, CustomGroupPositions } from '../types';

export interface UserPredictionData {
    groupMatches: Record<string, Match>;
    knockoutMatches: Record<string, Match>;
    awards: AwardsState;
    tournamentXI: Record<string, string>;
    customGroupPositions: CustomGroupPositions;
    selectedThirds: string[];
    koGamePredictions: Record<string, MatchScore>;
}

export async function fetchUserPredictions(userId: string): Promise<UserPredictionData> {
    const [matchesRes, koRes, awardsRes, xiRes, groupPosRes, koStructRes, thirdsRes, koGamesRes] = await Promise.all([
        supabase.from('user_predictions_matches').select('*').eq('user_id', userId),
        supabase.from('user_predictions_knockout').select('*').eq('user_id', userId),
        supabase.from('user_predictions_awards').select('*').eq('user_id', userId),
        supabase.from('user_predictions_xi').select('*').eq('user_id', userId),
        supabase.from('user_group_positions').select('*').eq('user_id', userId),
        supabase.from('user_predictions_knockout_structure').select('*').eq('user_id', userId),
        supabase.from('user_selected_thirds').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_predictions_ko_games').select('*').eq('user_id', userId),
    ]);

    const buildMatchObj = (m: any, existingMatch: any) => {
        const hasScore = m.pred_home_goals !== null && m.pred_away_goals !== null;
        return {
            ...existingMatch,
            score: hasScore ? {
                homeGoals: m.pred_home_goals,
                awayGoals: m.pred_away_goals,
                homePenalties: m.pred_home_pens,
                awayPenalties: m.pred_away_pens,
            } : existingMatch.score,
            result: hasScore
                ? (m.pred_home_goals > m.pred_away_goals ? 'HOME_WIN' : (m.pred_home_goals < m.pred_away_goals ? 'AWAY_WIN' : 'DRAW'))
                : (existingMatch.result || null),
            status: hasScore ? 'FINISHED' : (existingMatch.status || 'NOT_PLAYED')
        };
    };

    const loadedGroups = { ...generateInitialGroupMatches() };
    const loadedKo = { ...generateInitialKnockoutMatches() };

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
                    result: row.pred_result
                        || (hasScore
                            ? (row.pred_home_goals > row.pred_away_goals ? 'HOME_WIN'
                                : row.pred_home_goals < row.pred_away_goals ? 'AWAY_WIN'
                                : 'DRAW')
                            : undefined),
                };
            }
        });
        Object.assign(loadedKo, baseKo);
    }

    if (matchesRes.data) {
        matchesRes.data.forEach((m: any) => {
            const id = m.match_id;
            if (loadedGroups[id]) {
                loadedGroups[id] = buildMatchObj(m, loadedGroups[id]);
            } else if (loadedKo[id]) {
                loadedKo[id] = buildMatchObj(m, loadedKo[id]);
            }
        });
    }

    const loadedAwards: AwardsState = {
        goldenBall: '', silverBall: '', bronzeBall: '',
        goldenBoot: '', silverBoot: '', bronzeBoot: '',
        goldenGlove: '', fifaYoungPlayer: '',
        mostYellowCards: '', mostRedCards: '', fifaFairPlay: ''
    };
    if (awardsRes.data) {
        awardsRes.data.forEach((a: any) => {
            if (a.category in loadedAwards) {
                (loadedAwards as any)[a.category] = a.value;
            }
        });
    }

    const loadedXI: Record<string, string> = {
        GK: '', FP1: '', FP2: '', FP3: '', FP4: '',
        FP5: '', FP6: '', FP7: '', FP8: '', FP9: '', FP10: ''
    };
    if (xiRes.data) {
        xiRes.data.forEach((x: any) => {
            if (x.position in loadedXI) {
                loadedXI[x.position] = x.player_name;
            }
        });
    }

    const loadedPositions = { ...getDefaultGroupPositions() };
    if (groupPosRes.data) {
        groupPosRes.data.forEach((p: any) => {
            if (p.group_letter && Array.isArray(p.order) && p.order.length === 4) {
                loadedPositions[p.group_letter] = p.order;
            }
        });
    }

    const loadedKOGamePredictions: Record<string, MatchScore> = {};
    if (koGamesRes.data) {
        koGamesRes.data.forEach((row: any) => {
            loadedKOGamePredictions[row.match_id] = {
                homeGoals: row.pred_home_goals,
                awayGoals: row.pred_away_goals,
                homePenalties: row.pred_home_pens,
                awayPenalties: row.pred_away_pens,
            };
        });
    }

    let loadedSelectedThirds: string[] = [];
    if (thirdsRes.data && Array.isArray((thirdsRes.data as any).team_ids)) {
        loadedSelectedThirds = [...(thirdsRes.data as any).team_ids];
    }

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
        const r32Teams = (koRes.data || []).filter((k: any) => k.round === 'R32').map((k: any) => k.team_id);
        loadedSelectedThirds = r32Teams.filter((teamId: string) => thirdPlaceIds.has(teamId));
    }

    return {
        groupMatches: loadedGroups,
        knockoutMatches: loadedKo,
        awards: loadedAwards,
        tournamentXI: loadedXI,
        customGroupPositions: loadedPositions,
        selectedThirds: loadedSelectedThirds,
        koGamePredictions: loadedKOGamePredictions,
    };
}
