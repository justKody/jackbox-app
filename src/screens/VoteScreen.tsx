import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Enter, SparkleBurst } from '../components/Effects';
import { ArrowIcon, Avatar, HostBubble, QuestionCard, styles, TopBar } from '../components/ui';
import { VOTE_SECONDS } from '../game/useGame';
import { useCountdown } from '../game/useCountdown';
import type { Call, Player, Question } from '../game/types';
import { native, useAnimatedValue, usePulse } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts, shade } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  guesser: Player;
  guess: number;
  voters: Player[];
  votes: Record<string, Call>;
  onVote: (call: Call) => void;
  onTimeUp: () => void;
};

export function VoteScreen({ question, round, total, guesser, guess, voters, votes, onVote, onTimeUp }: Props) {
  const youAreGuesser = guesser.isYou;
  const myCall = votes['you'];
  const lockedCount = voters.filter((p) => votes[p.id]).length;
  const allIn = lockedCount === voters.length;
  const seconds = useCountdown(VOTE_SECONDS, `${question.id}-vote`, true, onTimeUp);
  const glow = usePulse(2400);
  const [writing, setWriting] = useState(!youAreGuesser);
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

  const [mood, line] = allIn
    ? (['cast', 'All calls are in… let’s reveal!'] as const)
    : writing
      ? (['cast', 'A new riddle for you…'] as const)
    : youAreGuesser
      ? (['think', `Everyone is betting on your ${guess}%. Fingers crossed…`] as const)
      : myCall
        ? (['happy', `Bold! You called ${myCall}. Waiting on the others…`] as const)
        : seconds <= 5
          ? (['shock', 'Tick tock! Higher or lower?'] as const)
          : // The guess and who made it sit right under the question, the Hat doesn't repeat them.
            (['idle', ''] as const);

  return (
    <View style={styles.screen}>
      <TopBar round={round} total={total} seconds={seconds} duration={VOTE_SECONDS} />

      <HostBubble mood={mood} bubbleKey={line} look={!myCall && !youAreGuesser && !allIn ? { x: 0, y: 1 } : undefined} size={70}>
        {line}
      </HostBubble>

      {/* If you guessed, you already watched this question being written on the guess screen. */}
      <QuestionCard text={question.text} compact animate={!youAreGuesser} onWritingChange={setWriting} />

      {/* Who has locked in now shows on the player table, so the guess takes the middle. */}
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Enter delay={150} scale>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar initials={guesser.initials} color={guesser.color} size={24} />
              <Text style={styles.eyebrow}>{youAreGuesser ? 'Your guess' : `${guesser.name}’s guess`}</Text>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
                }}
              >
                <Svg width={240} height={130}>
                  <Defs>
                    <RadialGradient id="guessGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                      <Stop offset="0" stopColor={colors.gold} stopOpacity={0.3} />
                      <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx={120} cy={65} rx={120} ry={65} fill="url(#guessGlow)" />
                </Svg>
              </Animated.View>
              <View style={styles.bigNumberRow}>
                <Text style={[styles.bigNumber, { fontSize: 80, lineHeight: 88 }]}>{guess}</Text>
                <Text style={[styles.bigNumber, { fontSize: 36 }]}>%</Text>
              </View>
            </View>
          </View>
        </Enter>

        {!youAreGuesser && (
          <Enter delay={260}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <CallButton call="higher" mine={myCall} onPress={() => pick('higher')} />
              <CallButton call="lower" mine={myCall} onPress={() => pick('lower')} />
            </View>
          </Enter>
        )}
      </View>
    </View>
  );
}

function CallButton({ call, mine, onPress }: { call: Call; mine?: Call; onPress: () => void }) {
  const color = call === 'higher' ? colors.higher : colors.lower;
  const ink = call === 'higher' ? colors.higherInk : colors.lowerInk;
  const selected = mine === call;
  const faded = !!mine && !selected;
  const fg = selected ? ink : faded ? colors.dim : color;
  const bob = usePulse(1100, !mine);
  const press = useAnimatedValue(0);
  const [burst, setBurst] = useState(0);
  const dir = call === 'higher' ? -1 : 1;
  const H = 104;

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
      style={{ flex: 1, height: H + 6, opacity: faded ? 0.45 : 1 }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H + 6, borderRadius: 22, backgroundColor: selected ? shade(color, -0.45) : colors.surfaceAlt }} />
      <Animated.View
        style={{
          height: H,
          borderRadius: 22,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          overflow: 'hidden',
          backgroundColor: selected ? color : alpha(color, 0.1),
          borderColor: selected ? shade(color, 0.4) : faded ? colors.border : alpha(color, 0.65),
          transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
        }}
      >
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 5 * dir] }) }] }}>
          <ArrowIcon dir={call === 'higher' ? 'up' : 'down'} color={fg} size={32} />
        </Animated.View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: fg }}>{call === 'higher' ? 'Higher' : 'Lower'}</Text>
      </Animated.View>
      <SparkleBurst trigger={burst} count={12} radius={80} colorsList={[color, '#FFFFFF', colors.gold]} />
    </Pressable>
  );
}
