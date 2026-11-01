import { Platform } from 'react-native';

// Browsers refuse to play anything before the first tap or key press.
let unlocked = Platform.OS !== 'web';
const waiting = new Set<() => void>();

export const isAudioUnlocked = () => unlocked;

/** Runs fn once audio can play: right away on native, after the first tap on web. Returns a cancel. */
export function whenUnlocked(fn: () => void) {
  if (unlocked) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => {
    waiting.delete(fn);
  };
}

export function startUnlockWatch() {
  if (unlocked || typeof document === 'undefined') return () => {};
  const stop = () => {
    document.removeEventListener('pointerup', unlock);
    document.removeEventListener('keydown', unlock);
  };
  const unlock = () => {
    unlocked = true;
    stop();
    waiting.forEach((fn) => fn());
    waiting.clear();
  };
  document.addEventListener('pointerup', unlock);
  document.addEventListener('keydown', unlock);
  return stop;
}
