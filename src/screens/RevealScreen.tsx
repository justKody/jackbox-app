import * as Haptics from 'expo-haptics';
import { useEffect, useEffectEvent, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Confetti, SparkleBurst } from '../components/Effects';
import { HostQuestion, styles, TopBar } from '../components/ui';
import { correctCall } from '../game/scoring';
import type { Player, Question, RoundResult } from '../game/types';
import { native, prefersReducedMotion, useAnimatedValue, useCountUp } from '../motion';
import { playSfx } from '../sound';
import { colors, fonts } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  guesser: Player;
  guess: number;
  results: RoundResult[];
  /** Moves on to the standings, which show everyone's points for the round. */
  onNext: () => void;
};

export const SUSPENSE_MS = 1400;
/**
 * How long the answer and verdict stay up before the standings open on their own. Online, the
 * server ends the reveal 15s after it starts, so this leaves the standings most of that.
 */
const ANSWER_MS = 2500;

export function RevealScreen({ question, round, total, guesser, guess, results, onNext }: Props) {
  const answer = question.answer;
  const right = correctCall(guess, answer);
  const off = Math.abs(guess - answer);
  const me = results.find((r) => r.playerId === 'you');
  const [revealed, setRevealed] = useState(prefersReducedMotion());
  const shown = useCountUp(answer, { duration: SUSPENSE_MS - 150 });
  const pop = useAnimatedValue(1);
  const bar = useAnimatedValue(0);

  useEffect(() => {
    if (!revealed) playSfx('drumroll');
    const t = setTimeout(() => setRevealed(true), revealed ? 0 : SUSPENSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealed) return;
    Haptics.notificationAsync(me?.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    playSfx(me?.correct ? 'correct' : 'wrong');
    pop.setValue(1.35);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: native }).start();
    Animated.timing(bar, { toValue: 1, duration: 700, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // Once everyone has seen the answer, the standings follow by themselves with the round's points.
  const showStandings = useEffectEvent(onNext);
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(showStandings, ANSWER_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  const bullseye = right === null;
  const verdict = bullseye ? `Bullseye! ${guesser.isYou ? 'You' : guesser.name} nailed it` : `${right === 'higher' ? 'Higher' : 'Lower'} it was!`;

  // Only celebrate a bullseye, your right call, or your really close guess.
  const celebrate = revealed && (bullseye || (!!me?.correct && (!guesser.isYou || me.points >= 80)));

  const lo = Math.min(guess, answer);
  const growRight = answer >= guess;

  return (
    <View style={styles.screen}>
      {celebrate ? <Confetti count={bullseye ? 44 : 26} /> : null}
      <TopBar round={round} total={total} label="Reveal" />

      {/* You watched it being written already; here it's just a reminder. */}
      <HostQuestion text={question.text} compact animate={false} />

      {/* The answer and scale sit centred in the space below the question. */}
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.eyebrow}>The answer</Text>
        <View>
          <SparkleBurst trigger={celebrate ? 1 : 0} count={18} radius={120} />
          <Animated.View style={[styles.bigNumberRow, { transform: [{ scale: pop }] }]}>
            <Text style={[styles.bigNumber, { fontSize: 100, lineHeight: 108, color: revealed ? colors.magic : colors.text }]}>{shown}</Text>
            <Text style={[styles.bigNumber, { fontSize: 44, color: revealed ? colors.magic : colors.text }]}>%</Text>
          </Animated.View>
        </View>
        <Text style={{ fontFamily: fonts.serifItalic, fontSize: 18, color: colors.gold, opacity: revealed ? 1 : 0 }}>{verdict}</Text>
      </View>

      {/* 0–100 scale: gold pin = guess, cyan tick = answer, gold span = the gap */}
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <View style={{ height: 56 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 8, borderRadius: 999, backgroundColor: colors.track }} />
          <Animated.View
            style={{
              position: 'absolute',
              left: `${lo}%`,
              width: `${off}%`,
              top: 30,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.gold,
              transformOrigin: growRight ? 'left' : 'right',
              transform: [{ scaleX: bar }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              left: `${answer}%`,
              top: 20,
              width: 6,
              height: 28,
              marginLeft: -3,
              borderRadius: 3,
              backgroundColor: colors.magic,
              shadowColor: colors.magic,
              shadowOpacity: 0.9,
              shadowRadius: 8,
              opacity: bar,
              transform: [{ scaleY: bar }],
            }}
          />
          <View style={{ position: 'absolute', left: `${guess}%`, top: 0, width: 80, marginLeft: -40, alignItems: 'center', gap: 2 }}>
            <View style={{ paddingHorizontal: 7, height: 22, borderRadius: 8, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.ink }}>Guess {guess}</Text>
            </View>
            <View style={{ width: 2, height: 16, backgroundColor: colors.gold }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {['0', '50', '100'].map((t) => (
            <Text key={t} style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim }}>
              {t}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }} />
    </View>
  );
}
