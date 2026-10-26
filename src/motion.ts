import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/** The native driver isn't available on web; Animated falls back to JS there. */
export const native = Platform.OS !== 'web';

let reduceMotion = false;
const listeners = new Set<() => void>();
const setReduce = (v: boolean) => {
  reduceMotion = v;
  listeners.forEach((l) => l());
};
AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);

/** Synchronous read for code that runs outside React (e.g. initial state). */
export const prefersReducedMotion = () => reduceMotion;

export function useReduceMotion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => reduceMotion,
  );
}

// react-native-web doesn't ship useAnimatedValue, so these stand in on every platform.
/** A stable Animated.Value for the component's lifetime. */
export function useAnimatedValue(initial: number) {
  return useState(() => new Animated.Value(initial))[0];
}

export function useAnimatedValueXY(initial: { x: number; y: number }) {
  return useState(() => new Animated.ValueXY(initial))[0];
}

/** A 0→1→0 ping-pong loop. Stops (and rests at 0) while `enabled` is false. */
export function usePulse(duration: number, enabled = true, delay = 0) {
  const v = useAnimatedValue(0);
  const reduce = useReduceMotion();
  useEffect(() => {
    if (!enabled || reduce) {
      v.setValue(0);
      return;
    }
    const half = (toValue: number) =>
      Animated.timing(v, { toValue, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: native });
    const loop = Animated.loop(Animated.sequence([half(1), half(0)]));
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [duration, enabled, reduce, delay, v]);
  return v;
}

/** 0→1 once on mount (after `delay`), for entrances. Jumps straight to 1 with reduced motion. */
export function useEntrance(delay = 0, duration = 520) {
  const reduce = prefersReducedMotion();
  const v = useAnimatedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [delay, duration, reduce, v]);
  return v;
}

/** Tweens a displayed integer from `from` to `to` — for scores and the big reveal number. */
export function useCountUp(to: number, { from = 0, duration = 1100, delay = 0, enabled = true } = {}) {
  const run = enabled && !prefersReducedMotion();
  const [shown, setShown] = useState(run ? from : to);
  useEffect(() => {
    if (!run) return;
    const v = new Animated.Value(from);
    const id = v.addListener(({ value }) => setShown(Math.round(value)));
    const a = Animated.timing(v, { toValue: to, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [to, from, duration, delay, run]);
  return run ? shown : to;
}

/** Deterministic pseudo-random sequence so decorative layouts don't reshuffle on re-render. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
