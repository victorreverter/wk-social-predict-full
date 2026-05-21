import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Match } from '../types';

const formatCountdown = (ms: number): string | null => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return null;
};

export { formatCountdown };

export type LockUrgency = 'info' | 'warning' | 'critical' | 'locked' | null;

export const useMatchLock = (match: Match) => {
  const { isMatchLocked, getTimeUntilLock } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const remaining = getTimeUntilLock(match);
      setTimeRemaining(remaining);

      if (remaining !== null) {
        setFormatted(formatCountdown(remaining));
      } else if (isMatchLocked(match)) {
        setFormatted('Locked');
      } else {
        setFormatted(null);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match, isMatchLocked, getTimeUntilLock]);

  const urgency: LockUrgency = useMemo(() => {
    if (isMatchLocked(match)) return 'locked';
    if (timeRemaining === null) return null;
    if (timeRemaining < 60 * 60 * 1000) return 'critical';
    if (timeRemaining < 6 * 60 * 60 * 1000) return 'warning';
    if (timeRemaining < 24 * 60 * 60 * 1000) return 'info';
    return null;
  }, [timeRemaining, isMatchLocked, match]);

  return {
    isLocked: isMatchLocked(match),
    timeRemaining,
    formatted,
    urgency,
  };
};
