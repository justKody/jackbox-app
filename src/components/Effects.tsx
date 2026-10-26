import { ReactNode, useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { native, prefersReducedMotion, seeded, useAnimatedValue, useEntrance, usePulse } from '../motion';
import { colors } from '../theme';
import { SparkleShape } from './HatWizard';

const BURST_COLORS = [colors.gold, colors.magic, '#FFFFFF', colors.aura];

/**
 * A ring of sparkles that bursts outward from the centre of its parent.
 * Fires every time `trigger` changes to a new truthy value.
 */
export function SparkleBurst({ trigger, count = 14, radius = 90, colorsList = BURST_COLORS }: { trigger: number; count?: number; radius?: number; colorsList?: string[] }) {
  const t = useAnimatedValue(0);
  // Seeded by the trigger, so each burst is different but rendering stays pure.
  const parts = useMemo(() => {
    if (!trigger) return [];
    const rand = seeded(trigger * 7919 + count);
    return Array.from({ length: count }, (_, i) => ({
      a: (i / count) * Math.PI * 2 + rand() * 0.4,
      d: radius * (0.55 + rand() * 0.6),
      s: 8 + rand() * 10,
      c: colorsList[i % colorsList.length],
      spin: rand() < 0.5 ? -1 : 1,
    }));
  }, [trigger, count, radius, colorsList]);

  useEffect(() => {
    if (!trigger || prefersReducedMotion()) return;
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [trigger, t]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {parts.map((p, i) => (
        <Animated.View
          key={`${trigger}-${i}`}
          style={{
            position: 'absolute',
            opacity: t.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.a) * p.d] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.a) * p.d] }) },
              { scale: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1.1, 0.4] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 180}deg`] }) },
            ],
          }}
        >
          <SparkleShape size={p.s} color={p.c} />
        </Animated.View>
      ))}
    </View>
  );
}

const CONFETTI = [colors.gold, colors.magic, colors.lower, colors.leaf, colors.aura, '#FFFFFF', colors.higher];

/** Paper-and-star confetti that rains over the whole screen for a few seconds. */
export function Confetti({ count = 34, duration = 3600 }: { count?: number; duration?: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => {
    const rand = seeded(count * 31 + Math.round(width));
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      x: rand() * width,
      delay: rand() * 900,
      ms: duration * (0.65 + rand() * 0.5),
      drift: (rand() * 2 - 1) * 60,
      spin: (rand() < 0.5 ? -1 : 1) * (360 + rand() * 540),
      color: CONFETTI[i % CONFETTI.length],
      star: i % 4 === 0,
      w: 7 + rand() * 5,
      h: 10 + rand() * 8,
    }));
  }, [count, duration, width]);
  if (prefersReducedMotion()) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map(({ key, ...p }) => (
        <ConfettiPiece key={key} {...p} height={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({ x, delay, ms, drift, spin, color, star, w, h, height }: { x: number; delay: number; ms: number; drift: number; spin: number; color: string; star: boolean; w: number; h: number; height: number }) {
  const v = useAnimatedValue(0);
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: ms, delay, easing: Easing.in(Easing.quad), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, ms, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: -30,
        opacity: v.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, drift, -drift * 0.4, drift * 0.6] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] }) },
          { rotateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '360deg'] }) },
        ],
      }}
    >
      {star ? <SparkleShape size={h + 4} color={color} /> : <View style={{ width: w, height: h, borderRadius: 2, backgroundColor: color }} />}
    </Animated.View>
  );
}

/** Fades + slides its children in on mount; stagger siblings with `delay`. */
export function Enter({ delay = 0, from = 16, scale = false, style, children }: { delay?: number; from?: number; scale?: boolean; style?: ViewStyle | ViewStyle[]; children: ReactNode }) {
  const v = useEntrance(delay);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
            ...(scale ? [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] : []),
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Springs from small to full size on mount — use with a changing `key` to re-pop. */
export function Pop({ children, from = 0.5, style }: { children: ReactNode; from?: number; style?: ViewStyle }) {
  const reduce = prefersReducedMotion();
  const v = useAnimatedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    Animated.spring(v, { toValue: 1, friction: 5, tension: 160, useNativeDriver: native }).start();
  }, [v, reduce]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Three bouncing dots for "still thinking" states. */
export function ThinkingDots({ color = colors.muted }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center', height: 10 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = usePulse(840, true, delay);
  return (
    <Animated.View
      style={{
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [1.5, -2.5] }) }],
      }}
    />
  );
}
