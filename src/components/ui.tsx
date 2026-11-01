import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useEffectEvent, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { native, prefersReducedMotion, useAnimatedValue, usePulse, useReduceMotion } from '../motion';
import { playSfx, setSoundPanelOpen, useSoundSettings } from '../sound';
import { alpha, colors, fonts, radii, shade } from '../theme';
import { Pop } from './Effects';
import { HatMood, HatWizard, SparkleShape } from './HatWizard';

// ─── Top bar ────────────────────────────────────────────────────────────────

export function TopBar({ round, total, seconds, duration, label }: { round: number; total: number; seconds?: number; duration?: number; label?: string }) {
  return (
    <View style={styles.topBar}>
      <View style={{ gap: 6 }}>
        <Text style={styles.eyebrow}>
          Round {round} <Text style={{ color: colors.dim }}>of {total}</Text>
        </Text>
        <RoundPips round={round} total={total} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SoundButton />
        {seconds !== undefined ? (
          <TimerRing seconds={seconds} duration={duration ?? seconds} />
        ) : (
          <View style={styles.pill}>
            <SparkleShape size={11} color={colors.gold} />
            <Text style={[styles.pillText, { fontSize: 13 }]}>{label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** One little star per round: gold when done, glowing for the current one. */
function RoundPips({ round, total }: { round: number; total: number }) {
  const glow = usePulse(1600);
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        if (n === round)
          return (
            <Animated.View key={i} style={{ transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }] }}>
              <SparkleShape size={14} color={colors.magic} />
            </Animated.View>
          );
        return n < round ? (
          <SparkleShape key={i} size={11} color={colors.gold} />
        ) : (
          <View key={i} style={{ width: 11, height: 11, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.tickOff }} />
          </View>
        );
      })}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Countdown ring that drains smoothly between whole-second ticks. */
function TimerRing({ seconds, duration }: { seconds: number; duration: number }) {
  const size = 46;
  const r = 19;
  const C = 2 * Math.PI * r;
  const progress = useAnimatedValue(seconds / duration);
  const urgent = seconds <= 5;
  const beat = usePulse(500, urgent);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, (seconds - 1) / duration),
      duration: seconds > 0 ? 1000 : 0,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [seconds, duration, progress]);

  const color = urgent ? colors.danger : colors.magic;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${seconds} seconds left`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r + 3} fill={urgent ? colors.dangerBg : colors.surface} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={3.5} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.pillText, { color: urgent ? colors.danger : colors.text, fontSize: 15 }]}>{seconds}</Text>
    </Animated.View>
  );
}

/** Top-right speaker: opens the sound panel. Shows crossed out when nothing will play. */
export function SoundButton() {
  const { muted, music, effects } = useSoundSettings();
  const silent = muted || (music === 0 && effects === 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={silent ? 'Sound settings, sound off' : 'Sound settings'}
      hitSlop={8}
      onPress={() => setSoundPanelOpen(true)}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <SpeakerIcon muted={silent} color={silent ? colors.dim : colors.text} />
    </Pressable>
  );
}

// ─── The Hat as host ────────────────────────────────────────────────────────

/** The Hat with a speech bubble — it narrates each phase. Tap the Hat for a little cheer. */
export function HostBubble({ mood, children, bubbleKey, look, size = 76 }: { mood: HatMood; children: ReactNode; bubbleKey: string; look?: { x: number; y: number }; size?: number }) {
  const [override, setOverride] = useState<HatMood | null>(null);
  useEffect(() => {
    if (!override) return;
    const t = setTimeout(() => setOverride(null), 1300);
    return () => clearTimeout(t);
  }, [override]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <HatWizard
        size={size}
        mood={override ?? mood}
        look={override ? undefined : look}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playSfx('sparkle');
          setOverride('cheer');
        }}
      />
      {/* No line, no bubble: the Hat just watches. */}
      {children ? (
        <Pop key={bubbleKey} from={0.7} style={{ flex: 1 }}>
          <View style={styles.bubble}>
            <View style={styles.bubbleTail} />
            <Text style={styles.bubbleText}>{children}</Text>
          </View>
        </Pop>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

// ─── Question scroll ────────────────────────────────────────────────────────

const TYPE_MS = 30;
const PAUSE_MS = 200;

/**
 * The question, written onto a parchment scroll that unrolls from its centre.
 * `onWritingChange` lets the screen sync the Hat's spell-casting to the typing.
 */
export function QuestionCard({ text, compact = false, animate = true, onWritingChange }: { text: string; compact?: boolean; animate?: boolean; onWritingChange?: (writing: boolean) => void }) {
  const reduce = useReduceMotion();
  const run = animate && !reduce;
  const [h, setH] = useState(0);
  const [ready, setReady] = useState(!run);
  const [shown, setShown] = useState(run ? 0 : text.length);
  const unroll = useAnimatedValue(run ? 0 : 1);

  useEffect(() => {
    if (!run || !h) return;
    Animated.timing(unroll, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.2)), useNativeDriver: native }).start(() => setReady(true));
  }, [run, h, unroll]);

  useEffect(() => {
    if (!ready || shown >= text.length) return;
    const delay = /[,.?!:;]/.test(text[shown - 1] ?? '') ? PAUSE_MS : TYPE_MS;
    const t = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [shown, text, ready]);

  const writing = run && shown < text.length;
  const notify = useEffectEvent((w: boolean) => onWritingChange?.(w));
  useEffect(() => notify(writing), [writing]);
  useEffect(() => {
    if (run) playSfx('sparkle');
  }, [run, text]);

  const half = h / 2;
  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);

  return (
    <View style={{ opacity: h || !run ? 1 : 0 }}>
      <Animated.View style={{ zIndex: 2, transform: [{ translateY: unroll.interpolate({ inputRange: [0, 1], outputRange: [half, 0] }) }] }}>
        <ScrollRoll />
      </Animated.View>
      <Animated.View onLayout={onLayout} style={[styles.paper, compact && styles.paperCompact, { transform: [{ scaleY: unroll.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) }] }]}>
        <ParchmentTexture />
        {/* The unwritten rest stays in the layout (transparent) so the scroll never grows or re-wraps mid-sentence. */}
        <Text accessibilityLabel={text} style={[styles.question, compact && styles.questionCompact]}>
          {text.slice(0, shown)}
          <Text style={{ color: 'transparent' }}>{text.slice(shown)}</Text>
        </Text>
      </Animated.View>
      <Animated.View style={{ zIndex: 2, transform: [{ translateY: unroll.interpolate({ inputRange: [0, 1], outputRange: [-half, 0] }) }] }}>
        <ScrollRoll />
      </Animated.View>
    </View>
  );
}

function ScrollRoll() {
  return (
    <View style={{ height: 14, justifyContent: 'center' }}>
      <Svg width="100%" height={14} style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 14">
        <Defs>
          <LinearGradient id="roll" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F6E6BF" />
            <Stop offset="0.45" stopColor={colors.parchmentEdge} />
            <Stop offset="1" stopColor="#7E5E33" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={1} width={100} height={12} rx={6} fill="url(#roll)" />
      </Svg>
      <View style={[styles.rollCap, { left: -4 }]} />
      <View style={[styles.rollCap, { right: -4 }]} />
    </View>
  );
}

function ParchmentTexture() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="vignette" cx="50%" cy="45%" r="75%">
          <Stop offset="0.55" stopColor={colors.parchmentDeep} stopOpacity={0} />
          <Stop offset="1" stopColor="#B48A4E" stopOpacity={0.45} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#vignette)" />
    </Svg>
  );
}

// ─── Small parts ────────────────────────────────────────────────────────────

export function Avatar({ initials, color, size = 34, ring = colors.bg }: { initials: string; color: string; size?: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: Math.max(2, size * 0.06),
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', top: 2, left: size * 0.2, right: size * 0.2, height: size * 0.32, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: colors.ink }}>{initials}</Text>
    </View>
  );
}

export function Chip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <View style={[styles.chip, { backgroundColor: ok ? colors.okBg : colors.track, borderColor: ok ? alpha(colors.okText, 0.35) : 'transparent' }]}>
      {typeof children === 'string' ? <Text style={[styles.chipText, { color: ok ? colors.okText : colors.muted }]}>{children}</Text> : children}
    </View>
  );
}

/**
 * Chunky, tactile game button: a darker "lip" underneath that the face presses into,
 * a glossy top highlight and a slow shimmer sweeping across.
 */
export function PrimaryButton({
  label,
  onPress,
  color = colors.gold,
  icon,
  style,
  height = 60,
  textColor = colors.ink,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: ReactNode;
  style?: ViewStyle;
  height?: number;
  textColor?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    color = colors.track;
    textColor = colors.dim;
  }
  const press = useAnimatedValue(0);
  const shimmer = useAnimatedValue(0);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!w || disabled || prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay(2200),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w, shimmer, disabled]);

  const to = (v: number) => Animated.spring(press, { toValue: v, friction: 6, tension: 300, useNativeDriver: native }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={[{ height: height + 5 }, style]}
    >
      <View style={[styles.lip, { height: height + 5, backgroundColor: shade(color, -0.42) }]} />
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[styles.face, { height, backgroundColor: color, transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }]}
      >
        <View style={[styles.gloss, { height: height * 0.5 }]} />
        {w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              { height: height * 2, transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, w + 80] }) }, { rotate: '20deg' }] },
            ]}
          />
        )}
        {icon}
        <Text style={[styles.primaryText, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Quiet outlined button for secondary actions (cancel, back to menu). */
export function GhostButton({ label, onPress, icon, style }: { label: string; onPress: () => void; icon?: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && { backgroundColor: colors.surfaceRaised, transform: [{ scale: 0.98 }] }, style]}
    >
      {icon}
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

/** Round icon-only button, matching the mute button. */
export function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

/**
 * Big main-menu entry. `primary` is the gold, shimmering hero card; the other variant is a
 * velvet card with a magic-cyan edge. Both press into a lip like the game buttons.
 */
export function MenuCard({
  title,
  subtitle,
  icon,
  badge,
  primary = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  badge?: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const press = useAnimatedValue(0);
  const shimmer = useAnimatedValue(0);
  const [w, setW] = useState(0);
  const face = primary ? colors.gold : colors.surfaceRaised;
  const ink = primary ? colors.ink : colors.text;
  const sub = primary ? alpha(colors.ink, 0.7) : colors.muted;
  const H = 92;

  useEffect(() => {
    if (!primary || !w || prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay(2600),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [primary, w, shimmer]);

  const to = (v: number) => Animated.spring(press, { toValue: v, friction: 6, tension: 300, useNativeDriver: native }).start();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(0)} style={{ height: H + 6 }}>
      <View style={[styles.lip, { height: H + 6, borderRadius: 22, backgroundColor: primary ? shade(colors.gold, -0.45) : colors.surfaceAlt }]} />
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[
          styles.menuFace,
          {
            height: H,
            backgroundColor: face,
            borderColor: primary ? shade(colors.gold, 0.35) : alpha(colors.magic, 0.35),
            transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
          },
        ]}
      >
        {primary && <View style={[styles.gloss, { height: H * 0.48 }]} />}
        {primary && w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.shimmer, { height: H * 2, transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, w + 80] }) }, { rotate: '20deg' }] }]}
          />
        )}
        <View style={[styles.menuIcon, { backgroundColor: primary ? alpha(colors.ink, 0.12) : alpha(colors.magic, 0.12), borderColor: primary ? alpha(colors.ink, 0.15) : alpha(colors.magic, 0.3) }]}>
          {icon}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.menuTitle, { color: ink }]}>{title}</Text>
            {badge ? (
              <View style={[styles.menuBadge, { backgroundColor: primary ? colors.ink : alpha(colors.magic, 0.18) }]}>
                <Text style={[styles.menuBadgeText, { color: primary ? colors.gold : colors.magic }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.menuSub, { color: sub }]}>{subtitle}</Text>
        </View>
        <ChevronIcon color={ink} />
      </Animated.View>
    </Pressable>
  );
}

export function SectionHeader({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SparkleShape size={10} color={colors.gold} />
        <Text style={styles.eyebrow}>{left}</Text>
      </View>
      {right ? <Text style={styles.eyebrow}>{right}</Text> : null}
    </View>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

export function ArrowIcon({ dir, color, size = 34 }: { dir: 'up' | 'down'; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      {dir === 'up' ? (
        <>
          <Path d="M12 19V5" />
          <Path d="M5 12l7-7 7 7" />
        </>
      ) : (
        <>
          <Path d="M12 5v14" />
          <Path d="M19 12l-7 7-7-7" />
        </>
      )}
    </Svg>
  );
}

export function LockIcon({ color = colors.ink }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function WandIcon({ color = colors.ink, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20L15 9" />
      <Path d="M17 3v4M15 5h4M20 9v2M19 10h2M11 3v2M10 4h2" />
    </Svg>
  );
}

export function TrophyIcon({ color = colors.ink, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <Path d="M17 6h2.5a1.5 1.5 0 0 1 0 3H17M7 6H4.5a1.5 1.5 0 0 0 0 3H7" />
    </Svg>
  );
}

export function UsersIcon({ color = colors.magic, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </Svg>
  );
}

export function ChevronIcon({ color = colors.text, dir = 'right', size = 20 }: { color?: string; dir?: 'right' | 'left'; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
    </Svg>
  );
}

export function ShareIcon({ color = colors.text, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v12M7 8l5-5 5 5" />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Svg>
  );
}

export function CloseIcon({ color = colors.text, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function SpeakerIcon({ muted, color, size = 18 }: { muted: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 5L6 9H3v6h3l5 4V5z" />
      {muted ? (
        <>
          <Path d="M16 9l5 6" />
          <Path d="M21 9l-5 6" />
        </>
      ) : (
        <>
          <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <Path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </Svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },

  bubble: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  bubbleTail: {
    position: 'absolute',
    left: -6,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },

  paper: {
    marginHorizontal: 8,
    marginVertical: -4,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: colors.parchment,
    overflow: 'hidden',
  },
  paperCompact: { paddingVertical: 14, paddingHorizontal: 16 },
  rollCap: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.leather, borderWidth: 1.5, borderColor: colors.leatherDeep },
  question: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.parchmentInk },
  questionCompact: { fontSize: 19, lineHeight: 24 },

  chip: { flexDirection: 'row', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, minWidth: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chipText: { fontFamily: fonts.bold, fontSize: 12 },

  lip: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 18 },
  face: { borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.1)' },
  shimmer: { position: 'absolute', left: 0, top: -30, width: 36, backgroundColor: 'rgba(255,255,255,0.35)' },
  primaryText: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: 0.2 },

  ghost: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: alpha(colors.surface, 0.7),
  },
  ghostText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },

  menuFace: { borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, overflow: 'hidden' },
  menuIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  menuTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  menuSub: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  menuBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999 },
  menuBadgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: alpha(colors.surface, 0.85),
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  bigNumberRow: { flexDirection: 'row', alignItems: 'baseline' },
  bigNumber: { fontFamily: fonts.number, color: colors.gold, fontVariant: ['tabular-nums'] },
});
