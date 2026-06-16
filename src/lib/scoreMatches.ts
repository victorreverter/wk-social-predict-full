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

const calculatePoints = (
    off: OfficialMatchRow,
    pred: PredMatchRow,
    ptsExact: number,
    ptsOutcome: number,
    ptsWentPens: number,
    ptsPensWinner: number,
    fallbackResult: string | null
): number => {
    let pts = 0;
    const offOutcome = getOutcome(off.home_goals, off.away_goals);
    const predOutcome = getOutcome(pred.pred_home_goals, pred.pred_away_goals, fallbackResult);

    if (offOutcome !== null && predOutcome !== null) {
        if (off.home_goals === pred.pred_home_goals && off.away_goals === pred.pred_away_goals) {
            pts += ptsExact;
        } else if (offOutcome === predOutcome) {
            pts += ptsOutcome;
        }
    }

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

    return pts;
};

export const scoreMatches = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    const { data: official, error: offErr } = await supabase
        .from('official_matches')
        .select('*')
        .eq('status', 'FINISHED');

    if (offErr) return { usersScored: 0, error: offErr.message };
    if (!official?.length) return { usersScored: 0 };

    const offMap: Record<string, OfficialMatchRow> = {};
    official.forEach(o => offMap[o.match_id] = o);

    const groupMatchIds = official
        .filter(o => {
            const n = parseInt(o.match_id.slice(1), 10);
            return !isNaN(n) && n <= 72;
        })
        .map(o => o.match_id);

    const koMatchIds = official
        .filter(o => {
            const n = parseInt(o.match_id.slice(1), 10);
            return !isNaN(n) && n >= 73;
        })
        .map(o => o.match_id);

    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;
    const ptsExact = getPts('match_exact_score', 2);
    const ptsOutcome = getPts('match_correct_outcome', 1);
    const ptsWentPens = getPts('match_went_to_pens', 2);
    const ptsPensWinner = getPts('match_pens_winner', 3);

    let totalUsersScored = 0;

    // ── Group matches (m1–m72) from user_predictions_matches ──
    if (groupMatchIds.length > 0) {

        let groupQuery = supabase
            .from('user_predictions_matches')
            .select('*')
            .in('match_id', groupMatchIds);

        if (userId) groupQuery = groupQuery.eq('user_id', userId);

        const { data: groupPreds, error: groupPredErr } = await groupQuery;

        if (groupPredErr) return { usersScored: 0, error: groupPredErr.message };

        if (groupPreds?.length) {
            const groupUpdates = (groupPreds as PredMatchRow[]).map(pred => {
                const off = offMap[pred.match_id];
                if (!off) return { id: pred.id, user_id: pred.user_id, pts_earned: 0 };
                const pts = calculatePoints(off, pred, ptsExact, ptsOutcome, ptsWentPens, ptsPensWinner, null);
                return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
            });

            const { data: rpcResult, error: rpcErr } = await supabase.rpc(
                'bulk_update_prediction_points',
                { p_table_name: 'user_predictions_matches', p_updates: groupUpdates }
            );

            if (rpcErr) return { usersScored: 0, error: rpcErr.message };
            const result = rpcResult as any;
            if (!result?.success) return { usersScored: 0, error: result?.message || 'Bulk update failed.' };
            totalUsersScored += (result?.users_scored ?? 0);
        }
    }

    // ── Knockout matches (m73+) from user_predictions_ko_games ──
    if (koMatchIds.length > 0) {
        let koQuery = supabase
            .from('user_predictions_ko_games')
            .select('*')
            .in('match_id', koMatchIds);

        if (userId) koQuery = koQuery.eq('user_id', userId);

        const { data: koPreds, error: koPredErr } = await koQuery;

        if (koPredErr) return { usersScored: 0, error: koPredErr.message };

        if (koPreds?.length) {
            const koUpdates = (koPreds as PredMatchRow[]).map(pred => {
                const off = offMap[pred.match_id];
                if (!off) return { id: pred.id, user_id: pred.user_id, pts_earned: 0 };
                const pts = calculatePoints(off, pred, ptsExact, ptsOutcome, ptsWentPens, ptsPensWinner, null);
                return { id: pred.id, user_id: pred.user_id, pts_earned: pts };
            });

            const { data: rpcResult, error: rpcErr } = await supabase.rpc(
                'bulk_update_prediction_points',
                { p_table_name: 'user_predictions_ko_games', p_updates: koUpdates }
            );

            if (rpcErr) return { usersScored: 0, error: rpcErr.message };
            const result = rpcResult as any;
            if (!result?.success) return { usersScored: 0, error: result?.message || 'Bulk update failed.' };
            totalUsersScored += (result?.users_scored ?? 0);
        }
    }

    return { usersScored: totalUsersScored };
};
