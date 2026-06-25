import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { OfficialMatch } from '../types';
import { scoreMatches } from '../lib/scoreMatches';
import { scoreKnockout } from '../lib/scoreKnockout';
import { scoreGroupPositions } from '../lib/scoreGroupPositions';

export function useLoadOfficialMatches() {
  const { loadOfficialMatches } = useApp();
  const { profile } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const rescoreInFlightRef = useRef(false);

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

      const snapshot = JSON.stringify(
        (data || [])
          .map((row: any) => [
            row.match_id,
            row.status ?? 'NOT_PLAYED',
            row.home_goals ?? null,
            row.away_goals ?? null,
            row.home_penalties ?? null,
            row.away_penalties ?? null,
            row.updated_at ?? null,
          ])
          .sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])))
      );

      if (lastSnapshotRef.current === snapshot) return;
      lastSnapshotRef.current = snapshot;

      if (!profile?.is_master || rescoreInFlightRef.current) return;

      rescoreInFlightRef.current = true;
      try {
        await Promise.all([
          scoreMatches(),
          scoreKnockout(),
          scoreGroupPositions(),
        ]);
        window.dispatchEvent(new Event('leaderboard-refresh'));
      } finally {
        rescoreInFlightRef.current = false;
      }
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
  }, [loadOfficialMatches, profile?.is_master]);
}
