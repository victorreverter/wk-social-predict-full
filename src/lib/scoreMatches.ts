import { supabase } from './supabase';

interface OfficialMatchRow {
    match_id: string;
    home_goals: number | null;
    away_goals: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
    went_to_pens: boolean;
    status: string;
}

interface PredMatchRow {
    id: string;
    user_id: string;
    match_id: string;
    pred_home_goals: number | null;
    pred_away_goals: number | null;
    pred_home_pens: number | null;
    pred_away_pens: number | null;
    pred_went_pens: boolean;
}

const resultToOutcome = (result: string | null): 'HOME' | 'AWAY' | 'DRAW' | null => {
    if (result === 'HOME_WIN') return 'HOME';
    if (result === 'AWAY_WIN') return 'AWAY';
    if (result === 'DRAW') return 'DRAW';
    return null;
};

const getOutcome = (home: number | null, away: number | null, fallbackResult?: string | null) => {
    if (home === null || away === null) {
        if (fallbackResult) return resultToOutcome(fallbackResult);
        return null;
    }
    if (home > away) return 'HOME';
    if (away > home) return 'AWAY';
    return 'DRAW';
};

const isExactPred = (off: OfficialMatchRow, pred: PredMatchRow): boolean => {
    return off.home_goals === pred.pred_home_goals && off.away_goals === pred.pred_away_goals;
};

export const scoreMatches = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    // 1. Load Finished Official Matches
    const { data: official, error: offErr } = await supabase
        .from('official_matches')
        .select('*')
        .eq('status', 'FINISHED');

    if (offErr) return { usersScored: 0, error: offErr.message };
    if (!official?.length) return { usersScored: 0 }; // Nothing finished to score

    // Map for faster lookup
    const offMap: Record<string, OfficialMatchRow> = {};
    official.forEach(o => offMap[o.match_id] = o);

    // 1b. Load knockout structure for Easy Mode result fallback
    const koMatchIds = official.filter(o => {
        const n = parseInt(o.match_id.slice(1), 10);
        return !isNaN(n) && n >= 73;
    }).map(o => o.match_id);

    let structMap: Record<string, Record<string, { pred_result: string | null }>> = {};
    if (koMatchIds.length > 0) {
        let structQuery = supabase
            .from('user_predictions_knockout_structure')
            .select('user_id, match_id, pred_result')
            .in('match_id', koMatchIds);
        if (userId) structQuery = structQuery.eq('user_id', userId);
        const { data: structData } = await structQuery;
        if (structData) {
            structData.forEach((row: any) => {
                if (!structMap[row.user_id]) structMap[row.user_id] = {};
                structMap[row.user_id][row.match_id] = { pred_result: row.pred_result };
            });
        }
    }

    // 2. Load User Match Predictions matching these match IDs
    let query = supabase
        .from('user_predictions_matches')
        .select('*')
        .in('match_id', official.map(o => o.match_id));

    if (userId) query = query.eq('user_id', userId);

    const { data: preds, error: predErr } = await query;

    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // 3. Load Points Configuration
    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;

    const ptsExact = getPts('match_exact_score', 2);
    const ptsOutcome = getPts('match_correct_outcome', 1);
    const ptsWentPens = getPts('match_went_to_pens', 2);
    const ptsPensWinner = getPts('match_pens_winner', 3);

    // 4. Calculate Scores
    const updates = (preds as PredMatchRow[]).map(pred => {
        let pts = 0;
        const off = offMap[pred.match_id];
        if (!off) return { id: pred.id, user_id: pred.user_id, pts_earned: 0 };

        const structRow = structMap[pred.user_id]?.[pred.match_id];
        const fallbackResult = structRow?.pred_result ?? null;

        const offOutcome = getOutcome(off.home_goals, off.away_goals);
        const predOutcome = getOutcome(pred.pred_home_goals, pred.pred_away_goals, fallbackResult);

        // Regular Time Goals Logic
        if (offOutcome !== null && predOutcome !== null) {
            if (off.home_goals === pred.pred_home_goals && off.away_goals === pred.pred_away_goals) {
                // Exact score
                pts += ptsExact;
            } else if (offOutcome === predOutcome) {
                // Not exact score, but correct outcome (e.g. 1-0 instead of 2-0, both HOME win)
                pts += ptsOutcome;
            }
        }

        // Penalty Shootout Logic — only applies when user entered actual scores
        if (off.went_to_pens && pred.pred_home_goals !== null && pred.pred_away_goals !== null) {
            const predIsDraw = predOutcome === 'DRAW';

            const offPenWinner = getOutcome(off.home_penalties, off.away_penalties);
            const predPenWinner = getOutcome(pred.pred_home_pens, pred.pred_away_pens);

            if (offPenWinner !== null && offPenWinner !== 'DRAW' && offPenWinner === predPenWinner) {
                pts += ptsPensWinner;
                if (predIsDraw) pts += ptsWentPens;
                if (!isExactPred(off, pred)) pts += ptsExact;
            } else if (predIsDraw) {
                pts += ptsWentPens;
            }
        }

        return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
    });

    // 5. Persist via RPC (SECURITY DEFINER - bypasses RLS, scores ALL users)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'bulk_update_prediction_points',
        {
            p_table_name: 'user_predictions_matches',
            p_updates: updates
        }
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
