import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const useLoadUserPredictions = () => {
    const { session } = useAuth();
    const { state, loadFullState } = useApp();

    useEffect(() => {
        if (!session?.user) return;

        const loadPredictions = async () => {
            try {
                const [matchesRes, koRes, awardsRes, xiRes] = await Promise.all([
                    supabase.from('user_predictions_matches').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_knockout').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_awards').select('*').eq('user_id', session.user.id),
                    supabase.from('user_predictions_xi').select('*').eq('user_id', session.user.id)
                ]);

                if (matchesRes.error || koRes.error || awardsRes.error || xiRes.error) {
                    console.error("Error loading predictions", { matchesRes, koRes, awardsRes, xiRes });
                    return;
                }

                // If user has zero predictions in DB, do nothing
                if (matchesRes.data.length === 0 && awardsRes.data.length === 0 && xiRes.data.length === 0) {
                    return;
                }

                const buildMatchObj = (m: any, existingMatch: any) => ({
                    ...existingMatch,
                    score: {
                        homeGoals: m.pred_home_goals,
                        awayGoals: m.pred_away_goals,
                        homePenalties: m.pred_home_pens,
                        awayPenalties: m.pred_away_pens,
                    },
                    result: (m.pred_home_goals !== null && m.pred_away_goals !== null) 
                        ? (m.pred_home_goals > m.pred_away_goals ? 'HOME_WIN' : (m.pred_home_goals < m.pred_away_goals ? 'AWAY_WIN' : 'DRAW')) 
                        : null,
                    status: (m.pred_home_goals !== null && m.pred_away_goals !== null) ? 'FINISHED' : 'NOT_PLAYED'
                });

                const loadedGroups = { ...state.groupMatches };
                const loadedKo = { ...state.knockoutMatches };

                matchesRes.data.forEach((m: any) => {
                    const id = m.match_id;
                    if (loadedGroups[id]) {
                        loadedGroups[id] = buildMatchObj(m, loadedGroups[id]);
                    } else if (loadedKo[id]) {
                        // For KO, the team IDs are dynamically assigned by Bracket Logic!
                        // So we just update the score, result and status. 
                        loadedKo[id] = buildMatchObj(m, loadedKo[id]);
                    }
                });

                const loadedAwards = { ...state.awards };
                awardsRes.data.forEach((a: any) => {
                    if (a.category in loadedAwards) {
                        (loadedAwards as any)[a.category] = a.value;
                    }
                });

                const loadedXI = { ...state.tournamentXI };
                xiRes.data.forEach((x: any) => {
                    if (x.position in loadedXI) {
                        (loadedXI as any)[x.position] = x.player_name;
                    }
                });

                loadFullState({
                    groupMatches: loadedGroups,
                    knockoutMatches: loadedKo,
                    awards: loadedAwards,
                    tournamentXI: loadedXI
                });
                
            } catch (err) {
                console.error("Failed to load predictions: ", err);
            }
        };

        // Delay it highly slightly to ensure context binds completely
        setTimeout(() => loadPredictions(), 500);
    }, [session]);
};
