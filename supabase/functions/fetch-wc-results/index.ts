import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const FOOTBALL_DATA_API_KEY = '924afe845f63492585fe21c0b58bafed';
const COMPETITION_ID = '2000';
const ENABLED = Deno.env.get('API_ENABLED') === 'true';

interface RequestBody {
  date?: string;
  force?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      'https://xrgtoduqrrmfmyxduhab.supabase.co',
      Deno.env.get('PROJECT_SERVICE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body: RequestBody = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().substring(0, 10);
    const force = body.force || false;

    if (!ENABLED && !force) {
      return new Response(
        JSON.stringify({ success: false, updated: 0, message: 'API fetching is disabled. Enable via API_ENABLED=true env var.', matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `https://api.football-data.org/v4/competitions/${COMPETITION_ID}/matches?dateFrom=${targetDate}&dateTo=${targetDate}`;
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
    });

    const responseMs = Date.now() - startTime;

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, updated: 0, message: `API returned ${response.status}`, matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    const allMatches = data.matches || [];
    const finishedMatches = allMatches.filter((m: Record<string, unknown>) =>
      m.status === 'FINISHED' || m.status === 'AWARDED'
    );

    if (finishedMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: `No finished matches for ${targetDate}`, matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upsertRows: Record<string, unknown>[] = [];
    const nowISO = new Date().toISOString();

    for (const m of finishedMatches) {
      const typedM = m as Record<string, unknown>;
      const score = (typedM.score || {}) as Record<string, unknown>;
      const fullTime = (score.fullTime || {}) as Record<string, number | null>;
      const penalties = score.penalties as Record<string, number | null> | null;
      const homeTeam = (typedM.homeTeam || {}) as Record<string, string>;
      const awayTeam = (typedM.awayTeam || {}) as Record<string, string>;

      const homeGoals = fullTime.home;
      const awayGoals = fullTime.away;
      if (homeGoals === null || homeGoals === undefined || awayGoals === null || awayGoals === undefined) continue;

      const homeTLA = homeTeam.tla || '';
      const awayTLA = awayTeam.tla || '';
      if (!homeTLA || !awayTLA) continue;

      const internalHome = FIFA_2026_TEAM_MAP[homeTLA.toUpperCase()];
      const internalAway = FIFA_2026_TEAM_MAP[awayTLA.toUpperCase()];
      if (!internalHome || !internalAway) continue;

      const matchDate = (typedM.utcDate as string || '').substring(0, 10);
      const fixture = GROUP_FIXTURES.find(f =>
        f.date.startsWith(matchDate) &&
        f.homeCode === internalHome &&
        f.awayCode === internalAway
      );
      if (!fixture) continue;

      upsertRows.push({
        match_id: `m${fixture.num}`,
        home_goals: homeGoals,
        away_goals: awayGoals,
        home_penalties: penalties ? (penalties.home ?? null) : null,
        away_penalties: penalties ? (penalties.away ?? null) : null,
        status: 'FINISHED',
        updated_at: nowISO,
      });
    }

    if (upsertRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No matches mapped to internal IDs', matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: upsertErr } = await supabaseClient
      .from('official_matches')
      .upsert(upsertRows, { onConflict: 'match_id' });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ success: false, updated: 0, message: `Upsert error: ${upsertErr.message}`, matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: upsertRows.length,
        message: `Updated ${upsertRows.length} matches for ${targetDate}`,
        matchDate: targetDate,
        matchIds: upsertRows.map(r => r.match_id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, updated: 0, message: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

const FIFA_2026_TEAM_MAP: Record<string, string> = {
  MEX: 'A1', RSA: 'A2', KOR: 'A3', CZE: 'A4',
  CAN: 'B1', BIH: 'B2', QAT: 'B3', SUI: 'B4',
  BRA: 'C1', MAR: 'C2', HAI: 'C3', SCO: 'C4',
  USA: 'D1', PAR: 'D2', AUS: 'D3', TUR: 'D4',
  GER: 'E1', CUW: 'E2', CIV: 'E3', ECU: 'E4',
  NED: 'F1', JPN: 'F2', SWE: 'F3', TUN: 'F4',
  BEL: 'G1', EGY: 'G2', IRN: 'G3', NZL: 'G4',
  ESP: 'H1', CPV: 'H2', KSA: 'H3', URU: 'H4',
  FRA: 'I1', SEN: 'I2', IRQ: 'I3', NOR: 'I4',
  ARG: 'J1', ALG: 'J2', AUT: 'J3', JOR: 'J4',
  POR: 'K1', COD: 'K2', UZB: 'K3', COL: 'K4',
  ENG: 'L1', CRO: 'L2', GHA: 'L3', PAN: 'L4',
};

const GROUP_FIXTURES: Array<{ num: number; date: string; homeCode: string; awayCode: string }> = [
  { num: 1,  date: '2026-06-11T19:00:00.000Z', homeCode: 'A1', awayCode: 'A2' },
  { num: 2,  date: '2026-06-12T02:00:00.000Z', homeCode: 'A3', awayCode: 'A4' },
  { num: 3,  date: '2026-06-12T19:00:00.000Z', homeCode: 'B1', awayCode: 'B2' },
  { num: 4,  date: '2026-06-13T01:00:00.000Z', homeCode: 'B3', awayCode: 'B4' },
  { num: 5,  date: '2026-06-14T01:00:00.000Z', homeCode: 'C1', awayCode: 'C2' },
  { num: 6,  date: '2026-06-14T04:00:00.000Z', homeCode: 'C3', awayCode: 'C4' },
  { num: 7,  date: '2026-06-13T22:00:00.000Z', homeCode: 'D1', awayCode: 'D2' },
  { num: 8,  date: '2026-06-13T19:00:00.000Z', homeCode: 'D3', awayCode: 'D4' },
  { num: 9,  date: '2026-06-14T23:00:00.000Z', homeCode: 'E1', awayCode: 'E2' },
  { num: 10, date: '2026-06-14T17:00:00.000Z', homeCode: 'E3', awayCode: 'E4' },
  { num: 11, date: '2026-06-14T20:00:00.000Z', homeCode: 'F1', awayCode: 'F2' },
  { num: 12, date: '2026-06-15T02:00:00.000Z', homeCode: 'F3', awayCode: 'F4' },
  { num: 13, date: '2026-06-15T22:00:00.000Z', homeCode: 'G1', awayCode: 'G2' },
  { num: 14, date: '2026-06-15T16:00:00.000Z', homeCode: 'G3', awayCode: 'G4' },
  { num: 15, date: '2026-06-16T01:00:00.000Z', homeCode: 'H1', awayCode: 'H2' },
  { num: 16, date: '2026-06-15T19:00:00.000Z', homeCode: 'H3', awayCode: 'H4' },
  { num: 17, date: '2026-06-16T19:00:00.000Z', homeCode: 'I1', awayCode: 'I2' },
  { num: 18, date: '2026-06-16T22:00:00.000Z', homeCode: 'I3', awayCode: 'I4' },
  { num: 19, date: '2026-06-17T01:00:00.000Z', homeCode: 'J1', awayCode: 'J2' },
  { num: 20, date: '2026-06-17T04:00:00.000Z', homeCode: 'J3', awayCode: 'J4' },
  { num: 21, date: '2026-06-17T23:00:00.000Z', homeCode: 'K1', awayCode: 'K2' },
  { num: 22, date: '2026-06-17T20:00:00.000Z', homeCode: 'K3', awayCode: 'K4' },
  { num: 23, date: '2026-06-17T17:00:00.000Z', homeCode: 'L1', awayCode: 'L2' },
  { num: 24, date: '2026-06-18T02:00:00.000Z', homeCode: 'L3', awayCode: 'L4' },
  { num: 25, date: '2026-06-18T16:00:00.000Z', homeCode: 'A1', awayCode: 'A3' },
  { num: 26, date: '2026-06-18T19:00:00.000Z', homeCode: 'A2', awayCode: 'A4' },
  { num: 27, date: '2026-06-18T22:00:00.000Z', homeCode: 'B1', awayCode: 'B3' },
  { num: 28, date: '2026-06-19T01:00:00.000Z', homeCode: 'B2', awayCode: 'B4' },
  { num: 29, date: '2026-06-20T00:30:00.000Z', homeCode: 'C1', awayCode: 'C3' },
  { num: 30, date: '2026-06-19T22:00:00.000Z', homeCode: 'C2', awayCode: 'C4' },
  { num: 31, date: '2026-06-20T03:00:00.000Z', homeCode: 'D1', awayCode: 'D3' },
  { num: 32, date: '2026-06-19T19:00:00.000Z', homeCode: 'D2', awayCode: 'D4' },
  { num: 33, date: '2026-06-20T20:00:00.000Z', homeCode: 'E1', awayCode: 'E3' },
  { num: 34, date: '2026-06-21T00:00:00.000Z', homeCode: 'E2', awayCode: 'E4' },
  { num: 35, date: '2026-06-20T17:00:00.000Z', homeCode: 'F1', awayCode: 'F3' },
  { num: 36, date: '2026-06-21T04:00:00.000Z', homeCode: 'F2', awayCode: 'F4' },
  { num: 37, date: '2026-06-21T22:00:00.000Z', homeCode: 'G1', awayCode: 'G3' },
  { num: 38, date: '2026-06-21T16:00:00.000Z', homeCode: 'G2', awayCode: 'G4' },
  { num: 39, date: '2026-06-21T19:00:00.000Z', homeCode: 'H1', awayCode: 'H3' },
  { num: 40, date: '2026-06-22T01:00:00.000Z', homeCode: 'H2', awayCode: 'H4' },
  { num: 41, date: '2026-06-23T00:00:00.000Z', homeCode: 'I1', awayCode: 'I3' },
  { num: 42, date: '2026-06-22T21:00:00.000Z', homeCode: 'I2', awayCode: 'I4' },
  { num: 43, date: '2026-06-22T17:00:00.000Z', homeCode: 'J1', awayCode: 'J3' },
  { num: 44, date: '2026-06-23T03:00:00.000Z', homeCode: 'J2', awayCode: 'J4' },
  { num: 45, date: '2026-06-23T20:00:00.000Z', homeCode: 'K1', awayCode: 'K3' },
  { num: 46, date: '2026-06-23T23:00:00.000Z', homeCode: 'K2', awayCode: 'K4' },
  { num: 47, date: '2026-06-23T17:00:00.000Z', homeCode: 'L1', awayCode: 'L3' },
  { num: 48, date: '2026-06-24T02:00:00.000Z', homeCode: 'L2', awayCode: 'L4' },
  { num: 49, date: '2026-06-24T22:00:00.000Z', homeCode: 'A1', awayCode: 'A4' },
  { num: 50, date: '2026-06-24T22:00:00.000Z', homeCode: 'A2', awayCode: 'A3' },
  { num: 51, date: '2026-06-24T19:00:00.000Z', homeCode: 'B1', awayCode: 'B4' },
  { num: 52, date: '2026-06-24T19:00:00.000Z', homeCode: 'B2', awayCode: 'B3' },
  { num: 53, date: '2026-06-25T01:00:00.000Z', homeCode: 'C1', awayCode: 'C4' },
  { num: 54, date: '2026-06-25T01:00:00.000Z', homeCode: 'C2', awayCode: 'C3' },
  { num: 55, date: '2026-06-25T20:00:00.000Z', homeCode: 'D1', awayCode: 'D4' },
  { num: 56, date: '2026-06-25T20:00:00.000Z', homeCode: 'D2', awayCode: 'D3' },
  { num: 57, date: '2026-06-25T23:00:00.000Z', homeCode: 'E1', awayCode: 'E4' },
  { num: 58, date: '2026-06-25T23:00:00.000Z', homeCode: 'E2', awayCode: 'E3' },
  { num: 59, date: '2026-06-26T02:00:00.000Z', homeCode: 'F1', awayCode: 'F4' },
  { num: 60, date: '2026-06-26T02:00:00.000Z', homeCode: 'F2', awayCode: 'F3' },
  { num: 61, date: '2026-06-26T19:00:00.000Z', homeCode: 'G1', awayCode: 'G4' },
  { num: 62, date: '2026-06-26T19:00:00.000Z', homeCode: 'G2', awayCode: 'G3' },
  { num: 63, date: '2026-06-27T03:00:00.000Z', homeCode: 'H1', awayCode: 'H4' },
  { num: 64, date: '2026-06-27T03:00:00.000Z', homeCode: 'H2', awayCode: 'H3' },
  { num: 65, date: '2026-06-27T00:00:00.000Z', homeCode: 'I1', awayCode: 'I4' },
  { num: 66, date: '2026-06-27T00:00:00.000Z', homeCode: 'I2', awayCode: 'I3' },
  { num: 67, date: '2026-06-27T21:00:00.000Z', homeCode: 'J1', awayCode: 'J4' },
  { num: 68, date: '2026-06-27T21:00:00.000Z', homeCode: 'J2', awayCode: 'J3' },
  { num: 69, date: '2026-06-28T02:00:00.000Z', homeCode: 'K1', awayCode: 'K4' },
  { num: 70, date: '2026-06-28T02:00:00.000Z', homeCode: 'K2', awayCode: 'K3' },
  { num: 71, date: '2026-06-27T23:30:00.000Z', homeCode: 'L1', awayCode: 'L4' },
  { num: 72, date: '2026-06-27T23:30:00.000Z', homeCode: 'L2', awayCode: 'L3' },
];
