/**
 * Tournament XI Scoring Engine
 * Option A: auto-triggered when master saves the official XI.
 *
 * Logic:
 *  - GK slot: compare user's GK against official GK → 5 pts
 *  - Field players: for each user slot that is NOT GK,
 *    check if the name appears anywhere in the official 10 FPs → 3 pts
 *
 * Name matching is accent-insensitive and case-insensitive.
 */

import { supabase } from './supabase';
import { normalizeForMatch } from './normalizeText';

interface PredXIRow {
    id: string;
    user_id: string;
    position: string;
    player_name: string;
    pts_earned: number;
}

export const scoreXI = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    // ── 1. Load official XI ──────────────────────────────────
    const { data: official, error: offErr } = await supabase
        .from('official_tournament_xi')
        .select('position, player_name');

    if (offErr) return { usersScored: 0, error: offErr.message };
    if (!official?.length) return { usersScored: 0, error: 'No official XI saved yet.' };

    const normGK = official.find(r => r.position === 'GK')
        ? normalizeForMatch(official.find(r => r.position === 'GK')!.player_name)
        : null;
    const normFPs = official
        .filter(r => r.position !== 'GK')
        .map(r => normalizeForMatch(r.player_name));

    // ── 2. Load all user XI predictions ─────────────────────
    let query = supabase.from('user_predictions_xi').select('id, user_id, position, player_name, pts_earned');
    if (userId) query = query.eq('user_id', userId);
    const { data: preds, error: predErr } = await query;

    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // ── 2B. Load Scoring Rules ───────────────────────────────
    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;
    const gkPoints = getPts('xi_goalkeeper', 5);
    const fpPoints = getPts('xi_field_player', 3);

    // ── 3. Calculate new pts per row ─────────────────────────
    const updates = (preds as PredXIRow[]).map(pred => {
        const normName = normalizeForMatch(pred.player_name || '');
        let pts = 0;
        if (pred.position === 'GK') {
            if (normGK && normName === normGK) pts = gkPoints;
        } else {
            if (normFPs.includes(normName)) pts = fpPoints;
        }
        return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
    });

    // ── 4. Persist via RPC (SECURITY DEFINER - bypasses RLS, scores ALL users) ──
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'bulk_update_prediction_points',
        { p_table_name: 'user_predictions_xi', p_updates: updates }
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
