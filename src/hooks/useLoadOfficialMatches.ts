import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { OfficialMatch } from '../types';

export function useLoadOfficialMatches() {
  const { loadOfficialMatches } = useApp();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('official_matches')
        .select('*');

      if (cancelled) return;
      if (error) {
        console.warn('[officialMatches] load failed:', error.message);
        return;
      }

      const map: Record<string, OfficialMatch> = {};
      (data || []).forEach((row: any) => {
        map[row.match_id] = {
          match_id: row.match_id,
          home_goals: row.home_goals,
          away_goals: row.away_goals,
          home_penalties: row.home_penalties ?? null,
          away_penalties: row.away_penalties ?? null,
          went_to_pens: row.went_to_pens ?? false,
          status: row.status ?? 'NOT_PLAYED',
          date: row.date ?? null,
          locked_at: row.locked_at ?? null,
        };
      });

      loadOfficialMatches(map);
    };

    load();

    const channel = supabase
      .channel('official-matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'official_matches' },
        () => { load(); }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadOfficialMatches]);
}
