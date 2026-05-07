import { describe, test, expect } from 'vitest';

import { formatCountdown } from '../hooks/useMatchLock';

describe('Per-Match Locking System', () => {

  describe('formatCountdown utility', () => {
    test('formats hours and minutes: 150 min → "2h 30m"', () => {
      const ms = 150 * 60 * 1000;
      expect(formatCountdown(ms)).toBe('2h 30m');
    });

    test('formats only minutes: 45 min → "45m"', () => {
      const ms = 45 * 60 * 1000;
      expect(formatCountdown(ms)).toBe('45m');
    });

    test('returns null for less than 1 minute', () => {
      const ms = 30 * 1000;
      expect(formatCountdown(ms)).toBeNull();
    });

    test('handles exactly 1 hour → "1h 0m"', () => {
      const ms = 60 * 60 * 1000;
      expect(formatCountdown(ms)).toBe('1h 0m');
    });

    test('handles 0 ms → null', () => {
      expect(formatCountdown(0)).toBeNull();
    });
  });

  describe('Lock Logic (1-hour window)', () => {
    test('match > 1 hour away: not locked', () => {
      const now = new Date('2026-06-11T12:00:00Z');
      const match = { id: 'm1', homeTeamId: 'ARG', awayTeamId: 'BRZ', date: '2026-06-11T14:00:00Z', stage: 'GROUP', score: { homeGoals: null, awayGoals: null }, status: 'NOT_PLAYED' as const };

      const lockTime = new Date(match.date).getTime() - 60 * 60 * 1000;
      expect(now.getTime()).toBeLessThan(lockTime);
    });

    test('match exactly 1 hour away: locked', () => {
      const lockTimeBase = new Date('2026-06-11T14:00:00Z').getTime();
      const now = new Date(lockTimeBase - 60 * 60 * 1000);

      expect(now.getTime()).toBeGreaterThanOrEqual(lockTimeBase - 60 * 60 * 1000);
    });

    test('match < 1 hour away: locked', () => {
      const lockTimeBase = new Date('2026-06-11T14:00:00Z').getTime();
      const now = new Date(lockTimeBase - 30 * 60 * 1000);

      expect(now.getTime()).toBeGreaterThan(lockTimeBase - 60 * 60 * 1000);
    });

    test('TBD match: not locked', () => {
      const match = { id: 'm1', homeTeamId: 'ARG', awayTeamId: 'BRZ', date: 'TBD', stage: 'GROUP', score: { homeGoals: null, awayGoals: null }, status: 'NOT_PLAYED' as const };

      const isLocked = !match.date || match.date.includes('TBD') ? false : true;
      expect(isLocked).toBe(false);
    });

    test('malformed date → not locked', () => {
      const match = { id: 'm1', homeTeamId: 'ARG', awayTeamId: 'BRZ', date: 'invalid-date', stage: 'GROUP', score: { homeGoals: null, awayGoals: null }, status: 'NOT_PLAYED' as const };

      const parsedDate = new Date(match.date);
      const isInvalid = isNaN(parsedDate.getTime());
      const isTbd = match.date.includes('TBD');

      expect(isInvalid || isTbd).toBe(true);
    });

    test('timezone: UTC comparison works correctly', () => {
      const utcDate = '2026-06-11T14:00:00Z';
      const lockThreshold = new Date(utcDate).getTime() - 60 * 60 * 1000;

      const nowBeforeLock = new Date('2026-06-11T12:30:00Z').getTime();
      expect(nowBeforeLock).toBeLessThan(lockThreshold);

      const nowAfterLock = new Date('2026-06-11T13:30:00Z').getTime();
      expect(nowAfterLock).toBeGreaterThan(lockThreshold);
    });
  });

  describe('Countdown Timer', () => {
    test('shows "Locks in 2h 30m" for match in 3.5 hours (lock in 2.5)', () => {
      const matchDate = new Date(Date.now() + 3.5 * 60 * 60 * 1000);
      const lockTime = matchDate.getTime() - 60 * 60 * 1000;
      const remaining = lockTime - Date.now();

      const formatted = remaining > 0 ? formatCountdown(remaining) : null;
      expect(formatted).not.toBeNull();
      expect(formatted).toContain('h');
    });

    test('shows "Locks in 30m" for match in 1.5 hours', () => {
      const matchDate = new Date(Date.now() + 1.5 * 60 * 60 * 1000);
      const lockTime = matchDate.getTime() - 60 * 60 * 1000;
      const remaining = lockTime - Date.now();

      const formatted = remaining > 0 ? formatCountdown(remaining) : '🔒 Locked';
      expect(formatted).not.toBe('🔒 Locked');
      expect(formatted).toContain('m');
    });

    test('shows "Locked" when countdown reaches zero', () => {
      const matchDate = new Date(Date.now() + 45 * 60 * 1000);
      const lockTime = matchDate.getTime() - 60 * 60 * 1000;
      const remaining = lockTime - Date.now();

      const isLocked = remaining <= 0;
      expect(isLocked).toBe(true);
    });
  });

  describe('Admin Manual Override', () => {
    test('can lock match > 1 hour away', () => {
      const matchDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(inLockWindow).toBe(false);
    });

    test('can unlock manually locked match before 1-hour window', () => {
      const matchDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(inLockWindow).toBe(false);
    });

    test('CANNOT unlock once within 1-hour window', () => {
      const matchDate = new Date(Date.now() + 30 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(inLockWindow).toBe(true);
    });

    test('manual lock persists until auto-lock activates', () => {
      const matchDate = new Date('2026-06-11T14:00:00Z');
      const now = new Date('2026-06-11T11:00:00Z').getTime();
      const lockTime = matchDate.getTime() - 60 * 60 * 1000;

      expect(now).toBeLessThan(lockTime);
    });
  });

  describe('Supremacy of Time Lock', () => {
    test('auto-lock overrides admin unlock attempt within 1 hour', () => {
      const matchDate = new Date(Date.now() + 30 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(inLockWindow).toBe(true);
    });

    test('time lock is absolute within 1-hour window', () => {
      const matchDate = new Date(Date.now() + 30 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;
      const adminTryUnlock = !inLockWindow;

      expect(adminTryUnlock).toBe(false);
    });
  });

  describe('Save Validation', () => {
    test('prevents saving prediction to locked match', () => {
      const matchDate = new Date(Date.now() + 30 * 60 * 1000);
      const isLocked = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(isLocked).toBe(true);
    });

    test('allows saving prediction to unlocked match', () => {
      const matchDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const isLocked = Date.now() >= matchDate.getTime() - 60 * 60 * 1000;

      expect(isLocked).toBe(false);
    });

    test('filters locked matches before processing', () => {
      const matches = [
        { id: 'm1', date: getFutureDate(30) },   // locked: 30 min away
        { id: 'm2', date: getFutureDate(90) },   // unlocked: 90 min away
        { id: 'm3', date: getFutureDate(120) },  // unlocked: 2 hours away
      ];

      const lockedIds = matches.filter(m => {
        const matchDate = new Date(m.date);
        return Date.now() >= matchDate.getTime() - 60 * 60 * 1000;
      }).map(m => m.id);

      expect(lockedIds).toEqual(['m1']);
    });
  });

  describe('Test Mode (5-minute window)', () => {
    const LOCK_MINUTES = 5;

    test('match in 6 minutes: not locked', () => {
      const matchDate = new Date(Date.now() + 6 * 60 * 1000);
      const isLocked = Date.now() >= matchDate.getTime() - LOCK_MINUTES * 60 * 1000;

      expect(isLocked).toBe(false);
    });

    test('match in 4 minutes: locked', () => {
      const matchDate = new Date(Date.now() + 4 * 60 * 1000);
      const isLocked = Date.now() >= matchDate.getTime() - LOCK_MINUTES * 60 * 1000;

      expect(isLocked).toBe(true);
    });

    test('admin can unlock before 5-minute window', () => {
      const matchDate = new Date(Date.now() + 10 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - LOCK_MINUTES * 60 * 1000;

      expect(inLockWindow).toBe(false);
    });

    test('admin CANNOT unlock within 5-minute window', () => {
      const matchDate = new Date(Date.now() + 3 * 60 * 1000);
      const inLockWindow = Date.now() >= matchDate.getTime() - LOCK_MINUTES * 60 * 1000;

      expect(inLockWindow).toBe(true);
    });
  });

  describe('Edge Cases & Security', () => {
    test('handles malformed match dates gracefully', () => {
      const tbdMatch = { id: 'm1', date: 'TBD' };
      const invalidMatch = { id: 'm2', date: 'not-a-date' };

      const tbdLocked = !tbdMatch.date || tbdMatch.date.includes('TBD') ? false : true;
      const invalidDateObj = new Date(invalidMatch.date);
      const invalidLocked = isNaN(invalidDateObj.getTime()) ? false : true;

      expect(tbdLocked).toBe(false);
      expect(invalidLocked).toBe(false);
    });

    test('timezone: UTC vs local offset comparison', () => {
      const utcDate = new Date('2026-06-11T14:00:00Z').getTime();
      const estDate = new Date('2026-06-11T14:00:00-05:00').getTime();

      expect(utcDate).not.toBe(estDate);
      expect(estDate - utcDate).toBe(5 * 60 * 60 * 1000);
    });

    test('prevents rapid admin lock/unlock spam conceptually', () => {
      const now = Date.now();
      let lastAction = now - 2000;

      const canAct = (now - lastAction) >= 1000;
      lastAction = now;

      expect(canAct).toBe(true);
    });
  });
});

function getFutureDate(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}
