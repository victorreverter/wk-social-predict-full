import { supabase } from './supabase';
import { recalculateUserPoints } from './scoreUtils';
import { groups, initialTeams, generateInitialGroupMatches } from '../utils/data-init';
import { calculateGroupStandings } from '../utils/standings';

export const scoreGroupPositions = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
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
        allGroupsDone = true;
        groups.forEach(group => {
            const standings = calculateGroupStandings(group, initialTeams, groupMatches);
            const orderedIds = standings.map(s => s.teamId);
            if (orderedIds.length >= 4) {
                officialPositions[group] = orderedIds;
            } else {
                allGroupsDone = false;
            }
        });
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

    const updates: { user_id: string; group_letter: string; pts_earned: number }[] = [];
    preds.forEach(p => {
        const official = officialPositions[p.group_letter];
        if (!official || !p.order) return;

        let pts = 0;
        p.order.forEach((teamId: string, idx: number) => {
            if (official[idx] === teamId) pts += ptsCorrectPosition;
        });

        updates.push({ user_id: p.user_id, group_letter: p.group_letter, pts_earned: pts });
    });

    if (updates.length === 0) return { usersScored: 0 };

    await Promise.all(
        updates.map(u =>
            supabase
                .from('user_group_positions')
                .update({ pts_earned: u.pts_earned })
                .eq('user_id', u.user_id)
                .eq('group_letter', u.group_letter)
        )
    );

    const uniqueUserIds = [...new Set(updates.map(r => r.user_id))];
    await Promise.all(uniqueUserIds.map(uid => recalculateUserPoints(uid)));

    return { usersScored: uniqueUserIds.length };
};
