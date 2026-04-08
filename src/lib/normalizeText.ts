/**
 * Normalizes a player name for accent-insensitive, case-insensitive comparison.
 * "Mbappé" === "Mbappe", "Müller" === "Muller", etc.
 */
export const normalizeForMatch = (s: string): string =>
    s.trim()
     .normalize('NFD')                     // decompose accented chars
     .replace(/[\u0300-\u036f]/g, '')       // strip combining diacritics
     .toLowerCase()
     .replace(/[^a-z0-9\s]/g, '')           // remove remaining special chars (hyphens etc.)
     .replace(/\s+/g, ' ')                  // collapse whitespace
     .trim();
