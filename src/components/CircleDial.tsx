import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, Animated, GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { native, useAnimatedValue, usePulse } from '../motion';
import { colors, fonts, heatColor } from '../theme';

const SWEEP = 270; // degrees of the ring in use; the 90° gap sits at the bottom
const START = -135; // angle of 0%, measured clockwise from 12 o'clock

type Props = {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
  /** Someone else's dial: it follows `value` but can't be turned, and has no steppers. */
  readOnly?: boolean;
  /** What a screen reader calls the dial. */
  label?: string;
  /** Someone else's dial: the knob wears their initials in their colour instead of the sparkle. */
  knob?: { label: string; color: string };
  /** A faint glow trailing the knob, so a watcher sees which way it's heading. */
  trail?: boolean;
  /** Shown under the number in place of the heat label, e.g. "Not locked yet". */
  status?: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
/** How far behind the knob its trail reaches, in percent. */
const TRAIL = 12;

export function CircleDial({ value, onChange, size = 280, disabled = false, readOnly = false, label = 'Your guess in percent', knob: owner, trail = false, status }: Props) {
  const s = size / 280; // everything is drawn on a 280 grid, then scaled
  const center = size / 2;
  const R = 112 * s;
  const stroke = 17 * s;
  const C = 2 * Math.PI * R;
  const ARC = (C * SWEEP) / 360;

  const color = heatColor(value);
  const [dragging, setDragging] = useState(false);
  const knobScale = useAnimatedValue(1);
  const ripple = usePulse(1200, dragging);

  // Keep latest values for the PanResponder, which is created once per size.
  const live = useRef({ value, onChange, disabled: disabled || readOnly, origin: { x: 0, y: 0 } });
  useLayoutEffect(() => {
    live.current.value = value;
    live.current.onChange = onChange;
    live.current.disabled = disabled || readOnly;
  });

  useEffect(() => {
    Animated.spring(knobScale, {
      toValue: dragging ? 1.25 : 1,
      useNativeDriver: native,
      friction: 6,
      tension: 180,
    }).start();
  }, [dragging, knobScale]);

  // Everything the gestures touch is built here, so it only reads `live` when a finger moves.
  const { pan, commit } = useMemo(() => {
    const commit = (next: number) => {
      const prev = live.current.value;
      if (next === prev) return;
      if (next === 0 || next === 100) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (Math.floor(next / 5) !== Math.floor(prev / 5)) Haptics.selectionAsync();
      live.current.value = next;
      live.current.onChange(next);
    };

    const setFromPoint = (x: number, y: number) => {
      const dx = x - center;
      const dy = y - center;
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 at top, clockwise, -180..180
      // In the bottom gap: stick to whichever end we came from, never wrap around.
      commit(Math.abs(deg) > SWEEP / 2 ? (live.current.value > 50 ? 100 : 0) : clamp(((deg - START) / SWEEP) * 100));
    };

    // create() only stores these handlers; they read `live` on touches, never during render.
    // eslint-disable-next-line react-hooks/refs
    const pan = PanResponder.create({
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
    });
    return { pan, commit };
  }, [center]);

  const theta = ((START + (SWEEP * value) / 100) * Math.PI) / 180;
  const knob = 36 * s;
  const kx = center + R * Math.sin(theta);
  const ky = center - R * Math.cos(theta);
  // Turns the ring's start (3 o'clock) round to 0%; a transform string, since `origin` leaks onto the DOM on web.
  const ring = `rotate(135 ${center} ${center})`;
  const trailFrom = Math.max(0, value - TRAIL);
  const hint = status ?? (readOnly ? undefined : disabled ? 'Locked in' : 'Drag the knob');

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
        accessibilityRole={readOnly ? 'progressbar' : 'adjustable'}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: value, text: `${value} percent` }}
        accessibilityActions={readOnly ? undefined : [{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onA11yAction}
      >
        <Svg width={size} height={size} pointerEvents="none">
          {/* Dark disc the ring sits on */}
          <Circle cx={center} cy={center} r={R} fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={1} />
          <Circle
            cx={center}
            cy={center}
            r={R}
            fill="none"
            stroke={colors.track}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${C}`}
            transform={ring}
          />
          {value > 0 && (
            <>
              <Circle
                cx={center}
                cy={center}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(ARC * value) / 100} ${C}`}
                transform={ring}
              />
              {trail && (
                <Circle
                  cx={center}
                  cy={center}
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.3}
                  strokeWidth={stroke + 14 * s}
                  strokeLinecap="round"
                  strokeDasharray={`${(ARC * (value - trailFrom)) / 100} ${C}`}
                  strokeDashoffset={-(ARC * trailFrom) / 100}
                  transform={ring}
                />
              )}
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
              // Yours: white with a heat ring. Someone else's: their colour and initials, ringed white.
              borderWidth: 5 * s,
              borderColor: owner ? colors.text : color,
              backgroundColor: owner ? owner.color : colors.text,
              shadowColor: color,
              transform: [{ scale: knobScale }],
            },
          ]}
        >
          {owner && <Text style={{ fontFamily: fonts.bold, fontSize: knob * 0.34, color: colors.ink }}>{owner.label}</Text>}
        </Animated.View>

        <View pointerEvents="none" style={styles.center}>
          <View style={styles.numberRow}>
            <Text style={[styles.number, { color, fontSize: 78 * s, lineHeight: 84 * s }]}>{value}</Text>
            <Text style={[styles.percent, { color, fontSize: 34 * s }]}>%</Text>
          </View>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>

        <Text pointerEvents="none" style={[styles.endLabel, { left: 44 * s, top: 248 * s }]}>0</Text>
        <Text pointerEvents="none" style={[styles.endLabel, { right: 38 * s, top: 248 * s }]}>100</Text>
      </View>

      {/* Fine-tune buttons sit in the ring's bottom gap, above the pan surface. */}
      {!readOnly && (
        <View style={[styles.steppers, { top: 228 * s, left: center - 50 }]}>
          <Stepper label="−" a11y="Decrease by 1" disabled={disabled} onPress={() => commit(clamp(value - 1))} />
          <Stepper label="+" a11y="Increase by 1" disabled={disabled} onPress={() => commit(clamp(value + 1))} />
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline' },
  number: { fontFamily: fonts.number, fontVariant: ['tabular-nums'] },
  percent: { fontFamily: fonts.number },
  hint: { marginTop: 2, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  endLabel: { position: 'absolute', fontFamily: fonts.bold, fontSize: 12, color: colors.dim },
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
