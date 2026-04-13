import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePredictorCompletion } from './usePredictorCompletion';
import { scoreMatches } from '../lib/scoreMatches';
import { scoreKnockout } from '../lib/scoreKnockout';
import { scoreAwards } from '../lib/scoreAwards';
import { scoreXI } from '../lib/scoreXI';
export const useSaveAllPredictions = () => {
    const { state } = useApp();
    const { session, isLocked } = useAuth();
    const { isFinalFinished, areAwardsFilled } = usePredictorCompletion();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveMsg, setSaveMsg] = useState('');

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setAlert = (status: 'error' | 'saved', msg: string) => {
        setSaveStatus(status);
        setSaveMsg(msg);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setSaveStatus('idle');
            setSaveMsg('');
        }, 5000);
    };

    const saveAll = async () => {
        if (!session) {
            setAlert('error', 'Please sign in to save.');
            return;
        }

        if (isLocked) {
            setAlert('error', 'Predictions are locked.');
            return;
        }

        // Required condition: you must finish groups and brackets
        if (!isFinalFinished) {
            setAlert('error', 'Missing matches! Please complete the group stage and bracket entirely.');
            return;
        }

        setSaveStatus('saving');
        setSaveMsg('');


        try {
            // 1. Matches (Group + Knockout)
            const allMatches = [
                ...Object.values(state.groupMatches),
                ...Object.values(state.knockoutMatches)
            ].filter(m => m.status === 'FINISHED' || m.result);

            const matchRows = allMatches.map(m => {
                let hg = m.score?.homeGoals ?? null;
                let ag = m.score?.awayGoals ?? null;

                // Handle Easy mode mapping (if score is absent but result is set)
                if (hg === null || ag === null) {
                    if (m.result === 'HOME_WIN') { hg = 1; ag = 0; }
                    else if (m.result === 'AWAY_WIN') { hg = 0; ag = 1; }
                    else if (m.result === 'DRAW') { hg = 0; ag = 0; }
                }

                return {
                    user_id: session.user.id,
                    match_id: m.id,
                    pred_home_goals: hg,
                    pred_away_goals: ag,
                    pred_home_pens: m.score?.homePenalties ?? null,
                    pred_away_pens: m.score?.awayPenalties ?? null,
                    pred_went_pens: (hg !== null && hg === ag && m.stage !== 'GROUP'),
                    pts_earned: 0,
                };
            });

            // 2. Knockout Progression (Teams in each round)
            const koRows: { user_id: string; round: string; team_id: string; pts_earned: number }[] = [];
            
            // Extract progressing teams from knockout matches
            Object.values(state.knockoutMatches).forEach(m => {
                const roundCode = m.stage; // 'R32', 'R16', 'QF', 'SF', '3RD', 'F'
                if (roundCode && roundCode !== '3RD' && roundCode !== 'F') { 
                     if (m.homeTeamId && m.homeTeamId !== 'TBD') {
                         koRows.push({ user_id: session.user.id, round: roundCode, team_id: m.homeTeamId, pts_earned: 0 });
                     }
                     if (m.awayTeamId && m.awayTeamId !== 'TBD') {
                         koRows.push({ user_id: session.user.id, round: roundCode, team_id: m.awayTeamId, pts_earned: 0 });
                     }
                }
                if (roundCode === 'F') {
                     if (m.homeTeamId && m.homeTeamId !== 'TBD') {
                         koRows.push({ user_id: session.user.id, round: 'F', team_id: m.homeTeamId, pts_earned: 0 });
                     }
                     if (m.awayTeamId && m.awayTeamId !== 'TBD') {
                         koRows.push({ user_id: session.user.id, round: 'F', team_id: m.awayTeamId, pts_earned: 0 });
                     }
                }
            });

            // Champion
            const finalMatch = state.knockoutMatches['m104'];
            if (finalMatch) {
                 let champion = '';
                 if (finalMatch.result === 'HOME_WIN') champion = finalMatch.homeTeamId;
                 else if (finalMatch.result === 'AWAY_WIN') champion = finalMatch.awayTeamId;
                 else if (finalMatch.score?.homeGoals !== null && finalMatch.score?.awayGoals !== null) {
                     if (finalMatch.score.homeGoals > finalMatch.score.awayGoals) champion = finalMatch.homeTeamId;
                     else if (finalMatch.score.homeGoals < finalMatch.score.awayGoals) champion = finalMatch.awayTeamId;
                     else {
                         if ((finalMatch.score.homePenalties ?? 0) > (finalMatch.score.awayPenalties ?? 0)) champion = finalMatch.homeTeamId;
                         else champion = finalMatch.awayTeamId;
                     }
                 }
                 if (champion && champion !== 'TBD') {
                     koRows.push({ user_id: session.user.id, round: 'CHAMPION', team_id: champion, pts_earned: 0 });
                 }
            }


            // 3. Awards
            const awardRows = Object.entries(state.awards)
                .filter(([, value]) => value.trim() !== '')
                .map(([category, value]) => ({
                    user_id: session.user.id,
                    category,
                    value: value.trim(),
                    pts_earned: 0,
                }));

            // 4. Tournament XI
            const xiRows = Object.entries(state.tournamentXI)
                .filter(([, name]) => name.trim())
                .map(([position, player_name]) => ({
                    user_id: session.user.id,
                    position,
                    player_name: player_name.trim(),
                    pts_earned: 0,
                }));

            // Make the requests
            const promises = [
                supabase.from('user_predictions_matches').upsert(matchRows, { onConflict: 'user_id,match_id' }),
                supabase.from('user_predictions_knockout').upsert(koRows, { onConflict: 'user_id,round,team_id' })
            ];

            if (awardRows.length > 0) promises.push(supabase.from('user_predictions_awards').upsert(awardRows, { onConflict: 'user_id,category' }));
            if (xiRows.length > 0) promises.push(supabase.from('user_predictions_xi').upsert(xiRows, { onConflict: 'user_id,position' }));
            
            const results = await Promise.all(promises);
            const hasError = results.some(r => r.error);
            if (hasError) {
                console.error(results.filter(r => r.error).map(r => r.error));
                const optionalNote = (!areAwardsFilled || xiRows.length < 11) ? " (Note: XI or Awards were incomplete but this shouldn't block saving)" : "";
                setAlert('error', 'Failed to save. Please try again.' + optionalNote);
            } else {
                // Dynamically re-score the EXACT user who just saved, so their leaderboard ranks identically update instantly
                // We sequentially await them to fundamentally avoid database race conditions on recalculateUserPoints!
                await scoreMatches(session.user.id);
                await scoreKnockout(session.user.id);
                await scoreAwards(session.user.id);
                await scoreXI(session.user.id);

                let optionalNote = "";
                if (!areAwardsFilled || xiRows.length < 11) {
                    optionalNote = " (Bracket saved, but Awards or XI are incomplete)";
                }
                setAlert('saved', `✅ All Predictions Saved!${optionalNote}`);
            }

        } catch (err: any) {
            setAlert('error', err.message || 'An unexpected error occurred.');
        }
    };

    return { saveAll, saveStatus, saveMsg };
};
