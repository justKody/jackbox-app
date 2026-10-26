import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, Animated, GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { native, useAnimatedValue, usePulse } from '../motion';
import { alpha, colors, fonts, heatColor, heatLabel } from '../theme';
import { SparkleShape } from './HatWizard';

const SWEEP = 270; // degrees of the ring in use; the 90° gap sits at the bottom
const START = -135; // angle of 0%, measured clockwise from 12 o'clock

type Props = {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function CircleDial({ value, onChange, size = 280, disabled = false }: Props) {
  const s = size / 280; // everything is drawn on a 280 grid, then scaled
  const center = size / 2;
  const R = 112 * s;
  const stroke = 22 * s;
  const C = 2 * Math.PI * R;
  const ARC = (C * SWEEP) / 360;

  const color = heatColor(value);
  const [dragging, setDragging] = useState(false);
  const knobScale = useAnimatedValue(1);
  const ripple = usePulse(1200, dragging);

  // Keep latest values for the PanResponder, which is created once.
  const live = useRef({ value, onChange, disabled, origin: { x: 0, y: 0 } });
  live.current.value = value;
  live.current.onChange = onChange;
  live.current.disabled = disabled;

  useEffect(() => {
    Animated.spring(knobScale, {
      toValue: dragging ? 1.25 : 1,
      useNativeDriver: native,
      friction: 6,
      tension: 180,
    }).start();
  }, [dragging, knobScale]);

  const setFromPoint = (x: number, y: number) => {
    const dx = x - center;
    const dy = y - center;
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 at top, clockwise, -180..180
    let next: number;
    if (Math.abs(deg) > SWEEP / 2) {
      // In the bottom gap: stick to whichever end we came from, never wrap around.
      next = live.current.value > 50 ? 100 : 0;
    } else {
      next = clamp(((deg - START) / SWEEP) * 100);
    }
    commit(next);
  };

  const commit = (next: number) => {
    const prev = live.current.value;
    if (next === prev) return;
    if (next === 0 || next === 100) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (Math.floor(next / 5) !== Math.floor(prev / 5)) Haptics.selectionAsync();
    live.current.value = next;
    live.current.onChange(next);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.disabled,
        onMoveShouldSetPanResponder: () => !live.current.disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { pageX, pageY, locationX, locationY } = e.nativeEvent;
          // Page position of the dial's top-left, so moves outside it still track.
          live.current.origin = { x: pageX - locationX, y: pageY - locationY };
          setDragging(true);
          setFromPoint(locationX, locationY);
        },
        onPanResponderMove: (_e, g) => {
          setFromPoint(g.moveX - live.current.origin.x, g.moveY - live.current.origin.y);
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size],
  );

  const theta = ((START + (SWEEP * value) / 100) * Math.PI) / 180;
  const knob = 36 * s;
  const kx = center + R * Math.sin(theta);
  const ky = center - R * Math.cos(theta);

  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = ((START + (SWEEP / 20) * i) * Math.PI) / 180;
    const major = i % 5 === 0;
    const r1 = (major ? 128 : 130) * s;
    const r2 = 138 * s;
    return {
      key: i,
      x1: center + r1 * Math.sin(a),
      y1: center - r1 * Math.cos(a),
      x2: center + r2 * Math.sin(a),
      y2: center - r2 * Math.cos(a),
      lit: i * 5 <= value,
      major,
    };
  });

  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') commit(clamp(value + 1));
    if (e.nativeEvent.actionName === 'decrement') commit(clamp(value - 1));
  };

  return (
    <View style={{ width: size, height: size }}>
      <View
        {...pan.panHandlers}
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Your guess in percent"
        accessibilityValue={{ min: 0, max: 100, now: value, text: `${value} percent` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onA11yAction}
      >
        <Svg width={size} height={size} pointerEvents="none">
          <Defs>
            <RadialGradient id="orb" cx="50%" cy="42%" r="55%">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="0.7" stopColor={colors.surface} stopOpacity={0.9} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          {/* Crystal-ball disc behind the number */}
          <Circle cx={center} cy={center} r={R - stroke / 2 - 8 * s} fill="url(#orb)" stroke={alpha(color, 0.25)} strokeWidth={1.5} />
          {ticks.map((t) => (
            <Line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.lit ? color : t.major ? colors.borderStrong : colors.tickOff}
              strokeWidth={(t.major ? 3 : 2) * s}
              strokeLinecap="round"
            />
          ))}
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke={colors.track}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${C}`}
            rotation={135}
            origin={`${center}, ${center}`}
          />
          {value > 0 && (
            <>
              {/* Soft glow under the lit arc */}
              <Circle
                cx={center}
                cy={center}
                r={R}
                fill="none"
                stroke={color}
                strokeOpacity={0.25}
                strokeWidth={stroke + 12 * s}
                strokeLinecap="round"
                strokeDasharray={`${(ARC * value) / 100} ${C}`}
                rotation={135}
                origin={`${center}, ${center}`}
              />
              <Circle
                cx={center}
                cy={center}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(ARC * value) / 100} ${C}`}
                rotation={135}
                origin={`${center}, ${center}`}
              />
            </>
          )}
        </Svg>

        {/* Ripple while dragging */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            left: kx - knob / 2,
            top: ky - knob / 2,
            borderWidth: 2,
            borderColor: color,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [dragging ? 0.8 : 0, 0] }),
            transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            {
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              left: kx - knob / 2,
              top: ky - knob / 2,
              borderColor: color,
              shadowColor: color,
              transform: [{ scale: knobScale }],
            },
          ]}
        >
          <SparkleShape size={knob * 0.5} color={color} />
        </Animated.View>

        <View pointerEvents="none" style={[styles.center, { top: 70 * s }]}>
          <View style={styles.numberRow}>
            <Text style={[styles.number, { color, fontSize: 96 * s, lineHeight: 104 * s }]}>{value}</Text>
            <Text style={[styles.percent, { color, fontSize: 40 * s }]}>%</Text>
          </View>
          <View style={[styles.heatPill, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.4) }]}>
            <Text style={[styles.heat, { color }]}>{heatLabel(value)}</Text>
          </View>
        </View>

        <Text pointerEvents="none" style={[styles.endLabel, { left: 44 * s, top: 248 * s }]}>0</Text>
        <Text pointerEvents="none" style={[styles.endLabel, { right: 38 * s, top: 248 * s }]}>100</Text>
      </View>

      {/* Fine-tune buttons sit in the ring's bottom gap, above the pan surface. */}
      <View style={[styles.steppers, { top: 228 * s, left: center - 50 }]}>
        <Stepper label="−" a11y="Decrease by 1" disabled={disabled} onPress={() => commit(clamp(value - 1))} />
        <Stepper label="+" a11y="Increase by 1" disabled={disabled} onPress={() => commit(clamp(value + 1))} />
      </View>
    </View>
  );
}

function Stepper({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.stepper, pressed && { backgroundColor: colors.track, transform: [{ scale: 0.92 }] }]}
    >
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  knob: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline' },
  number: { fontFamily: fonts.number, fontVariant: ['tabular-nums'] },
  percent: { fontFamily: fonts.number },
  heatPill: { marginTop: 4, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  heat: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  endLabel: { position: 'absolute', fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  steppers: { position: 'absolute', flexDirection: 'row', gap: 8 },
  stepper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: colors.text, fontSize: 22, fontFamily: fonts.bold },
});
