import { supabase } from './supabase';
import { initialTeams, generateInitialGroupMatches } from '../utils/data-init';
import { calculateGroupStandings } from '../utils/standings';

export const scoreGroupPositions = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
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

    const groupMatchesMap = generateInitialGroupMatches();
    const matchesByGroup: Record<string, string[]> = {};
    Object.entries(groupMatchesMap).forEach(([matchId, match]) => {
        if (!matchesByGroup[match.group!]) matchesByGroup[match.group!] = [];
        matchesByGroup[match.group!].push(matchId);
    });

    const officialMatchStatus: Record<string, string> = {};
    (matchCheck || []).forEach(m => { officialMatchStatus[m.match_id] = m.status; });

    const finishedGroups = new Set<string>();
    Object.entries(matchesByGroup).forEach(([group, matchIds]) => {
        const allFinished = matchIds.every(id => officialMatchStatus[id] === 'FINISHED');
        if (allFinished) finishedGroups.add(group);
    });

    if (finishedGroups.size === 0) return { usersScored: 0 };

    const { data: officialPosData, error: offPosErr } = await supabase
        .from('official_group_positions')
        .select('group_letter, "order"');

    const adminPositions: Record<string, string[]> = {};
    if (!offPosErr && officialPosData) {
        officialPosData.forEach(r => { adminPositions[r.group_letter] = r.order; });
    }

    const { data: officialMatches, error: offErr } = await supabase
        .from('official_matches')
        .select('match_id, home_goals, away_goals, status');

    if (offErr) return { usersScored: 0, error: offErr.message };

    const groupMatchScores = generateInitialGroupMatches();
    (officialMatches || []).forEach(om => {
        if (groupMatchScores[om.match_id] && om.status === 'FINISHED' && om.home_goals !== null && om.away_goals !== null) {
            groupMatchScores[om.match_id] = {
                ...groupMatchScores[om.match_id],
                score: { homeGoals: om.home_goals, awayGoals: om.away_goals },
                status: 'FINISHED',
            };
        }
    });

    const officialPositions: Record<string, string[]> = {};
    finishedGroups.forEach(group => {
        if (adminPositions[group]) {
            officialPositions[group] = adminPositions[group];
        } else {
            const standings = calculateGroupStandings(group, initialTeams, groupMatchScores);
            const orderedIds = standings.map(s => s.teamId);
            officialPositions[group] = orderedIds;
        }
    });

    let query = supabase.from('user_group_positions').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: preds, error: predErr } = await query;
    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;
    const ptsCorrectPosition = getPts('group_position_correct', 2);

    const updates: { user_id: string; group_letter: string; pts_earned: number }[] = [];
    preds.forEach((p: any) => {
        if (!finishedGroups.has(p.group_letter)) return;
        const official = officialPositions[p.group_letter];
        if (!official || !p.order) return;

        let pts = 0;
        p.order.forEach((teamId: string, idx: number) => {
            if (official[idx] === teamId) pts += ptsCorrectPosition;
        });

        updates.push({ user_id: p.user_id, group_letter: p.group_letter, pts_earned: pts });
    });

    if (updates.length === 0) return { usersScored: 0 };

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
