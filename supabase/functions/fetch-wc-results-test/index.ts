import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FOOTBALL_DATA_API_KEY = '924afe845f63492585fe21c0b58bafed';

interface RequestBody {
  date?: string;
  force?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const targetDate = body.date || '2022-11-20';

    const apiUrl = `https://api.football-data.org/v4/competitions/2000/matches?dateFrom=${targetDate}&dateTo=${targetDate}`;
    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, message: `API returned ${response.status}`, matchDate: targetDate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    const matches = data.matches || [];
    const finishedMatches = matches.filter((m: Record<string, unknown>) =>
      m.status === 'FINISHED' || m.status === 'AWARDED'
    );

    const mapped: Array<Record<string, unknown>> = [];
    for (const m of finishedMatches) {
      const typedM = m as Record<string, unknown>;
      const homeTeam = (typedM.homeTeam || {}) as Record<string, string>;
      const awayTeam = (typedM.awayTeam || {}) as Record<string, string>;
      const score = (typedM.score || {}) as Record<string, unknown>;
      const fullTime = (score.fullTime || {}) as Record<string, number | null>;

      mapped.push({
        apiId: typedM.id,
        homeName: homeTeam.name || '?',
        awayName: awayTeam.name || '?',
        homeTLA: homeTeam.tla || '?',
        awayTLA: awayTeam.tla || '?',
        internalHome: FIFA_2026_TEAM_MAP[(homeTeam.tla || '').toUpperCase()] || '?',
        internalAway: FIFA_2026_TEAM_MAP[(awayTeam.tla || '').toUpperCase()] || '?',
        homeGoals: fullTime.home,
        awayGoals: fullTime.away,
        date: typedM.utcDate,
        stage: typedM.stage,
        group: typedM.group,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        mappedCount: mapped.length,
        message: `Found ${mapped.length} finished matches for ${targetDate}`,
        matchDate: targetDate,
        matches: mapped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: msg }),
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
