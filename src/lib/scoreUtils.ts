import { supabase } from './supabase';

const sum = (rows: { pts_earned: number }[] | null): number =>
    (rows ?? []).reduce((s, r) => s + (r.pts_earned || 0), 0);

/**
 * Recalculates profiles.total_points for a specific user based on all prediction tables.
 */
export const recalculateUserPoints = async (userId: string) => {
    const [matchRes, awardRes, koRes, xiRes] = await Promise.all([
        supabase.from('user_predictions_matches').select('pts_earned').eq('user_id', userId),
        supabase.from('user_predictions_awards').select('pts_earned').eq('user_id', userId),
        supabase.from('user_predictions_knockout').select('pts_earned').eq('user_id', userId),
        supabase.from('user_predictions_xi').select('pts_earned').eq('user_id', userId),
    ]);
    
    const total =
        sum(matchRes.data) +
        sum(awardRes.data) +
        sum(koRes.data) +
        sum(xiRes.data);
        
    await supabase.from('profiles').update({ total_points: total }).eq('id', userId);
};
