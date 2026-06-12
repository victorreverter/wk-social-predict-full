import { supabase } from './supabase';

/**
 * Recalculates profiles.total_points for a specific user based on all prediction tables.
 * Uses SECURITY DEFINER RPC to bypass RLS.
 */
export const recalculateUserPoints = async (userId: string) => {
    await supabase.rpc('recalculate_user_points_rpc', { target_user_id: userId });
};
