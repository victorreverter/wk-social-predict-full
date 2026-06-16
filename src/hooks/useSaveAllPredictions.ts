import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/shared/Toast';
import { logger } from '../lib/logger';

import { rateLimiter } from '../lib/rateLimiter';
import type { Match } from '../types';

export const useSaveAllPredictions = () => {
    const { state } = useApp();
    const { session, categoryLocks, isMatchLocked } = useAuth();
    const { addToast } = useToast();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveMsg, setSaveMsg] = useState('');

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Rate limiter is initialized in main.tsx

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
            addToast('Please sign in to save.', 'error');
            return;
        }

        const rateLimit = rateLimiter.check('PREDICTION_SAVE');
        if (!rateLimit.allowed) {
            const waitSeconds = Math.ceil((rateLimit.resetAt! - Date.now()) / 1000);
            const msg = `Too many save attempts. Please wait ${waitSeconds} seconds.`;
            setAlert('error', msg);
            addToast(msg, 'error');
            return;
        }

        // Track which categories are locked by admin.
        // Individual match predictions are NOT affected by category locks —
        // they are only blocked by per-match time lock (1hr before kickoff).
        const blockedCategories: string[] = [];
        if (categoryLocks.GROUP_STAGE) blockedCategories.push('Group Stage');
        if (categoryLocks.BRACKET) blockedCategories.push('Bracket');
        if (categoryLocks.AWARDS) blockedCategories.push('Awards');
        if (categoryLocks.TOURNAMENT_XI) blockedCategories.push('Tournament XI');

        const saveCategories = {
            groupStage: !categoryLocks.GROUP_STAGE,
            bracket: !categoryLocks.BRACKET,
            awards: !categoryLocks.AWARDS,
            tournamentXI: !categoryLocks.TOURNAMENT_XI,
        };

        // Validate at least some predictions exist
        const allMatches = [
            ...Object.values(state.groupMatches),
            ...Object.values(state.knockoutMatches)
        ];
        const hasGroupPositions = Object.values(state.customGroupPositions).some(arr => arr.length === 4);
        const hasAwards = Object.values(state.awards).some(v => v.trim());
        const hasXI = Object.values(state.tournamentXI).some(v => v.trim());

        const savableMatches = allMatches.filter(m => (m.score || m.result) && !isMatchLocked(m as Match)).length;
        const savableGroupPositions = hasGroupPositions && saveCategories.groupStage;
        const savableAwards = hasAwards && saveCategories.awards;
        const savableXI = hasXI && saveCategories.tournamentXI;

        if (savableMatches === 0 && !savableGroupPositions && !savableAwards && !savableXI) {
            setAlert('error', 'No predictions to save. Complete at least 1 match or selection first.');
            return;
        }

        setSaveStatus('saving');
        setSaveMsg('');

        // Identify locked matches so we can skip them and preserve existing predictions
        const lockedMatches = allMatches.filter(m => isMatchLocked(m as Match));
        const unlockedMatches = allMatches.filter(m => !isMatchLocked(m as Match));

        // Ensure profile exists for this user (auto-creates if missing)
        const { error: profileErr } = await supabase.rpc('ensure_profile', { target_id: session.user.id });
        if (profileErr) {
            console.error('[saveAll] ensure_profile RPC failed:', profileErr);
            setAlert('error', 'Failed to verify account. Please sign in again.');
            setSaveStatus('error');
            return;
        }

        try {
            // 1. Matches (Group + Knockout) — only unlocked matches
            const allMatchesWithPredictions = unlockedMatches.filter(m => m.status === 'FINISHED' || m.result);

            const matchRows = allMatchesWithPredictions.map(m => {
                let hg = m.score?.homeGoals ?? null;
                let ag = m.score?.awayGoals ?? null;

                // Handle Easy mode mapping (if score is absent but result is set)
                if (hg === null || ag === null) {
                    if (m.stage !== 'GROUP') {
                        hg = null;
                        ag = null;
                    } else {
                        if (m.result === 'HOME_WIN') { hg = 1; ag = 0; }
                        else if (m.result === 'AWAY_WIN') { hg = 0; ag = 1; }
                        else if (m.result === 'DRAW') { hg = 0; ag = 0; }
                    }
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
                if (roundCode && roundCode !== 'F') { 
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

            // 5. Group Positions (ordered team IDs per group)
            const groupPositionsRows = Object.entries(state.customGroupPositions).map(([group, order]) => ({
                user_id: session.user.id,
                group_letter: group,
                order: order,
            }));

            // 6. Knockout Bracket Full Structure (match-by-match topology)
            const koStructureRows = Object.values(state.knockoutMatches).map(m => ({
                user_id: session.user.id,
                match_id: m.id,
                pred_home_team_id: m.homeTeamId,
                pred_away_team_id: m.awayTeamId,
                pred_home_goals: m.score?.homeGoals ?? null,
                pred_away_goals: m.score?.awayGoals ?? null,
                pred_home_pens: m.score?.homePenalties ?? null,
                pred_away_pens: m.score?.awayPenalties ?? null,
                pred_status: m.status,
                pred_result: m.result ?? null,
            }));

            // Delete stale rows before upserting fresh data.
            // Only delete tables whose category is NOT locked — this preserves
            // existing predictions in locked categories.
            // user_predictions_matches is never bulk-deleted; upsert handles
            // updates for unlocked matches via onConflict.
            const deletePromises: any[] = [];
            if (saveCategories.bracket) {
                deletePromises.push(supabase.from('user_predictions_knockout').delete().eq('user_id', session.user.id));
                deletePromises.push(supabase.from('user_predictions_knockout_structure').delete().eq('user_id', session.user.id));
            }
            if (saveCategories.awards) {
                deletePromises.push(supabase.from('user_predictions_awards').delete().eq('user_id', session.user.id));
            }
            if (saveCategories.tournamentXI) {
                deletePromises.push(supabase.from('user_predictions_xi').delete().eq('user_id', session.user.id));
            }
            if (saveCategories.groupStage) {
                deletePromises.push(supabase.from('user_group_positions').delete().eq('user_id', session.user.id));
            }
            if (deletePromises.length > 0) {
                await Promise.all(deletePromises);
            }

            const upsertPromises: any[] = [];
            if (matchRows.length > 0) {
                upsertPromises.push(supabase.from('user_predictions_matches').upsert(matchRows, { onConflict: 'user_id,match_id' }));
            }
            if (saveCategories.bracket) {
                if (koRows.length > 0) upsertPromises.push(supabase.from('user_predictions_knockout').upsert(koRows, { onConflict: 'user_id,round,team_id' }));
                upsertPromises.push(supabase.from('user_predictions_knockout_structure').upsert(koStructureRows, { onConflict: 'user_id,match_id' }));
                if (state.selectedThirds.length > 0) {
                    upsertPromises.push(supabase.from('user_selected_thirds').upsert({ user_id: session.user.id, team_ids: state.selectedThirds }, { onConflict: 'user_id' }));
                }
            }
            if (saveCategories.awards && awardRows.length > 0) {
                upsertPromises.push(supabase.from('user_predictions_awards').upsert(awardRows, { onConflict: 'user_id,category' }));
            }
            if (saveCategories.tournamentXI && xiRows.length > 0) {
                upsertPromises.push(supabase.from('user_predictions_xi').upsert(xiRows, { onConflict: 'user_id,position' }));
            }
            if (saveCategories.groupStage && groupPositionsRows.length > 0) {
                upsertPromises.push(supabase.from('user_group_positions').upsert(groupPositionsRows, { onConflict: 'user_id,group_letter' }));
            }

            // 7. Actual knockout game predictions (Games tab)
            const koGameRows = Object.entries(state.koGamePredictions).map(([matchId, score]) => ({
                user_id: session.user.id,
                match_id: matchId,
                pred_home_goals: score.homeGoals,
                pred_away_goals: score.awayGoals,
                pred_home_pens: score.homePenalties ?? null,
                pred_away_pens: score.awayPenalties ?? null,
                pts_earned: 0,
            }));
            if (koGameRows.length > 0) {
                upsertPromises.push(supabase.from('user_predictions_ko_games').upsert(koGameRows, { onConflict: 'user_id,match_id' }));
            }

            const results = await Promise.all(upsertPromises);
            const hasError = results.some(r => r.error);
            if (hasError) {
                const errors = results.filter(r => r.error).map(r => ({ error: r.error, status: r.status }));
                const msg = errors.map(e => e.error?.message || String(e.error) || String(e.status)).join('; ');
                logger.error('Save predictions failed', errors);
                setAlert('error', `Save failed: ${msg}`);
                addToast(`Save failed: ${msg}`, 'error');
            } else {
                // Note: scoring is intentionally NOT triggered from the user save flow.
                // Scoring belongs to the admin path (admin "Save match" / "Fetch API results")
                // and to the auto-fetch cron. The user save only persists predictions.
                window.dispatchEvent(new Event('leaderboard-refresh'));

                const savedCount = matchRows.length
                    + (saveCategories.bracket ? koRows.length : 0)
                    + (saveCategories.awards ? awardRows.length : 0)
                    + (saveCategories.tournamentXI ? xiRows.length : 0)
                    + (saveCategories.groupStage ? groupPositionsRows.length : 0)
                    + koGameRows.length;
                const notes: string[] = [];
                if (lockedMatches.length > 0) notes.push(`${lockedMatches.length} match(es) locked — preserved`);
                if (blockedCategories.length > 0) notes.push(`${blockedCategories.join(', ')} locked — skipped`);
                const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : '';
                setAlert('saved', `✅ Saved ${savedCount} predictions!${suffix}`);
                addToast(`Saved ${savedCount} predictions!${suffix}`, 'success');
            }

        } catch (err: any) {
            logger.error('Save error', err);
            setAlert('error', err.message || 'An unexpected error occurred.');
            addToast(err.message || 'An unexpected error occurred.', 'error');
        }
    };

    return { saveAll, saveStatus, saveMsg };
};
