import { useEffect, useRef, useState } from 'react';

/**
 * Counts down from `seconds` while `active`. Restarts whenever `resetKey` changes.
 * Calls `onExpire` once when it hits zero.
 */
export function useCountdown(seconds: number, resetKey: unknown, active: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    setLeft(seconds);
  }, [seconds, resetKey]);

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
        expireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, resetKey, active]);

  return left;
}

export const formatClock = (s: number) => `0:${String(s).padStart(2, '0')}`;
