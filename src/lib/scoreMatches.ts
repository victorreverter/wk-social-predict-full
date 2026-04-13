import { supabase } from './supabase';
import { recalculateUserPoints } from './scoreUtils';

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

const getOutcome = (home: number | null, away: number | null) => {
    if (home === null || away === null) return null;
    if (home > away) return 'HOME';
    if (away > home) return 'AWAY';
    return 'DRAW';
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
    
    const ptsExact = getPts('match_exact_score', 3);
    const ptsOutcome = getPts('match_correct_outcome', 1);
    const ptsWentPens = getPts('match_went_to_pens', 2);
    const ptsPensWinner = getPts('match_pens_winner', 3);

    // 4. Calculate Scores
    const updates = (preds as PredMatchRow[]).map(pred => {
        let pts = 0;
        const off = offMap[pred.match_id];
        if (!off) return { id: pred.id, user_id: pred.user_id, pts_earned: 0 };

        const offOutcome = getOutcome(off.home_goals, off.away_goals);
        const predOutcome = getOutcome(pred.pred_home_goals, pred.pred_away_goals);

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

        // Penalty Shootout Logic
        if (off.went_to_pens) {
            const predIsDraw = predOutcome === 'DRAW';
            // Note: Since standard groups don't have pens, this primarily triggers on knockout matches
            if (predIsDraw) {
                pts += ptsWentPens;
            }
            
            const offPenWinner = getOutcome(off.home_penalties, off.away_penalties);
            const predPenWinner = getOutcome(pred.pred_home_pens, pred.pred_away_pens);

            if (offPenWinner !== null && offPenWinner !== 'DRAW' && offPenWinner === predPenWinner) {
                pts += ptsPensWinner;
            }
        }

        return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
    });

    // 5. Persist the points array updates natively to Supabase
    await Promise.all(
        updates.map(u => 
            supabase
                .from('user_predictions_matches')
                .update({ pts_earned: u.pts_earned })
                .eq('id', u.id)
        )
    );

    // 6. Recalculate Profiles via RPC or iteration
    const uniqueUserIds = [...new Set(updates.map(r => r.user_id))];
    await Promise.all(uniqueUserIds.map(uid => recalculateUserPoints(uid)));

    return { usersScored: uniqueUserIds.length };
};
