import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Enter, SparkleBurst } from '../components/Effects';
import { AnimalSwatch } from '../avatar/AnimalSwatch';
import { useSeatLook } from '../avatar/store';
import { ArrowIcon, HostQuestion, styles, TopBar } from '../components/ui';
import { useCountdown } from '../game/useCountdown';
import type { Call, Player, Question } from '../game/types';
import { native, useAnimatedValue, usePulse } from '../motion';
import { playSfx } from '../sound';
import { colors, fonts, shade } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  /** Seconds to make a call, from the game's rules (the server's, when online). */
  duration: number;
  guesser: Player;
  guess: number;
  voters: Player[];
  votes: Record<string, Call>;
  onVote: (call: Call) => void;
  onTimeUp: () => void;
};

export function VoteScreen({ question, round, total, duration, guesser, guess, voters, votes, onVote, onTimeUp }: Props) {
  const youAreGuesser = guesser.isYou;
  const myCall = votes['you'];
  const lockedCount = voters.filter((p) => votes[p.id]).length;
  const allIn = lockedCount === voters.length;
  const seconds = useCountdown(duration, `${question.id}-vote`, true, onTimeUp);
  const glow = usePulse(2400);
  const seatLook = useSeatLook();
  // Only players who still owe a call hear the clock.
  const waiting = !myCall && !youAreGuesser;
  useEffect(() => {
    if (waiting && seconds > 0 && seconds <= 5) playSfx('tick');
  }, [seconds, waiting]);

  const pick = (call: Call) => {
    if (myCall || youAreGuesser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    playSfx('vote');
    onVote(call);
  };

  const locked = `${lockedCount} of ${voters.length}`;
  const status = allIn
    ? 'All calls are in… let’s reveal!'
    : youAreGuesser
      ? `Everyone is betting on your ${guess}% · ${locked} locked in`
      : myCall
        ? `You called ${myCall} · ${locked} locked in`
        : `${locked} calls locked in`;

  return (
    <View style={styles.screen}>
      <TopBar round={round} total={total} seconds={seconds} duration={duration} label="Call it" />

      {/* If you guessed, you already watched this question being written on the guess screen. */}
      <HostQuestion text={question.text} compact animate={!youAreGuesser} />

      <Enter delay={150} scale>
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AnimalSwatch look={seatLook(guesser)} size={28} />
            <Text style={[styles.body, { fontSize: 14 }]}>{youAreGuesser ? 'Your guess' : `${guesser.name} guessed`}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
              }}
            >
              <Svg width={240} height={110}>
                <Defs>
                  <RadialGradient id="guessGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor={colors.gold} stopOpacity={0.3} />
                    <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={120} cy={55} rx={120} ry={55} fill="url(#guessGlow)" />
              </Svg>
            </Animated.View>
            <View style={styles.bigNumberRow}>
              <Text style={[styles.bigNumber, { fontSize: 80, lineHeight: 88 }]}>{guess}</Text>
              <Text style={[styles.bigNumber, { fontSize: 36 }]}>%</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 17, color: colors.beard }}>
            {youAreGuesser ? 'Will they call it right?' : 'Is the real answer higher or lower?'}
          </Text>
        </View>
      </Enter>

      {/* The guesser has nothing to press, so who's locked in takes the space the buttons would. */}
      {youAreGuesser ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.body, { textAlign: 'center' }]}>{status}</Text>
        </View>
      ) : (
        <>
          <Enter delay={260} style={{ flex: 1, maxHeight: 260 }}>
            <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
              <CallButton call="higher" mine={myCall} onPress={() => pick('higher')} />
              <CallButton call="lower" mine={myCall} onPress={() => pick('lower')} />
            </View>
          </Enter>
          <Text style={[styles.body, { fontSize: 13, textAlign: 'center', marginTop: -6 }]}>{status}</Text>
        </>
      )}
    </View>
  );
}

function CallButton({ call, mine, onPress }: { call: Call; mine?: Call; onPress: () => void }) {
  const color = call === 'higher' ? colors.higher : colors.lower;
  const ink = call === 'higher' ? colors.higherInk : colors.lowerInk;
  const selected = mine === call;
  const faded = !!mine && !selected;
  const bob = usePulse(1100, !mine);
  const press = useAnimatedValue(0);
  const [burst, setBurst] = useState(0);
  const dir = call === 'higher' ? -1 : 1;
  const LIP = 6;

  const to = (v: number) => Animated.spring(press, { toValue: v, friction: 6, tension: 300, useNativeDriver: native }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!mine }}
      accessibilityLabel={call === 'higher' ? 'Higher' : 'Lower'}
      disabled={!!mine}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={() => {
        setBurst((n) => n + 1);
        onPress();
      }}
      style={{ flex: 1, minHeight: 110, opacity: faded ? 0.45 : 1 }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: LIP, bottom: 0, borderRadius: 24, backgroundColor: shade(color, -0.45) }} />
      <Animated.View
        style={{
          flex: 1,
          marginBottom: LIP,
          borderRadius: 24,
          borderWidth: 3,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          overflow: 'hidden',
          backgroundColor: color,
          borderColor: selected ? colors.text : shade(color, 0.25),
          transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
        }}
      >
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 5 * dir] }) }] }}>
          <ArrowIcon dir={call === 'higher' ? 'up' : 'down'} color={ink} size={40} />
        </Animated.View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: ink }}>{call === 'higher' ? 'Higher' : 'Lower'}</Text>
      </Animated.View>
      <SparkleBurst trigger={burst} count={12} radius={80} colorsList={[color, '#FFFFFF', colors.gold]} />
    </Pressable>
  );
}
