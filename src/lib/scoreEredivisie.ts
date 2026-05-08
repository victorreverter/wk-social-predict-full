import { supabase } from './supabase';
import { logger } from './logger';

interface EredivisieResult {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  status: string;
}

export async function scoreEredivisie(userId?: string): Promise<{ usersScored: number; error: string | null }> {
  try {
    const { data: officialResults, error: resultsErr } = await supabase
      .from('official_eredivisie')
      .select('*')
      .eq('status', 'FINISHED');

    if (resultsErr) {
      logger.error('Failed to fetch eredivisie official results', resultsErr);
      return { usersScored: 0, error: resultsErr.message };
    }

    if (!officialResults || officialResults.length === 0) {
      return { usersScored: 0, error: null };
    }

    const resultsMap: Record<string, EredivisieResult> = {};
    (officialResults as EredivisieResult[]).forEach(r => { resultsMap[r.match_id] = r; });

    let query = supabase.from('user_predictions_eredivisie').select('*');
    if (userId) query = query.eq('user_id', userId);

    const { data: predictions, error: predErr } = await query;

    if (predErr) {
      logger.error('Failed to fetch eredivisie predictions', predErr);
      return { usersScored: 0, error: predErr.message };
    }

    if (!predictions) return { usersScored: 0, error: null };

    const scoredUsers = new Set<string>();

    for (const pred of predictions) {
      const official = resultsMap[pred.match_id];
      if (!official || official.home_goals === null || official.away_goals === null) continue;

      let pts = 0;
      const predH = pred.pred_home_goals;
      const predA = pred.pred_away_goals;

      if (predH !== null && predA !== null) {
        if (predH === official.home_goals && predA === official.away_goals) {
          pts = 5;
        } else if (
          (predH > predA && official.home_goals > official.away_goals) ||
          (predH < predA && official.home_goals < official.away_goals) ||
          (predH === predA && official.home_goals === official.away_goals)
        ) {
          pts = 2;
        }
      }

      const { error: updateErr } = await supabase
        .from('user_predictions_eredivisie')
        .update({ pts_earned: pts })
        .eq('user_id', pred.user_id)
        .eq('match_id', pred.match_id);

      if (!updateErr && pts > 0) scoredUsers.add(pred.user_id);
    }

    return { usersScored: scoredUsers.size, error: null };
  } catch (err: any) {
    logger.error('scoreEredivisie error', err);
    return { usersScored: 0, error: err.message };
  }
}
