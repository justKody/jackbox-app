import { useEffect, useId } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { native, seeded, useAnimatedValue, useAnimatedValueXY, useReduceMotion } from '../motion';
import { colors } from '../theme';

/**
 * The Hat — the game's host, drawn entirely in code.
 *
 * Every part lives on its own SVG layer sharing one 200×200 grid, so each can be
 * animated independently with native-driver transforms: the body breathes and sways,
 * the eyes blink and glance around, the feathers flutter, the wand arm waves and
 * throws sparkles from its tip.
 */
export type HatMood = 'idle' | 'wave' | 'cast' | 'think' | 'happy' | 'cheer' | 'sad' | 'shock';

type Props = {
  size?: number;
  mood?: HatMood;
  /** Where the eyes look, each axis -1..1. Omit to let the Hat glance around on its own. */
  look?: { x: number; y: number };
  /** Soft glow behind the Hat so its dark fabric reads on the night background. */
  aura?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

const GRID = 200;
/** transformOrigin for a point on the 200 grid, as % of the layer. */
const origin = (x: number, y: number) => `${(x / GRID) * 100}% ${(y / GRID) * 100}%`;

type MoodRig = {
  bob: number; // px on the 200 grid
  bobMs: number;
  sway: number; // degrees
  swayMs: number;
  wand: [number, number]; // rotate range, degrees
  wandMs: number;
  lean: number; // resting tilt, degrees
  sink: number; // resting vertical offset
  sparkles: boolean;
  wave: boolean;
};

const RIGS: Record<HatMood, MoodRig> = {
  idle: { bob: 3, bobMs: 2600, sway: 2.5, swayMs: 4200, wand: [-6, 4], wandMs: 2400, lean: 0, sink: 0, sparkles: false, wave: false },
  wave: { bob: 4, bobMs: 1800, sway: 3, swayMs: 3000, wand: [-8, 6], wandMs: 1800, lean: 0, sink: 0, sparkles: true, wave: true },
  cast: { bob: 4, bobMs: 1400, sway: 3.5, swayMs: 2200, wand: [-26, 14], wandMs: 520, lean: -2, sink: 0, sparkles: true, wave: false },
  think: { bob: 2, bobMs: 3200, sway: 4, swayMs: 5200, wand: [-3, 3], wandMs: 3000, lean: 4, sink: 0, sparkles: false, wave: false },
  happy: { bob: 7, bobMs: 900, sway: 4, swayMs: 1800, wand: [-20, 16], wandMs: 700, lean: 0, sink: 0, sparkles: true, wave: true },
  cheer: { bob: 14, bobMs: 620, sway: 5, swayMs: 1240, wand: [-34, 22], wandMs: 420, lean: 0, sink: 0, sparkles: true, wave: true },
  sad: { bob: 1.5, bobMs: 3800, sway: 1.5, swayMs: 6000, wand: [2, 6], wandMs: 3600, lean: -6, sink: 8, sparkles: false, wave: false },
  shock: { bob: 2, bobMs: 260, sway: 1, swayMs: 400, wand: [-40, -30], wandMs: 300, lean: 0, sink: -6, sparkles: false, wave: false },
};

export function HatWizard({ size = 120, mood = 'idle', look, aura = true, onPress, style }: Props) {
  const reduce = useReduceMotion();
  const rig = RIGS[mood];
  const u = size / GRID; // px per grid unit
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const bob = useAnimatedValue(0);
  const sway = useAnimatedValue(0);
  const wand = useAnimatedValue(0);
  const flutter = useAnimatedValue(0);
  const wave = useAnimatedValue(0);
  const blink = useAnimatedValue(1);
  const glance = useAnimatedValueXY({ x: 0, y: 0 });
  const pose = useAnimatedValueXY({ x: 0, y: 0 }); // x = lean deg, y = sink
  const hop = useAnimatedValue(0);
  const auraPulse = useAnimatedValue(0);

  // Body, wand and feather loops — re-tuned whenever the mood changes.
  useEffect(() => {
    Animated.spring(pose, { toValue: { x: rig.lean, y: rig.sink }, friction: 6, tension: 80, useNativeDriver: native }).start();
    if (reduce) return;
    const pingPong = (v: Animated.Value, ms: number, ease = Easing.inOut(Easing.sin)) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms / 2, easing: ease, useNativeDriver: native }),
          Animated.timing(v, { toValue: 0, duration: ms / 2, easing: ease, useNativeDriver: native }),
        ]),
      );
    const loops = [
      pingPong(bob, rig.bobMs, mood === 'cheer' ? Easing.out(Easing.quad) : undefined),
      pingPong(sway, rig.swayMs),
      pingPong(wand, rig.wandMs),
      pingPong(flutter, 1700),
      pingPong(auraPulse, 3200),
      ...(rig.wave ? [pingPong(wave, 560)] : []),
    ];
    loops.forEach((l) => l.start());
    if (!rig.wave) wave.setValue(0);
    return () => loops.forEach((l) => l.stop());
  }, [mood, reduce, rig, bob, sway, wand, flutter, wave, pose, auraPulse]);

  // Blinks at irregular, human-ish intervals (with the odd double-blink).
  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const once = () =>
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.08, duration: 70, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.timing(blink, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      ]);
    const schedule = () => {
      t = setTimeout(() => {
        (Math.random() < 0.2 ? Animated.sequence([once(), once()]) : once()).start(schedule);
      }, 1800 + Math.random() * 3200);
    };
    schedule();
    return () => clearTimeout(t);
  }, [reduce, blink]);

  // Eyes: follow `look` when given, otherwise glance around now and then.
  const lookX = look?.x;
  const lookY = look?.y;
  useEffect(() => {
    const moodLook = mood === 'think' ? { x: -0.7, y: -0.8 } : mood === 'sad' ? { x: 0, y: 0.8 } : null;
    if (lookX !== undefined && lookY !== undefined) {
      Animated.spring(glance, { toValue: { x: lookX, y: lookY }, friction: 7, tension: 120, useNativeDriver: native }).start();
      return;
    }
    if (moodLook || reduce) {
      Animated.spring(glance, { toValue: moodLook ?? { x: 0, y: 0 }, friction: 7, tension: 80, useNativeDriver: native }).start();
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      const target = Math.random() < 0.45 ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 1.4 - 0.6 };
      Animated.spring(glance, { toValue: target, friction: 8, tension: 90, useNativeDriver: native }).start();
      t = setTimeout(next, 1200 + Math.random() * 2200);
    };
    next();
    return () => clearTimeout(t);
  }, [lookX, lookY, mood, reduce, glance]);

  const tap = () => {
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 160, useNativeDriver: native }),
    ]).start();
    onPress?.();
  };

  // --- Interpolations (all in px) ---
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -rig.bob * u] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -22 * u] });
  const squash = bob.interpolate({ inputRange: [0, 0.15, 1], outputRange: mood === 'cheer' ? [0.9, 1, 1.03] : [1.02, 1, 0.99] });
  const swayDeg = sway.interpolate({ inputRange: [0, 1], outputRange: [`${-rig.sway}deg`, `${rig.sway}deg`] });
  const leanDeg = pose.x.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
  const sinkY = pose.y.interpolate({ inputRange: [-10, 10], outputRange: [-10 * u, 10 * u] });
  const wandDeg = wand.interpolate({ inputRange: [0, 1], outputRange: [`${rig.wand[0]}deg`, `${rig.wand[1]}deg`] });
  const waveDeg = wave.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '22deg'] });
  const featherDeg = flutter.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] });
  const leafDeg = flutter.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '-5deg'] });
  const pupilX = glance.x.interpolate({ inputRange: [-1, 1], outputRange: [-3.2 * u, 3.2 * u], extrapolate: 'clamp' });
  const pupilY = glance.y.interpolate({ inputRange: [-1, 1], outputRange: [-2.6 * u, 2.6 * u], extrapolate: 'clamp' });
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - rig.bob / 40] });
  const auraScale = auraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const auraOpacity = auraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  const happyEyes = mood === 'happy' || mood === 'cheer';
  const layer = { width: size, height: size };
  const abs = [StyleSheet.absoluteFill, layer];

  const body = (
    <View style={[layer, style]} pointerEvents={onPress ? 'auto' : 'none'} accessible={false}>
      {aura && (
        <Animated.View style={[abs, { opacity: auraOpacity, transform: [{ scale: auraScale }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id={`aura${id}`} cx="50%" cy="58%" r="50%">
                <Stop offset="0" stopColor={colors.aura} stopOpacity={0.42} />
                <Stop offset="0.55" stopColor={colors.magic} stopOpacity={0.1} />
                <Stop offset="1" stopColor={colors.aura} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={100} cy={112} r={98} fill={`url(#aura${id})`} />
          </Svg>
        </Animated.View>
      )}

      {/* Ground shadow stays put while the body bobs above it. */}
      <Animated.View style={[abs, { transform: [{ scaleX: shadowScale }] }]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Ellipse cx={100} cy={190} rx={62} ry={6} fill="#000" opacity={0.45} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          abs,
          {
            transformOrigin: origin(100, 176),
            transform: [{ translateY: bobY }, { translateY: hopY }, { translateY: sinkY }, { rotate: leanDeg }, { rotate: swayDeg }, { scaleY: squash }],
          },
        ]}
      >
        {/* Wand arm — behind the brim, pivots at the shoulder. */}
        <Animated.View style={[abs, { transformOrigin: origin(46, 160), transform: [{ rotate: wandDeg }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id={`tip${id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="0.35" stopColor={colors.magic} stopOpacity={0.9} />
                <Stop offset="1" stopColor={colors.magic} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Path d="M 50 162 Q 32 164 26 148" stroke="#6A5EA0" strokeWidth={9.5} strokeLinecap="round" fill="none" />
            <Path d="M 50 162 Q 32 164 26 148" stroke={colors.fabric} strokeWidth={7} strokeLinecap="round" fill="none" />
            <Path d="M 29 166 L 17 88" stroke={colors.leatherDeep} strokeWidth={5.5} strokeLinecap="round" />
            <Path d="M 29 166 L 17 88" stroke={colors.leather} strokeWidth={3} strokeLinecap="round" />
            <Path d="M 17 88 C 9 82 13 70 21 72 C 27 74 26 82 20 81" stroke={colors.leather} strokeWidth={3.4} strokeLinecap="round" fill="none" />
            <Circle cx={18} cy={76} r={13} fill={`url(#tip${id})`} />
            <Path d="M 18 68 C 18.6 74 20 75.4 26 76 C 20 76.6 18.6 78 18 84 C 17.4 78 16 76.6 10 76 C 16 75.4 17.4 74 18 68 Z" fill="#FFFFFF" />
            <Path d="M 18 150 C 16 141 22 136 28 139 C 33 141 34 148 30 152 C 26 156 19 155 18 150 Z" fill="#3A3360" stroke="#6A5EA0" strokeWidth={1.4} />
            <Path d="M 29 142 C 33 140 35 143 33 146" stroke="#6A5EA0" strokeWidth={1.4} strokeLinecap="round" fill="none" />
          </Svg>
          {rig.sparkles && !reduce
            ? SPARKLES.map(({ key, ...s }) => <WandSparkle key={key} at={{ x: 18 * u, y: 76 * u }} {...s} u={u} />)
            : null}
        </Animated.View>

        {/* Hat: cone, brim, band, buckle. */}
        <View style={abs}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id={`cone${id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#4D4570" />
                <Stop offset="0.45" stopColor={colors.fabric} />
                <Stop offset="1" stopColor={colors.fabricDeep} />
              </LinearGradient>
              <LinearGradient id={`brim${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1A1629" />
                <Stop offset="0.6" stopColor="#2E2748" />
                <Stop offset="1" stopColor="#433A66" />
              </LinearGradient>
              <LinearGradient id={`band${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#A06C42" />
                <Stop offset="1" stopColor={colors.leatherDeep} />
              </LinearGradient>
            </Defs>

            {/* Brim */}
            <Path
              d="M 12 158 C 12 141 58 135 100 135 C 142 135 190 141 190 158 C 190 172 146 180 100 180 C 54 180 12 172 12 158 Z"
              fill={`url(#brim${id})`}
              stroke="#5A4F86"
              strokeWidth={1.2}
            />
            <Path d="M 22 164 C 50 176 150 176 180 164" stroke="#6E62A3" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.55} />

            {/* Cone, with its tip folding over to the right */}
            <Path
              d="M 50 152 C 54 114 70 72 96 46 C 112 30 136 18 158 22 C 178 26 188 44 184 64 C 182 74 176 82 168 88 C 170 76 168 66 160 58 C 150 50 138 56 135 72 C 131 94 142 126 150 152 Z"
              fill={`url(#cone${id})`}
              stroke="#6A5EA0"
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
            {/* Fold shading & fabric creases */}
            <Path d="M 160 58 C 150 50 138 56 135 72 C 142 62 152 60 160 64 Z" fill={colors.fabricDeep} opacity={0.75} />
            <Path d="M 72 82 C 66 102 62 120 60 140" stroke="#5B5285" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.6} />
            <Path d="M 120 36 C 112 42 104 52 98 60" stroke="#5B5285" strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.5} />

            {/* Leather band + stitching */}
            <Path d="M 51 134 C 80 143 120 143 147 134 L 150 151 C 120 160 80 160 50 151 Z" fill={`url(#band${id})`} />
            <Path d="M 53 138 C 80 146 120 146 146 138" stroke="#D9A574" strokeWidth={0.9} strokeDasharray="3 3" fill="none" opacity={0.7} />
            <Path d="M 52 148 C 80 156 120 156 148 148" stroke="#D9A574" strokeWidth={0.9} strokeDasharray="3 3" fill="none" opacity={0.7} />

            {/* Brass buckle */}
            <Rect x={87} y={136} width={27} height={20} rx={4} fill="none" stroke={colors.goldDeep} strokeWidth={5} />
            <Rect x={87} y={136} width={27} height={20} rx={4} fill="none" stroke={colors.gold} strokeWidth={2.6} />
            <Path d="M 100 139 L 100 153" stroke={colors.gold} strokeWidth={2.4} strokeLinecap="round" />
            <Circle cx={91} cy={139} r={1.2} fill="#FFF3C9" />
          </Svg>
        </View>

        {/* Feathers & oak sprig flutter from the band. */}
        <Animated.View style={[abs, { transformOrigin: origin(140, 142), transform: [{ rotate: featherDeg }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Path d="M 138 144 C 142 118 160 94 182 80 C 178 102 162 128 142 146 Z" fill="#7F9DC8" />
            <Path d="M 140 141 C 150 120 164 100 180 84" stroke="#C9DCF5" strokeWidth={1.2} fill="none" />
            <Path d="M 141 146 C 154 130 172 118 196 114 C 184 130 164 142 144 148 Z" fill="#E08A3E" />
            <Path d="M 143 146 C 158 136 176 124 194 116" stroke="#FFD29A" strokeWidth={1.1} fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[abs, { transformOrigin: origin(140, 146), transform: [{ rotate: leafDeg }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Path d="M 140 146 C 148 140 160 142 164 152 C 156 156 146 154 140 146 Z" fill={colors.leaf} />
            <Path d="M 140 146 L 162 151" stroke={colors.leafDeep} strokeWidth={1} />
            <Path d="M 138 148 C 140 158 148 166 158 166 C 156 158 148 150 138 148 Z" fill="#C7B74E" />
            <Ellipse cx={135} cy={150} rx={5} ry={6} fill="#B07A3E" />
            <Path d="M 129 147 C 131 141 139 141 141 147 Z" fill="#6E4524" />
          </Svg>
        </Animated.View>

        {/* Eyes: sockets + glow blink together; the irises glance inside them. */}
        <Animated.View style={[abs, { transformOrigin: origin(100, 104), transform: [{ scaleY: happyEyes ? 1 : blink }] }]}>
          {happyEyes ? (
            <Svg width={size} height={size} viewBox="0 0 200 200">
              <Circle cx={85} cy={104} r={16} fill={colors.magic} opacity={0.18} />
              <Circle cx={116} cy={104} r={16} fill={colors.magic} opacity={0.18} />
              <Path d="M 76 108 Q 85 94 94 108" stroke={colors.magic} strokeWidth={4.5} strokeLinecap="round" fill="none" />
              <Path d="M 107 108 Q 116 94 125 108" stroke={colors.magic} strokeWidth={4.5} strokeLinecap="round" fill="none" />
            </Svg>
          ) : (
            <>
              <Svg width={size} height={size} viewBox="0 0 200 200">
                <Defs>
                  <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={colors.magic} stopOpacity={0.55} />
                    <Stop offset="1" stopColor={colors.magic} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={85} cy={104} r={19} fill={`url(#glow${id})`} />
                <Circle cx={116} cy={104} r={19} fill={`url(#glow${id})`} />
                <Ellipse cx={85} cy={104} rx={mood === 'shock' ? 12 : 11} ry={mood === 'shock' ? 14 : 13} fill="#0A1626" stroke="#1E3A5A" strokeWidth={1} />
                <Ellipse cx={116} cy={104} rx={mood === 'shock' ? 12 : 11} ry={mood === 'shock' ? 14 : 13} fill="#0A1626" stroke="#1E3A5A" strokeWidth={1} />
              </Svg>
              <Animated.View style={[abs, { transform: [{ translateX: pupilX }, { translateY: pupilY }] }]}>
                <Svg width={size} height={size} viewBox="0 0 200 200">
                  <Defs>
                    <RadialGradient id={`iris${id}`} cx="45%" cy="40%" r="60%">
                      <Stop offset="0" stopColor="#D4FAFF" />
                      <Stop offset="0.45" stopColor={colors.magic} />
                      <Stop offset="1" stopColor={colors.magicDeep} />
                    </RadialGradient>
                  </Defs>
                  {[85, 116].map((cx) => (
                    <G key={cx}>
                      <Ellipse cx={cx} cy={104} rx={8.6} ry={10} fill={`url(#iris${id})`} />
                      <Ellipse cx={cx} cy={105} rx={mood === 'shock' ? 2.6 : 4.2} ry={mood === 'shock' ? 3.2 : 5.2} fill="#06121F" />
                      <Circle cx={cx - 3} cy={100} r={2.8} fill="#FFFFFF" />
                      <Circle cx={cx + 3} cy={108} r={1.3} fill="#FFFFFF" opacity={0.85} />
                    </G>
                  ))}
                </Svg>
              </Animated.View>
            </>
          )}
        </Animated.View>

        {/* Brows + mouth carry the expression. */}
        <View style={abs}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Face mood={mood} />
          </Svg>
        </View>

        {/* Free hand — waves hello when the mood calls for it. */}
        <Animated.View style={[abs, { transformOrigin: origin(160, 168), transform: [{ rotate: waveDeg }] }]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Path d="M 156 172 Q 176 180 183 166" stroke="#6A5EA0" strokeWidth={9.5} strokeLinecap="round" fill="none" />
            <Path d="M 156 172 Q 176 180 183 166" stroke={colors.fabric} strokeWidth={7} strokeLinecap="round" fill="none" />
            <Path d="M 178 164 C 176 155 182 150 188 152 C 194 154 195 162 191 166 C 187 170 179 169 178 164 Z" fill="#3A3360" stroke="#6A5EA0" strokeWidth={1.4} />
            <Path d="M 180 156 C 177 151 180 147 184 150" stroke="#6A5EA0" strokeWidth={1.4} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel="The Hat" hitSlop={6}>
      {body}
    </Pressable>
  );
}

function Face({ mood }: { mood: HatMood }) {
  const brow = '#7FA6D9';
  const brows: Record<HatMood, [string, string]> = {
    idle: ['M 75 88 Q 85 82 95 87', 'M 106 87 Q 116 82 126 88'],
    wave: ['M 75 86 Q 85 79 95 85', 'M 106 85 Q 116 79 126 86'],
    cast: ['M 75 90 Q 85 85 96 88', 'M 105 88 Q 116 85 126 90'],
    think: ['M 75 84 Q 85 76 95 82', 'M 106 89 Q 116 87 126 90'],
    happy: ['M 75 86 Q 85 79 95 85', 'M 106 85 Q 116 79 126 86'],
    cheer: ['M 75 84 Q 85 76 95 82', 'M 106 82 Q 116 76 126 84'],
    sad: ['M 76 88 Q 86 86 95 82', 'M 106 82 Q 115 86 125 88'],
    shock: ['M 75 82 Q 85 74 95 80', 'M 106 80 Q 116 74 126 82'],
  };
  const [l, r] = brows[mood];
  return (
    <G>
      <Path d={l} stroke={brow} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <Path d={r} stroke={brow} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <Mouth mood={mood} />
    </G>
  );
}

function Mouth({ mood }: { mood: HatMood }) {
  const lip = '#6A5EA0';
  switch (mood) {
    case 'happy':
    case 'cheer':
      return (
        <G>
          <Path d="M 89 119 Q 100.5 136 112 119 Z" fill="#240C1C" stroke={lip} strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="M 95 127 Q 100.5 123 106 127 Q 100.5 132 95 127 Z" fill="#F07A9A" />
        </G>
      );
    case 'sad':
      return <Path d="M 93 126 Q 100.5 119 108 126" stroke="#C9BFF0" strokeWidth={2.6} strokeLinecap="round" fill="none" />;
    case 'shock':
      return <Ellipse cx={100.5} cy={124} rx={5} ry={6.5} fill="#240C1C" stroke={lip} strokeWidth={1.2} />;
    case 'think':
      return <Path d="M 95 124 Q 101 121 108 123" stroke="#C9BFF0" strokeWidth={2.6} strokeLinecap="round" fill="none" />;
    default:
      return (
        <G>
          <Path d="M 93 120 Q 100.5 130 108 120 Q 100.5 123 93 120 Z" fill="#240C1C" stroke={lip} strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="M 97 124.5 Q 100.5 123 104 124.5 Q 100.5 127 97 124.5 Z" fill="#F07A9A" />
        </G>
      );
  }
}

// Same spray pattern for every Hat; generated once.
const SPARKLES = (() => {
  const rand = seeded(11);
  return Array.from({ length: 7 }, (_, i) => ({
    key: i,
    dx: (rand() * 2 - 1) * 26,
    dy: -18 - rand() * 30,
    delay: i * 170,
    size: 7 + rand() * 7,
    color: i % 3 === 0 ? colors.gold : i % 3 === 1 ? colors.magic : '#FFFFFF',
  }));
})();

/** A single looping sparkle thrown off the wand tip. */
function WandSparkle({ at, dx, dy, delay, size, color, u }: { at: { x: number; y: number }; dx: number; dy: number; delay: number; size: number; color: string; u: number }) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  const s = size * u * 1.4;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: at.x - s / 2,
        top: at.y - s / 2,
        width: s,
        height: s,
        opacity: t.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx * u] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy * u] }) },
          { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1, 0.3] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '160deg'] }) },
        ],
      }}
    >
      <SparkleShape size={s} color={color} />
    </Animated.View>
  );
}

/** Four-point twinkle star. */
export function SparkleShape({ size, color = '#FFFFFF' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 12 0 C 12.8 8 16 11.2 24 12 C 16 12.8 12.8 16 12 24 C 11.2 16 8 12.8 0 12 C 8 11.2 11.2 8 12 0 Z" fill={color} />
    </Svg>
  );
}
