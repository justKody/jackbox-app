import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { native, seeded, useAnimatedValue, useReduceMotion } from '../motion';
import { colors } from '../theme';
import { SparkleShape } from './HatWizard';

/**
 * The living night sky behind every screen: a deep gradient, two drifting nebulae,
 * twinkling stars, rising motes of magic dust and the occasional shooting star.
 * Everything animates on the native driver, so it costs the JS thread nothing.
 */
export const MagicSky = memo(function MagicSky() {
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();

  const stars = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 42 }, (_, i) => ({
      key: i,
      x: rand() * width,
      y: rand() * height * 0.9,
      r: rand() < 0.15 ? 2.2 : 1 + rand() * 0.9,
      ms: 1800 + rand() * 3200,
      delay: rand() * 3000,
      gold: rand() < 0.2,
    }));
  }, [width, height]);

  const twinkles = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: 6 }, (_, i) => ({
      key: i,
      x: rand() * (width - 40) + 20,
      y: rand() * height * 0.75 + 20,
      size: 10 + rand() * 8,
      ms: 2600 + rand() * 2400,
      delay: rand() * 2000,
    }));
  }, [width, height]);

  const motes = useMemo(() => {
    const rand = seeded(99);
    return Array.from({ length: 10 }, (_, i) => ({
      key: i,
      x: rand() * width,
      size: 3 + rand() * 3,
      ms: 9000 + rand() * 7000,
      delay: rand() * 8000,
      drift: (rand() * 2 - 1) * 40,
      color: rand() < 0.5 ? colors.magic : colors.gold,
    }));
  }, [width]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bgTop} />
            <Stop offset="0.55" stopColor="#120E26" />
            <Stop offset="1" stopColor={colors.bg} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#skyFill)" />
      </Svg>

      <Nebula color={colors.aura} size={width * 1.1} x={-width * 0.35} y={height * 0.08} ms={18000} reduce={reduce} />
      <Nebula color={colors.magic} size={width * 0.9} x={width * 0.4} y={height * 0.55} ms={22000} reduce={reduce} opacity={0.5} />

      {stars.map(({ key, ...s }) => (
        <Star key={key} {...s} reduce={reduce} />
      ))}
      {twinkles.map(({ key, ...t }) => (
        <Twinkle key={key} {...t} reduce={reduce} />
      ))}
      {!reduce && motes.map(({ key, ...m }) => <Mote key={key} {...m} height={height} />)}
      {!reduce && <ShootingStar width={width} height={height} />}
    </View>
  );
});

function useLoop(ms: number, delay: number, reduce: boolean, ease = Easing.inOut(Easing.sin)) {
  const v = useAnimatedValue(0);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms / 2, easing: ease, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: ms / 2, easing: ease, useNativeDriver: native }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, delay, reduce, v]);
  return v;
}

function Nebula({ color, size, x, y, ms, reduce, opacity = 1 }: { color: string; size: number; x: number; y: number; ms: number; reduce: boolean; opacity?: number }) {
  const v = useLoop(ms, 0, reduce);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        opacity,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`neb${color.slice(1)}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.2} />
            <Stop offset="0.6" stopColor={color} stopOpacity={0.06} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#neb${color.slice(1)})`} />
      </Svg>
    </Animated.View>
  );
}

function Star({ x, y, r, ms, delay, gold, reduce }: { x: number; y: number; r: number; ms: number; delay: number; gold: boolean; reduce: boolean }) {
  const v = useLoop(ms, delay, reduce);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: gold ? '#FFE3A3' : '#FFFFFF',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
      }}
    />
  );
}

function Twinkle({ x, y, size, ms, delay, reduce }: { x: number; y: number; size: number; ms: number; delay: number; reduce: boolean }) {
  const v = useLoop(ms, delay, reduce);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.85] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
        ],
      }}
    >
      <SparkleShape size={size} color="#FFF6DD" />
    </Animated.View>
  );
}

function Mote({ x, size, ms, delay, drift, color, height }: { x: number; size: number; ms: number; delay: number; drift: number; color: string; height: number }) {
  const v = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: native }));
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, ms, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: height,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 6,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.8, 0.5, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.85] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift, 0] }) },
        ],
      }}
    />
  );
}

function ShootingStar({ width, height }: { width: number; height: number }) {
  const v = useAnimatedValue(0);
  const [start, setStart] = useState({ x: -200, y: -200 });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    const fire = () => {
      setStart({ x: width * (0.25 + Math.random() * 0.6), y: height * (0.04 + Math.random() * 0.25) });
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: native }).start(() => {
        if (alive) t = setTimeout(fire, 5000 + Math.random() * 7000);
      });
    };
    t = setTimeout(fire, 2500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [v, width, height]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: start.x,
        top: start.y,
        width: 90,
        height: 2,
        borderRadius: 1,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.6, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -180] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }) },
          { rotate: '-31deg' },
        ],
      }}
    >
      <Svg width={90} height={2}>
        <Defs>
          <LinearGradient id="shoot" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={90} height={2} fill="url(#shoot)" />
      </Svg>
    </Animated.View>
  );
}
