import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const API_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') || '924afe845f63492585fe21c0b58bafed';
const COMPETITION_ID = '2000';
const TOURNAMENT_START = '2026-06-11';
const SUPABASE_URL = 'https://xrgtoduqrrmfmyxduhab.supabase.co';

interface RequestBody {
  dateFrom?: string;
  dateTo?: string;
}

interface UpRow {
  match_id: string;
  home_goals: number;
  away_goals: number;
  home_penalties: number | null;
  away_penalties: number | null;
  went_to_pens: boolean;
  status: string;
  updated_at: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      SUPABASE_URL,
      Deno.env.get('PROJECT_SERVICE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body: RequestBody = await req.json().catch(() => ({}));
    const dateFrom = body.dateFrom || TOURNAMENT_START;
    const dateTo = body.dateTo || new Date().toISOString().substring(0, 10);

    const apiUrl = `https://api.football-data.org/v4/competitions/${COMPETITION_ID}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': API_KEY },
    });

    const responseMs = Date.now() - startTime;

    if (!response.ok) {
      const statusCode = response.status;
      const errText = await response.text();
      await logApiCall(supabaseClient, apiUrl, statusCode, responseMs, errText);
      return new Response(
        JSON.stringify({ success: false, updated: 0, message: `API returned ${statusCode}`, dateFrom, dateTo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    const allMatches: Record<string, unknown>[] = data.matches || [];
    const finished = allMatches.filter(m => m.status === 'FINISHED' || m.status === 'AWARDED');

    if (finished.length === 0) {
      await logApiCall(supabaseClient, apiUrl, 200, responseMs, null);
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No finished matches', dateFrom, dateTo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nowISO = new Date().toISOString();
    const groupUpserts: UpRow[] = [];
    const knockoutCandidates: Record<string, unknown>[] = [];
    const skippedKnockouts: Record<string, unknown>[] = [];

    for (const m of finished) {
      const typedM = m as Record<string, unknown>;
      const score = (typedM.score || {}) as Record<string, unknown>;
      const fullTime = (score.fullTime || {}) as Record<string, number | null>;
      const penalties = score.penalties as Record<string, number | null> | null;

      const homeGoals = fullTime.home;
      const awayGoals = fullTime.away;
      if (homeGoals === null || homeGoals === undefined || awayGoals === null || awayGoals === undefined) continue;

      const homeTeam = (typedM.homeTeam || {}) as Record<string, string>;
      const awayTeam = (typedM.awayTeam || {}) as Record<string, string>;
      const homeTLA = homeTeam.tla || '';
      const awayTLA = awayTeam.tla || '';
      if (!homeTLA || !awayTLA) continue;

      const internalHome = FIFA_2026_TEAM_MAP[homeTLA.toUpperCase()];
      const internalAway = FIFA_2026_TEAM_MAP[awayTLA.toUpperCase()];
      if (!internalHome || !internalAway) continue;

      const matchDate = (typedM.utcDate as string || '').substring(0, 10);
      const wentToPens = penalties !== null &&
        (penalties.home !== null || penalties.away !== null);

      const groupFixture = GROUP_FIXTURES.find(f =>
        f.date.startsWith(matchDate) &&
        f.homeCode === internalHome &&
        f.awayCode === internalAway
      );

      if (groupFixture) {
        groupUpserts.push({
          match_id: `m${groupFixture.num}`,
          home_goals: homeGoals,
          away_goals: awayGoals,
          home_penalties: wentToPens ? (penalties!.home ?? null) : null,
          away_penalties: wentToPens ? (penalties!.away ?? null) : null,
          went_to_pens: wentToPens,
          status: 'FINISHED',
          updated_at: nowISO,
        });
      } else {
        knockoutCandidates.push({
          homeTLA: homeTLA.toUpperCase(),
          awayTLA: awayTLA.toUpperCase(),
          internalHome,
          internalAway,
          matchDate,
          utcDate: typedM.utcDate,
          homeGoals,
          awayGoals,
          wentToPens,
          penHome: wentToPens ? (penalties!.home ?? null) : null,
          penAway: wentToPens ? (penalties!.away ?? null) : null,
          homeName: homeTeam.name || homeTLA,
          awayName: awayTeam.name || awayTLA,
        });
      }
    }

    if (groupUpserts.length > 0) {
      const { error: gErr } = await supabaseClient
        .from('official_matches')
        .upsert(groupUpserts, { onConflict: 'match_id' });

      if (gErr) {
        await logApiCall(supabaseClient, apiUrl, 500, responseMs, gErr.message);
        return new Response(
          JSON.stringify({ success: false, updated: 0, message: `Group upsert error: ${gErr.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    let knockoutUpserts: UpRow[] = [];

    if (knockoutCandidates.length > 0) {
      const resolvedMatches = resolveKnockoutBracket(supabaseClient, knockoutCandidates, skippedKnockouts, nowISO);

      if (resolvedMatches.length > 0) {
        const { error: kErr } = await supabaseClient
          .from('official_matches')
          .upsert(resolvedMatches, { onConflict: 'match_id' });

        if (kErr) {
          await logApiCall(supabaseClient, apiUrl, 500, responseMs, kErr.message);
          return new Response(
            JSON.stringify({ success: false, updated: groupUpserts.length, message: `Knockout upsert error: ${kErr.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        knockoutUpserts = resolvedMatches;
      }
    }

    await logApiCall(supabaseClient, apiUrl, 200, responseMs, null);

    const totalUpdated = groupUpserts.length + knockoutUpserts.length;

    return new Response(
      JSON.stringify({
        success: true,
        updated: totalUpdated,
        groupMatches: groupUpserts.length,
        knockoutMatches: knockoutUpserts.length,
        skippedKnockouts: skippedKnockouts.length > 0
          ? skippedKnockouts.map(s => ({
              home: (s as Record<string,unknown>).homeName,
              away: (s as Record<string,unknown>).awayName,
              date: (s as Record<string,unknown>).matchDate,
            }))
          : [],
        message: `Updated ${totalUpdated} matches (${groupUpserts.length} group, ${knockoutUpserts.length} knockout)${skippedKnockouts.length > 0 ? ` — ${skippedKnockouts.length} knockout matches could not be auto-mapped` : ''}`,
        dateFrom,
        dateTo,
        matchIds: [...groupUpserts, ...knockoutUpserts].map(r => r.match_id),
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

async function logApiCall(
  client: ReturnType<typeof createClient>,
  endpoint: string,
  statusCode: number,
  responseMs: number,
  errorMessage: string | null
): Promise<void> {
  try {
    await client.from('football_data_api_log').insert({
      endpoint,
      status_code: statusCode,
      response_ms: responseMs,
      error_message: errorMessage,
    });
  } catch (_) { /* non-critical */ }
}

function resolveKnockoutBracket(
  client: ReturnType<typeof createClient>,
  candidates: Record<string, unknown>[],
  skipped: Record<string, unknown>[],
  nowISO: string
): UpRow[] {
  const result: UpRow[] = [];

  for (const c of candidates) {
    const date = (c.matchDate as string);
    const homeCode = c.internalHome as string;
    const awayCode = c.internalAway as string;

    let matchNum: number | null = null;

    const r32 = R32_FIXTURES.find(f =>
      f.date.startsWith(date) &&
      f.homeCode === homeCode &&
      f.awayCode === awayCode
    );

    if (r32) {
      matchNum = r32.num;
    }

    if (!matchNum) {
      const r16 = R16_FIXTURES.find(f => f.date.startsWith(date));
      if (r16) matchNum = r16.num;
    }

    if (!matchNum) {
      const qf = QF_FIXTURES.find(f => f.date.startsWith(date));
      if (qf) matchNum = qf.num;
    }

    if (!matchNum) {
      const sf = SF_FIXTURES.find(f => f.date.startsWith(date));
      if (sf) matchNum = sf.num;
    }

    if (!matchNum) {
      if (THIRD_PLACE.date.startsWith(date)) matchNum = THIRD_PLACE.num;
      else if (FINAL.date.startsWith(date)) matchNum = FINAL.num;
    }

    if (matchNum) {
      const wentToPens = c.wentToPens as boolean;
      result.push({
        match_id: `m${matchNum}`,
        home_goals: c.homeGoals as number,
        away_goals: c.awayGoals as number,
        home_penalties: wentToPens ? (c.penHome as number | null) : null,
        away_penalties: wentToPens ? (c.penAway as number | null) : null,
        went_to_pens: wentToPens,
        status: 'FINISHED',
        updated_at: nowISO,
      });
    } else {
      skipped.push(c);
    }
  }

  return result;
}

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

const R32_FIXTURES: Array<{ num: number; date: string; homeCode: string; awayCode: string }> = [
  { num: 73, date: '2026-06-28T19:00:00.000Z', homeCode: 'A2', awayCode: 'B2' },
  { num: 74, date: '2026-06-29T20:30:00.000Z', homeCode: 'E1', awayCode: 'T3' },
  { num: 75, date: '2026-06-30T01:00:00.000Z', homeCode: 'F1', awayCode: 'C2' },
  { num: 76, date: '2026-06-29T17:00:00.000Z', homeCode: 'C1', awayCode: 'F2' },
  { num: 77, date: '2026-06-30T21:00:00.000Z', homeCode: 'I1', awayCode: 'T3' },
  { num: 78, date: '2026-06-30T17:00:00.000Z', homeCode: 'E2', awayCode: 'I2' },
  { num: 79, date: '2026-07-01T01:00:00.000Z', homeCode: 'A1', awayCode: 'T3' },
  { num: 80, date: '2026-07-01T16:00:00.000Z', homeCode: 'L1', awayCode: 'T3' },
  { num: 81, date: '2026-07-02T00:00:00.000Z', homeCode: 'D1', awayCode: 'T3' },
  { num: 82, date: '2026-07-01T20:00:00.000Z', homeCode: 'G1', awayCode: 'T3' },
  { num: 83, date: '2026-07-02T23:00:00.000Z', homeCode: 'K2', awayCode: 'L2' },
  { num: 84, date: '2026-07-02T19:00:00.000Z', homeCode: 'H1', awayCode: 'J2' },
  { num: 85, date: '2026-07-03T03:00:00.000Z', homeCode: 'B1', awayCode: 'T3' },
  { num: 86, date: '2026-07-03T22:00:00.000Z', homeCode: 'J1', awayCode: 'H2' },
  { num: 87, date: '2026-07-04T01:30:00.000Z', homeCode: 'K1', awayCode: 'T3' },
  { num: 88, date: '2026-07-03T18:00:00.000Z', homeCode: 'D2', awayCode: 'G2' },
];

const T3_MATCH_NUMS = [79, 85, 81, 74, 82, 77, 87, 80];

const R16_FIXTURES: Array<{ num: number; date: string }> = [
  { num: 89, date: '2026-07-04T21:00:00.000Z' },
  { num: 90, date: '2026-07-04T17:00:00.000Z' },
  { num: 91, date: '2026-07-05T20:00:00.000Z' },
  { num: 92, date: '2026-07-06T00:00:00.000Z' },
  { num: 93, date: '2026-07-06T19:00:00.000Z' },
  { num: 94, date: '2026-07-07T00:00:00.000Z' },
  { num: 95, date: '2026-07-07T16:00:00.000Z' },
  { num: 96, date: '2026-07-07T20:00:00.000Z' },
];

const QF_FIXTURES: Array<{ num: number; date: string }> = [
  { num: 97,  date: '2026-07-09T20:00:00.000Z' },
  { num: 98,  date: '2026-07-10T19:00:00.000Z' },
  { num: 99,  date: '2026-07-11T21:00:00.000Z' },
  { num: 100, date: '2026-07-12T01:00:00.000Z' },
];

const SF_FIXTURES: Array<{ num: number; date: string }> = [
  { num: 101, date: '2026-07-14T19:00:00.000Z' },
  { num: 102, date: '2026-07-15T19:00:00.000Z' },
];

const THIRD_PLACE = { num: 103, date: '2026-07-18T21:00:00.000Z' };
const FINAL        = { num: 104, date: '2026-07-19T20:00:00.000Z' };
