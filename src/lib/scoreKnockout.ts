import { supabase } from './supabase';
import { generateInitialGroupMatches, initialTeams } from '../utils/data-init';
import { updateKnockoutBracket, determineQualifiedTeams, generateInitialKnockoutMatches } from '../utils/bracket-logic';
import { calculateGroupStandings } from '../utils/standings';

interface OfficialMatchRow {
    match_id: string;
    home_goals: number | null;
    away_goals: number | null;
    home_penalties?: number | null;
    away_penalties?: number | null;
    status: string;
}

interface OfficialGroupPositionRow {
    group_letter: string;
    order: string[];
}

export const buildOfficialR32TeamSet = (
    officialMatches: OfficialMatchRow[],
    officialGroupPositions: OfficialGroupPositionRow[] = []
): { teams: Set<string>; finishedGroups: Set<string>; allGroupsFinished: boolean } => {
    const groupMatches = generateInitialGroupMatches();
    const matchesByGroup: Record<string, string[]> = {};
    const adminPositions: Record<string, string[]> = {};

    Object.entries(groupMatches).forEach(([matchId, match]) => {
        if (!matchesByGroup[match.group!]) matchesByGroup[match.group!] = [];
        matchesByGroup[match.group!].push(matchId);
    });

    officialGroupPositions.forEach(row => {
        adminPositions[row.group_letter] = row.order;
    });

    const officialStatus: Record<string, string> = {};
    officialMatches.forEach(om => {
        officialStatus[om.match_id] = om.status;
        if (groupMatches[om.match_id] && om.status === 'FINISHED' && om.home_goals !== null && om.away_goals !== null) {
            groupMatches[om.match_id] = {
                ...groupMatches[om.match_id],
                score: {
                    ...groupMatches[om.match_id].score,
                    homeGoals: om.home_goals,
                    awayGoals: om.away_goals,
                    homePenalties: om.home_penalties ?? null,
                    awayPenalties: om.away_penalties ?? null,
                },
                status: 'FINISHED',
            };
        }
    });

    const finishedGroups = new Set<string>();
    Object.entries(matchesByGroup).forEach(([group, matchIds]) => {
        if (matchIds.every(id => officialStatus[id] === 'FINISHED')) {
            finishedGroups.add(group);
        }
    });

    const teams = new Set<string>();
    finishedGroups.forEach(group => {
        const officialOrder = adminPositions[group]
            || calculateGroupStandings(group, initialTeams, groupMatches).map(team => team.teamId);

        if (officialOrder[0]) teams.add(officialOrder[0]);
        if (officialOrder[1]) teams.add(officialOrder[1]);
    });

    const allGroupsFinished = finishedGroups.size === Object.keys(matchesByGroup).length;
    if (allGroupsFinished) {
        const { best8Thirds } = determineQualifiedTeams(groupMatches);
        best8Thirds.forEach(team => teams.add(team.teamId));
    }

    return { teams, finishedGroups, allGroupsFinished };
};

export const scoreKnockout = async (userId?: string): Promise<{ usersScored: number; error?: string }> => {
    // 1. Load Finished Official Matches
    const { data: official, error: offErr } = await supabase
        .from('official_matches')
        .select('*');

    if (offErr) return { usersScored: 0, error: offErr.message };

    // 2. Re-create the deterministic Bracket exactly as the site engine normally does,
    //    but strictly seeded by Official Data.
    const groupMatches = generateInitialGroupMatches();
    const omMap: Record<string, any> = {};
    official.forEach(o => omMap[o.match_id] = o);

    // Fill groups
    Object.keys(groupMatches).forEach(id => {
        const om = omMap[id];
        if (om) {
            groupMatches[id].score.homeGoals = om.home_goals;
            groupMatches[id].score.awayGoals = om.away_goals;
            groupMatches[id].score.homePenalties = om.home_penalties;
            groupMatches[id].score.awayPenalties = om.away_penalties;
            groupMatches[id].status = (om.home_goals !== null && om.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED';
        }
    });

    // ── Pre-tournament guard ─────────────────────────────────────────────────
    // If no group match has been officially FINISHED yet, the knockout bracket
    // does not exist. We must NOT fabricate a "R32 official set" from empty
    // standings — that would award phantom points to users whose R32 prediction
    // rows happen to match the fabricated team IDs.
    const finishedGroupCount = Object.values(groupMatches)
        .filter(m => m.status === 'FINISHED').length;

    if (finishedGroupCount === 0) {
        // Zero all KO points for the user(s) being scored and re-sum totals.
        let q = supabase.from('user_predictions_knockout').select('id, user_id');
        if (userId) q = q.eq('user_id', userId);
        const { data: existing } = await q;
        if (existing && existing.length > 0) {
            // Zero via RPC
            const zeroUpdates = existing.map((r: any) => ({
                id: r.id,
                user_id: r.user_id,
                pts_earned: 0
            }));
            const { data: rpcResult, error: rpcErr } = await supabase.rpc(
                'bulk_update_prediction_points',
                { p_table_name: 'user_predictions_knockout', p_updates: zeroUpdates }
            );
            if (rpcErr) return { usersScored: 0, error: rpcErr.message };
            const result = rpcResult as any;
            return { usersScored: result?.users_scored ?? 0 };
        }
        return { usersScored: 0 };
    }

    const { data: officialGroupPositions } = await supabase
        .from('official_group_positions')
        .select('group_letter, "order"');

    const { teams: officialR32Teams, allGroupsFinished: r32Official } = buildOfficialR32TeamSet(
        official as OfficialMatchRow[],
        (officialGroupPositions || []) as OfficialGroupPositionRow[]
    );

    const { best8Thirds } = determineQualifiedTeams(groupMatches);
    const thirdsIds = best8Thirds.map(t => t.teamId);

    // Only seed R32 from group standings when we have the full group stage.
    // This prevents the bracket-logic from fabricating team IDs when only a
    // handful of group matches have been played.
    let ko = r32Official
        ? updateKnockoutBracket({}, groupMatches, thirdsIds, false)
        : generateInitialKnockoutMatches();

    // Inject official KO scores
    Object.keys(ko).forEach(id => {
        const om = omMap[id];
        if (om) {
            ko[id].score.homeGoals = om.home_goals;
            ko[id].score.awayGoals = om.away_goals;
            ko[id].score.homePenalties = om.home_penalties;
            ko[id].score.awayPenalties = om.away_penalties;
            ko[id].status = (om.home_goals !== null && om.away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED';
        }
    });

    // Final mathematical propagation (only when R32 is fully official)
    if (r32Official) {
        ko = updateKnockoutBracket(ko, groupMatches, thirdsIds, false);
    }

    // 3. Extract mathematically precise official stage teams based off tournament progression
    const officialStages: Record<string, Set<string>> = {
        'R32': new Set(officialR32Teams),
        'R16': new Set(),
        'QF': new Set(),
        'SF': new Set(),
        'F': new Set()
    };

    let champion = '';

    Object.values(ko).forEach(m => {
        if (m.homeTeamId !== 'TBD') officialStages[m.stage]?.add(m.homeTeamId);
        if (m.awayTeamId !== 'TBD') officialStages[m.stage]?.add(m.awayTeamId);

        // Determine Champion
        if (m.stage === 'F' && m.status === 'FINISHED') {
            if (m.score.homeGoals !== null && m.score.awayGoals !== null) {
                if (m.score.homeGoals > m.score.awayGoals) champion = m.homeTeamId;
                else if (m.score.awayGoals > m.score.homeGoals) champion = m.awayTeamId;
                else if (
                    m.score.homePenalties !== null && m.score.awayPenalties !== null &&
                    m.score.homePenalties !== undefined && m.score.awayPenalties !== undefined
                ) {
                    if (m.score.homePenalties > m.score.awayPenalties) champion = m.homeTeamId;
                    else if (m.score.awayPenalties > m.score.homePenalties) champion = m.awayTeamId;
                }
            }
        }
    });

    // A round is "scorable" only when the previous round is fully FINISHED in
    // official_matches. Otherwise users can only earn points for rounds whose
    // results are actually known.
    const finishedMatchCount = (roundMatchNums: number[]): boolean => {
        return roundMatchNums.every(n => {
            const om = omMap[`m${n}`];
            return om && om.status === 'FINISHED' && om.home_goals !== null && om.away_goals !== null;
        });
    };

    const r32Nums = Array.from({ length: 16 }, (_, i) => 73 + i);
    const r16Nums = Array.from({ length: 8 },  (_, i) => 89 + i);
    const qfNums  = Array.from({ length: 4 },  (_, i) => 97 + i);
    const sfNums  = [101, 102];
    const fNum    = 104;

    if (!finishedMatchCount(r32Nums))                  officialStages['R16'] = new Set();
    if (!finishedMatchCount(r16Nums))                  officialStages['QF']  = new Set();
    if (!finishedMatchCount(qfNums))                   officialStages['SF']  = new Set();
    if (!finishedMatchCount(sfNums) || !omMap[`m${fNum}`] || omMap[`m${fNum}`].status !== 'FINISHED') {
        officialStages['F'] = new Set();
        champion = '';
    }

    // 4. Load Scoring Rules
    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;

    const ptsR32 = getPts('ko_reach_r32', 2);
    const ptsR16 = getPts('ko_reach_r16', 5);
    const ptsQF = getPts('ko_reach_qf', 10);
    const ptsSF = getPts('ko_reach_sf', 15);
    const ptsF = getPts('ko_reach_final', 20);
    const ptsChamp = getPts('ko_champion', 25);

    // 5. Load User Knockout Predictions
    let query = supabase.from('user_predictions_knockout').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: preds, error: predErr } = await query;
    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // 6. Calculate user points mathematically
    const updates = preds.map((p: any) => {
        let pts = 0;

        // Wait, 'user_predictions_knockout' uses round mapping.
        // e.g. 'R16', 'QF', 'SF', 'F', 'CHAMPION'
        if (p.round === 'R32' && officialStages['R32'].has(p.team_id)) pts = ptsR32;
        if (p.round === 'R16' && officialStages['R16'].has(p.team_id)) pts = ptsR16;
        if (p.round === 'QF' && officialStages['QF'].has(p.team_id)) pts = ptsQF;
        if (p.round === 'SF' && officialStages['SF'].has(p.team_id)) pts = ptsSF;
        if (p.round === 'F' && officialStages['F'].has(p.team_id)) pts = ptsF;
        if (p.round === 'CHAMPION' && p.team_id === champion) pts = ptsChamp;

        return { id: p.id, user_id: p.user_id, pts_earned: pts };
    });

    // 7. Persist via RPC (SECURITY DEFINER - bypasses RLS, scores ALL users)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'bulk_update_prediction_points',
        { p_table_name: 'user_predictions_knockout', p_updates: updates }
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
