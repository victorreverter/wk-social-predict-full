import { supabase } from './supabase';
import { recalculateUserPoints } from './scoreUtils';
import { generateInitialGroupMatches } from '../utils/data-init';
import { updateKnockoutBracket, determineQualifiedTeams } from '../utils/bracket-logic';

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

    const { best8Thirds } = determineQualifiedTeams(groupMatches);
    const thirdsIds = best8Thirds.map(t => t.teamId);

    // Initial knockouts
    let ko = updateKnockoutBracket({}, groupMatches, thirdsIds, true);
    
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

    // Final mathematical propagation 
    ko = updateKnockoutBracket(ko, groupMatches, thirdsIds, true);

    // 3. Extract mathematically precise official stage teams based off tournament progression
    const officialStages: Record<string, Set<string>> = {
        'R32': new Set(),
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

    // 4. Load Scoring Rules
    const { data: rules } = await supabase.from('scoring_rules').select('rule_key, pts');
    const getPts = (key: string, _default: number) => rules?.find(r => r.rule_key === key)?.pts ?? _default;
    
    const ptsR16 = getPts('ko_reach_r16', 2);
    const ptsQF = getPts('ko_reach_qf', 5);
    const ptsSF = getPts('ko_reach_sf', 10);
    const ptsF = getPts('ko_reach_final', 15);
    const ptsChamp = getPts('ko_champion', 25);

    // 5. Load User Knockout Predictions
    let query = supabase.from('user_predictions_knockout').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: preds, error: predErr } = await query;
    if (predErr) return { usersScored: 0, error: predErr.message };
    if (!preds?.length) return { usersScored: 0 };

    // 6. Calculate user points mathematically
    const updates = preds.map(p => {
        let pts = 0;
        
        // Wait, 'user_predictions_knockout' uses round mapping. 
        // e.g. 'R16', 'QF', 'SF', 'F', 'CHAMPION'
        if (p.round === 'R16' && officialStages['R16'].has(p.team_id)) pts = ptsR16;
        if (p.round === 'QF' && officialStages['QF'].has(p.team_id)) pts = ptsQF;
        if (p.round === 'SF' && officialStages['SF'].has(p.team_id)) pts = ptsSF;
        if (p.round === 'F' && officialStages['F'].has(p.team_id)) pts = ptsF;
        if (p.round === 'CHAMPION' && p.team_id === champion) pts = ptsChamp;

        return { id: p.id, user_id: p.user_id, pts_earned: pts };
    });

    // 7. Update User Arrays natively
    await Promise.all(
        updates.map(u => 
            supabase
                .from('user_predictions_knockout')
                .update({ pts_earned: u.pts_earned })
                .eq('id', u.id)
        )
    );

    // 8. Rebuild Total Profile Points
    const uniqueUserIds = [...new Set(updates.map(r => r.user_id))];
    await Promise.all(uniqueUserIds.map(uid => recalculateUserPoints(uid)));

    return { usersScored: uniqueUserIds.length };
};
