import { supabase } from './supabase';
import { groups, initialTeams, generateInitialGroupMatches } from '../utils/data-init';
import { calculateGroupStandings } from '../utils/standings';

export const scoreGroupPositions = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    // Pre-tournament guard: count FINISHED group matches
    const { data: matchCheck, error: matchCheckErr } = await supabase
        .from('official_matches')
        .select('match_id, status');

    if (matchCheckErr) return { usersScored: 0, error: matchCheckErr.message };

    const finishedGroupCount = (matchCheck || []).filter(m => {
        const num = parseInt(m.match_id.slice(1), 10);
        return !isNaN(num) && num <= 72 && m.status === 'FINISHED';
    }).length;

    if (finishedGroupCount === 0) {
        let q = supabase.from('user_group_positions').select('user_id, group_letter, pts_earned');
        if (userId) q = q.eq('user_id', userId);
        const { data: existing } = await q;
        if (existing && existing.length > 0) {
            // Zero via RPC - user_group_positions uses (user_id, group_letter) as PK
            const zeroUpdates = existing.map((r: any) => ({
                user_id: r.user_id,
                group_letter: r.group_letter,
                pts_earned: 0
            }));
            const { data: rpcResult, error: rpcErr } = await supabase.rpc(
                'bulk_update_prediction_points',
                { p_table_name: 'user_group_positions', p_updates: zeroUpdates }
            );
            if (rpcErr) return { usersScored: 0, error: rpcErr.message };
            const result = rpcResult as any;
            return { usersScored: result?.users_scored ?? 0 };
        }
        return { usersScored: 0 };
    }

    if (finishedGroupCount < 72) return { usersScored: 0 };

    // 1. Try admin-confirmed official_group_positions first
    const { data: officialPosData, error: offPosErr } = await supabase
        .from('official_group_positions')
        .select('group_letter, "order"');

    let officialPositions: Record<string, string[]>;
    let allGroupsDone = false;

    if (!offPosErr && officialPosData && officialPosData.length === 12) {
        officialPositions = {};
        officialPosData.forEach(r => { officialPositions[r.group_letter] = r.order; });
        allGroupsDone = true;
    } else {
        // 2. Fallback: compute from official_matches
        const { data: officialMatches, error: offErr } = await supabase
            .from('official_matches')
            .select('match_id, home_goals, away_goals, status');

        if (offErr) return { usersScored: 0, error: offErr.message };

        const groupMatches = generateInitialGroupMatches();
        (officialMatches || []).forEach(om => {
            if (groupMatches[om.match_id] && om.status === 'FINISHED' && om.home_goals !== null && om.away_goals !== null) {
                groupMatches[om.match_id] = {
                    ...groupMatches[om.match_id],
                    score: { homeGoals: om.home_goals, awayGoals: om.away_goals },
                    status: 'FINISHED',
                };
            }
        });

        officialPositions = {};
        const actuallyFinished = Object.values(groupMatches).filter(m => m.status === 'FINISHED').length;
        allGroupsDone = actuallyFinished === 72;
        if (allGroupsDone) {
            groups.forEach(group => {
                const standings = calculateGroupStandings(group, initialTeams, groupMatches);
                const orderedIds = standings.map(s => s.teamId);
                officialPositions[group] = orderedIds;
            });
        }
    }

    if (!allGroupsDone) return { usersScored: 0 };

    let query = supabase.from('user_group_positions').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: preds, error: predErr } = await query;
    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;
    const ptsCorrectPosition = getPts('group_position_correct', 2);

    // user_group_positions uses (user_id, group_letter) as PK
    const updates: { user_id: string; group_letter: string; pts_earned: number }[] = [];
    preds.forEach((p: any) => {
        const official = officialPositions[p.group_letter];
        if (!official || !p.order) return;

        let pts = 0;
        p.order.forEach((teamId: string, idx: number) => {
            if (official[idx] === teamId) pts += ptsCorrectPosition;
        });

        updates.push({ user_id: p.user_id, group_letter: p.group_letter, pts_earned: pts });
    });

    if (updates.length === 0) return { usersScored: 0 };

    // 5. Persist via RPC (SECURITY DEFINER - bypasses RLS, scores ALL users)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'bulk_update_prediction_points',
        { p_table_name: 'user_group_positions', p_updates: updates }
    );

    if (rpcErr) {
        return { usersScored: 0, error: rpcErr.message };
    }

    const result = rpcResult as any;
    if (!result?.success) {
        return { usersScored: 0, error: result?.message || 'Bulk update failed.' };
    }

    return { usersScored: result?.users_scored ?? 0 };
};
