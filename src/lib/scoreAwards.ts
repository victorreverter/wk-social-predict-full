import { supabase } from './supabase';
import { normalizeForMatch } from './normalizeText';

interface PredAwardRow {
    id: string;
    user_id: string;
    category: string;
    value: string;
    pts_earned: number;
}

/**
 * Scores all user award predictions based on official_awards.
 */
export const scoreAwards = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    // 1. Load official awards
    const { data: official, error: offErr } = await supabase
        .from('official_awards')
        .select('category, value');

    if (offErr) return { usersScored: 0, error: offErr.message };
    if (!official?.length) return { usersScored: 0, error: 'No official awards saved yet.' };

    const officialMap: Record<string, string> = {};
    official.forEach(r => {
        officialMap[r.category] = normalizeForMatch(r.value || '');
    });

    // 2. Load all user predictions
    let query = supabase.from('user_predictions_awards').select('id, user_id, category, value, pts_earned');
    if (userId) query = query.eq('user_id', userId);

    const { data: preds, error: predErr } = await query;

    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // 3. Load scoring rules
    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const rulePts: Record<string, number> = {};
    rules?.forEach(r => { rulePts[r.rule_key] = r.pts; });

    const ptsMajor = rulePts['award_major'] || 10;
    const ptsMinor = rulePts['award_minor'] || 5;

    const MAJOR_CATS = ['goldenBall', 'silverBall', 'bronzeBall', 'goldenBoot', 'silverBoot', 'bronzeBoot', 'goldenGlove'];

    // 4. Calculate points
    const updates = (preds as PredAwardRow[]).map(pred => {
        const officialNorm = officialMap[pred.category];
        const userNorm = normalizeForMatch(pred.value || '');

        let pts = 0;
        if (officialNorm && userNorm && officialNorm === userNorm) {
            pts = MAJOR_CATS.includes(pred.category) ? ptsMajor : ptsMinor;
        }

        return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
    });

    // 5. Persist via RPC (SECURITY DEFINER - bypasses RLS, scores ALL users)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'bulk_update_prediction_points',
        { p_table_name: 'user_predictions_awards', p_updates: updates }
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
