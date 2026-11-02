import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Counts down from `seconds` while `active`. Restarts whenever `resetKey` changes.
 * Calls `onExpire` once when it hits zero, always the latest one passed in.
 */
export function useCountdown(seconds: number, resetKey: unknown, active: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const expire = useEffectEvent(onExpire);

  // A new round (or length) starts the clock over, in the same render rather than one late.
  const [clock, setClock] = useState({ seconds, resetKey });
  if (clock.seconds !== seconds || clock.resetKey !== resetKey) {
    setClock({ seconds, resetKey });
    setLeft(seconds);
  }

  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const startLeft = seconds;
    let fired = false;
    const id = setInterval(() => {
      const next = Math.max(0, startLeft - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0 && !fired) {
        fired = true;
        clearInterval(id);
        expire();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, resetKey, active]);

  return left;
}

export const formatClock = (s: number) => `0:${String(s).padStart(2, '0')}`;
