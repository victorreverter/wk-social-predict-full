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
 * Then recalculates profiles.total_points as sum of all prediction tables.
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

const sum = (rows: { pts_earned: number }[] | null): number =>
    (rows ?? []).reduce((s, r) => s + (r.pts_earned || 0), 0);

export const scoreXI = async (): Promise<{ usersScored: number; error?: string }> => {
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
    const { data: preds, error: predErr } = await supabase
        .from('user_predictions_xi')
        .select('id, user_id, position, player_name, pts_earned');

    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // ── 3. Calculate new pts per row ─────────────────────────
    const updates = (preds as PredXIRow[]).map(pred => {
        const normName = normalizeForMatch(pred.player_name);
        let pts = 0;
        if (pred.position === 'GK') {
            if (normGK && normName === normGK) pts = 5;
        } else {
            if (normFPs.includes(normName)) pts = 3;
        }
        return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
    });

    // ── 4. Persist pts_earned (parallel batch) ───────────────
    await Promise.all(
        updates.map(u =>
            supabase
                .from('user_predictions_xi')
                .update({ pts_earned: u.pts_earned })
                .eq('id', u.id)
        )
    );

    // ── 5. Recalculate profiles.total_points for each user ───
    const uniqueUserIds = [...new Set(updates.map(r => r.user_id))];

    await Promise.all(
        uniqueUserIds.map(async uid => {
            const [matchRes, awardRes, koRes, xiRes] = await Promise.all([
                supabase.from('user_predictions_matches').select('pts_earned').eq('user_id', uid),
                supabase.from('user_predictions_awards').select('pts_earned').eq('user_id', uid),
                supabase.from('user_predictions_knockout').select('pts_earned').eq('user_id', uid),
                supabase.from('user_predictions_xi').select('pts_earned').eq('user_id', uid),
            ]);
            const total =
                sum(matchRes.data) +
                sum(awardRes.data) +
                sum(koRes.data) +
                sum(xiRes.data);
            await supabase.from('profiles').update({ total_points: total }).eq('id', uid);
        })
    );

    return { usersScored: uniqueUserIds.length };
};
