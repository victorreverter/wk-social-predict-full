import type { MappedMatchResult } from '../types/footballData';

const EDGE_FUNCTION_URL = 'https://xrgtoduqrrmfmyxduhab.supabase.co/functions/v1/fetch-wc-results';

interface FetchResult {
  success: boolean;
  updated: number;
  message: string;
  matchDate?: string;
  results?: MappedMatchResult[];
  errors?: string[];
}

let cachedResults: Map<string, { data: FetchResult; timestamp: number }> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(date: string): FetchResult | null {
  const cached = cachedResults.get(date);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCache(date: string, data: FetchResult): void {
  cachedResults.set(date, { data, timestamp: Date.now() });
  if (cachedResults.size > 50) {
    const firstKey = cachedResults.keys().next().value;
    if (firstKey) cachedResults.delete(firstKey);
  }
}

export async function fetchGroupResults(date: string): Promise<FetchResult> {
  const cached = getCached(date);
  if (cached) return { ...cached, message: 'Cached result' };

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, force: false }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        updated: 0,
        message: `Edge function returned ${response.status}: ${errText}`,
        matchDate: date,
        errors: [errText],
      };
    }

    const data = await response.json() as FetchResult;
    setCache(date, data);
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    return {
      success: false,
      updated: 0,
      message: msg,
      matchDate: date,
      errors: [msg],
    };
  }
}

export async function fetchResultsForDate(date: string, force: boolean = false): Promise<FetchResult> {
  if (!force) {
    const cached = getCached(date);
    if (cached) return cached;
  }

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, force }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        updated: 0,
        message: `Edge function returned ${response.status}: ${errText}`,
        matchDate: date,
        errors: [errText],
      };
    }

    const data = await response.json() as FetchResult;
    setCache(date, data);
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    return {
      success: false,
      updated: 0,
      message: msg,
      matchDate: date,
      errors: [msg],
    };
  }
}

export async function fetchAllPendingResults(dates: string[]): Promise<FetchResult> {
  let totalUpdated = 0;
  const allResults: MappedMatchResult[] = [];
  const allErrors: string[] = [];

  for (const date of dates) {
    const result = await fetchResultsForDate(date);
    totalUpdated += result.updated;
    if (result.results) allResults.push(...result.results);
    if (result.errors) allErrors.push(...result.errors);
  }

  return {
    success: allErrors.length === 0,
    updated: totalUpdated,
    message: `Updated ${totalUpdated} matches across ${dates.length} dates`,
    results: allResults,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}

export function invalidateCache(): void {
  cachedResults.clear();
}
