import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Enter, Pop, SparkleBurst } from '../components/Effects';
import { HatWizard } from '../components/HatWizard';
import { Avatar, ChevronIcon, GhostButton, MuteButton, RoundButton, styles } from '../components/ui';
import { ROSTER, Seat } from '../game/useGame';
import { native, useAnimatedValue, usePulse, useReduceMotion } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

/** How long (ms) after searching starts each rival "connects". Local stand-in for a matchmaking server. */
const JOIN_AT = [900, 1800, 2700, 3500];

export function MatchmakingScreen({ onMatched, onCancel }: { onMatched: (roster: Seat[]) => void; onCancel: () => void }) {
  const rivals = ROSTER.slice(1);
  const [found, setFound] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const matched = found === rivals.length;

  useEffect(() => {
    const timers = JOIN_AT.map((ms, i) =>
      setTimeout(() => {
        setFound(i + 1);
        playSfx('vote');
        Haptics.selectionAsync();
      }, ms + Math.random() * 400),
    );
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!matched) return;
    playSfx('sparkle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => onMatched(ROSTER), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  return (
    <View style={[styles.screen, { justifyContent: 'space-between' }]}>
      <View style={styles.topBar}>
        <RoundButton label="Back to menu" onPress={onCancel}>
          <ChevronIcon dir="left" size={18} />
        </RoundButton>
        <Text style={[styles.eyebrow, { color: colors.gold }]}>Ranked match</Text>
        <MuteButton />
      </View>

      <View style={{ alignItems: 'center', gap: 18 }}>
        <Portal active={!matched}>
          <SparkleBurst trigger={matched ? 1 : 0} count={20} radius={150} />
          <HatWizard size={140} mood={matched ? 'cheer' : 'think'} aura={false} />
        </Portal>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Pop key={matched ? 'found' : 'search'} from={0.8}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: matched ? colors.gold : colors.text, textAlign: 'center' }}>
              {matched ? 'Match found!' : 'Finding rivals…'}
            </Text>
          </Pop>
          <Text style={[styles.body, { textAlign: 'center', fontVariant: ['tabular-nums'] }]}>
            {matched ? 'The Hat is preparing your first riddle' : `Searching · 0:${String(elapsed).padStart(2, '0')} · ${found} of ${rivals.length} found`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <SeatSlot seat={ROSTER[0]} />
        {rivals.map((p, i) => (
          <SeatSlot key={p.id} seat={i < found ? p : undefined} />
        ))}
      </View>

      <Enter delay={300}>
        {matched ? (
          <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.eyebrow, { color: colors.magic }]}>Starting…</Text>
          </View>
        ) : (
          <GhostButton label="Cancel search" onPress={onCancel} />
        )}
      </Enter>
    </View>
  );
}

/** Two counter-rotating rune rings plus radar pulses, framing whatever sits inside. */
function Portal({ active, children }: { active: boolean; children: ReactNode }) {
  const size = 250;
  const reduce = useReduceMotion();
  const spin = useAnimatedValue(0);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: active ? 9000 : 3000, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [spin, active, reduce]);
  const cw = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ccw = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const c = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {active && [0, 1, 2].map((i) => <Ping key={i} delay={i * 700} size={size * 0.62} />)}
      <Animated.View style={{ position: 'absolute', transform: [{ rotate: cw }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={c - 4} stroke={alpha(colors.gold, 0.55)} strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" fill="none" />
          <Circle cx={c} cy={4} r={4} fill={colors.gold} />
        </Svg>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', transform: [{ rotate: ccw }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={c - 26} stroke={alpha(colors.magic, 0.5)} strokeWidth={1.5} strokeDasharray="18 8 4 8" fill="none" />
          <Circle cx={c} cy={size - 26} r={3.5} fill={colors.magic} />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: alpha(colors.aura, 0.14) }} />
      {children}
    </View>
  );
}

function Ping({ delay, size }: { delay: number; size: number }) {
  const v = usePulse(2100, true, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: 2,
        borderColor: colors.magic,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.6] }) }],
      }}
    />
  );
}

function SeatSlot({ seat }: { seat?: Seat }) {
  const pulse = usePulse(1400, !seat);
  return (
    <View style={{ alignItems: 'center', gap: 6, width: 62 }}>
      {seat ? (
        <Pop from={0.3}>
          <Avatar initials={seat.initials} color={seat.color} size={54} ring={seat.isYou ? colors.magic : colors.bg} />
        </Pop>
      ) : (
        <Animated.View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          }}
        >
          <Text style={{ fontFamily: fonts.number, fontSize: 20, color: colors.dim }}>?</Text>
        </Animated.View>
      )}
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12, color: seat ? colors.text : colors.dim }}>
        {seat ? (seat.isYou ? 'You' : seat.name) : 'Searching'}
      </Text>
    </View>
  );
}
