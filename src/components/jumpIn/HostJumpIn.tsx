import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { native, useAnimatedValue, useReduceMotion } from '../../motion';
import { alpha, colors, fonts } from '../../theme';
import { ChevronIcon } from '../ui';

type Props = {
  /** Shows the tip. It stays up until tapped; turning it on again replays the jump. */
  visible: boolean;
  /** The balloon's bold first line. */
  title: string;
  body?: string;
  /** Called once the host has hopped out after a tap. */
  onDismiss: () => void;
};

const ENTER_MS = 900;
const EXIT_MS = 450;
const HOST_W = 196;
const HOST_H = 179;

/**
 * A tutorial-style tip over the whole screen: the screen dims, the host jumps in from the bottom
 * left with a squash on landing, and a speech balloon pops out above it. A tap anywhere sends the
 * host hopping back out and lifts the dim. Mount it last inside the screen so it covers everything.
 */
export function HostJumpIn({ visible, title, body, onDismiss }: Props) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const enter = useAnimatedValue(0);
  const exit = useAnimatedValue(0);
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);

  useEffect(() => {
    if (!visible) return;
    exit.setValue(0);
    if (reduce) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const a = Animated.timing(enter, { toValue: 1, duration: ENTER_MS, easing: Easing.linear, useNativeDriver: native });
    a.start();
    // A light bump as it lands.
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), ENTER_MS * 0.55);
    return () => {
      a.stop();
      clearTimeout(t);
    };
  }, [visible, reduce, enter, exit]);

  const dismiss = () => {
    if (reduce) {
      setShown(false);
      onDismiss();
      return;
    }
    Animated.timing(exit, { toValue: 1, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: native }).start(({ finished }) => {
      if (!finished) return;
      setShown(false);
      onDismiss();
    });
  };

  if (!shown) return null;

  // Enter: peek from behind the left edge, leap up and right, land with a squash, settle.
  const at = (input: number[], output: number[]) => enter.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });
  // Exit: a little wind-up, then a hop back out to the left.
  const out = (output: number[]) => exit.interpolate({ inputRange: [0, 0.2, 1], outputRange: output });
  const fade = (from: number, to: number) => at([from, to], [0, 1]);

  const hostX = Animated.add(at([0, 0.08, 0.35, 0.55], [-170, -170, -50, 0]), out([0, 10, -200]));
  const hostY = Animated.add(at([0, 0.08, 0.35, 0.55], [30, 30, -96, 0]), out([0, 0, -30]));
  const hostTurn = at([0, 0.08, 0.35, 0.55], [14, 14, 10, 0]);
  const exitTurn = out([0, -6, -14]);
  const leave = exit.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityViewIsModal
      accessibilityLabel={`${title}${body ? ` ${body}` : ''}. Tap to continue`}
      onPress={dismiss}
      style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#080612', 0.62), opacity: Animated.multiply(fade(0, 0.2), exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })) }]} />

      <Animated.View
        style={[
          s.balloon,
          {
            maxWidth: width - 188,
            opacity: Animated.multiply(fade(0.6, 0.7), leave),
            transform: [{ scale: Animated.multiply(at([0.6, 0.72, 0.8], [0.6, 1.08, 1]), exit.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0.6], extrapolate: 'clamp' })) }],
          },
        ]}
      >
        <Text style={s.title}>{title}</Text>
        {body ? <Text style={s.body}>{body}</Text> : null}
        {/* Tail pointing down-left at the host. */}
        <View style={s.tail} />
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: -4,
          bottom: 4,
          width: HOST_W,
          height: HOST_H,
          transformOrigin: 'bottom',
          transform: [
            { translateX: hostX },
            { translateY: hostY },
            { rotate: hostTurn.interpolate({ inputRange: [0, 14], outputRange: ['0deg', '14deg'] }) },
            { rotate: exitTurn.interpolate({ inputRange: [-14, 0], outputRange: ['-14deg', '0deg'] }) },
            { scaleX: at([0, 0.08, 0.35, 0.55, 0.7], [1.06, 1.06, 0.92, 1.15, 1]) },
            { scaleY: at([0, 0.08, 0.35, 0.55, 0.7], [0.9, 0.9, 1.1, 0.85, 1]) },
          ],
        }}
      >
        <Image source={require('../../../assets/wizard-host.webp')} contentFit="contain" style={{ width: HOST_W, height: HOST_H }} />
      </Animated.View>

      <Animated.View style={[s.hint, { opacity: Animated.multiply(fade(0.8, 1), leave) }]}>
        <Text style={s.hintText}>Tap to continue</Text>
        <ChevronIcon color={colors.beard} size={14} />
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  balloon: {
    position: 'absolute',
    left: 172,
    bottom: 182,
    transformOrigin: 'left bottom',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.text,
  },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { marginTop: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.borderStrong },
  tail: {
    position: 'absolute',
    left: 10,
    bottom: -9,
    width: 18,
    height: 18,
    backgroundColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
  hint: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  hintText: { fontFamily: fonts.bold, fontSize: 13, color: colors.beard },
});
