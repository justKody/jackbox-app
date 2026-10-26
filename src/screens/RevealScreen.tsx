import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { Confetti, Enter, Pop, SparkleBurst } from '../components/Effects';
import { HatMood } from '../components/HatWizard';
import { ArrowIcon, Avatar, Chip, HostBubble, PrimaryButton, SectionHeader, styles, TopBar } from '../components/ui';
import { correctCall } from '../game/scoring';
import type { Player, Question, RoundResult } from '../game/types';
import { native, prefersReducedMotion, useAnimatedValue, useCountUp } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  guesser: Player;
  guess: number;
  players: Player[];
  results: RoundResult[];
  isLastRound: boolean;
  onNext: () => void;
};

const SUSPENSE_MS = 1400;

export function RevealScreen({ question, round, total, guesser, guess, players, results, isLastRound, onNext }: Props) {
  const answer = question.answer;
  const right = correctCall(guess, answer);
  const off = Math.abs(guess - answer);
  const me = results.find((r) => r.playerId === 'you');
  const [revealed, setRevealed] = useState(prefersReducedMotion());
  const shown = useCountUp(answer, { duration: SUSPENSE_MS - 150 });
  const pop = useAnimatedValue(1);
  const bar = useAnimatedValue(0);

  useEffect(() => {
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

  const bullseye = right === null;
  const bannerColor = right === 'higher' ? colors.higher : right === 'lower' ? colors.lower : colors.gold;
  const bannerInk = right === 'higher' ? colors.higherInk : right === 'lower' ? colors.lowerInk : colors.ink;
  const who = guesser.isYou ? 'You were' : `${guesser.name} was`;
  const bannerText = bullseye
    ? `Bullseye! ${guesser.isYou ? 'You' : guesser.name} nailed it`
    : `${right === 'higher' ? 'Higher' : 'Lower'} was right · ${who} off by ${off}`;

  let mood: HatMood = 'think';
  let line = 'And the answer is…';
  if (revealed) {
    if (guesser.isYou) {
      mood = bullseye ? 'cheer' : (me?.points ?? 0) >= 80 ? 'happy' : (me?.points ?? 0) > 0 ? 'idle' : 'sad';
      line = bullseye ? 'A perfect bullseye! Pure wizardry. +150!' : `Off by ${off} — that’s +${me?.points ?? 0} for you.`;
    } else if (!me || me.label === 'No call') {
      mood = 'sad';
      line = 'You didn’t make a call this time…';
    } else if (me.correct) {
      mood = 'cheer';
      line = `Spot on! ${right === 'higher' ? 'Higher' : 'Lower'} it was. +${me.points}!`;
    } else {
      mood = 'sad';
      line = bullseye ? 'A bullseye — nobody wins the call!' : 'Ooh, not this time. The next one’s yours!';
    }
  }

  // Only celebrate when the Hat does: bullseyes, right calls, or a really close guess.
  const celebrate = revealed && (bullseye || (!!me?.correct && (!guesser.isYou || me.points >= 80)));

  const rows = results
    .map((r) => ({ r, p: players.find((p) => p.id === r.playerId)! }))
    .sort((a, b) => b.r.points - a.r.points || b.p.score - a.p.score);

  const lo = Math.min(guess, answer);
  const growRight = answer >= guess;

  return (
    <View style={styles.screen}>
      {celebrate ? <Confetti count={bullseye ? 44 : 26} /> : null}
      <TopBar round={round} total={total} label="Reveal" />

      <HostBubble mood={mood} bubbleKey={line} size={78}>
        {line}
      </HostBubble>

      <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 21, color: colors.muted, textAlign: 'center' }}>{question.text}</Text>

      <View style={{ alignItems: 'center' }}>
        <Text style={styles.eyebrow}>The answer is</Text>
        <View>
          <SparkleBurst trigger={celebrate ? 1 : 0} count={18} radius={120} />
          <Animated.View style={[styles.bigNumberRow, { transform: [{ scale: pop }] }]}>
            <Text style={[styles.bigNumber, { fontSize: 100, lineHeight: 108, color: revealed ? colors.gold : colors.text }]}>{shown}</Text>
            <Text style={[styles.bigNumber, { fontSize: 44, color: revealed ? colors.gold : colors.text }]}>%</Text>
          </Animated.View>
        </View>
      </View>

      {/* 0–100 scale: gold tick = answer, white pin = guess, coloured span = the gap */}
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <View style={{ height: 56 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 10, borderRadius: 999, backgroundColor: colors.track }} />
          <Animated.View
            style={{
              position: 'absolute',
              left: `${lo}%`,
              width: `${off}%`,
              top: 30,
              height: 10,
              borderRadius: 5,
              backgroundColor: bannerColor,
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
              height: 30,
              marginLeft: -3,
              borderRadius: 3,
              backgroundColor: colors.gold,
              shadowColor: colors.gold,
              shadowOpacity: 0.9,
              shadowRadius: 8,
              opacity: bar,
              transform: [{ scaleY: bar }],
            }}
          />
          <View style={{ position: 'absolute', left: `${guess}%`, top: 0, width: 56, marginLeft: -28, alignItems: 'center', gap: 2 }}>
            <View style={{ paddingHorizontal: 7, height: 22, borderRadius: 8, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.ink }}>
                {guesser.initials} {guess}
              </Text>
            </View>
            <View style={{ width: 2, height: 18, backgroundColor: colors.text }} />
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

      {revealed ? (
        <>
          <Pop from={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: bannerColor, borderBottomWidth: 4, borderBottomColor: alpha('#000000', 0.25) }}>
              {right && <ArrowIcon dir={right === 'higher' ? 'up' : 'down'} color={bannerInk} size={22} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: bannerInk, flexShrink: 1 }}>{bannerText}</Text>
            </View>
          </Pop>

          <View style={{ flex: 1, gap: 8 }}>
            <SectionHeader left="This round" right="Total" />
            <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
              {rows.map(({ r, p }, i) => (
                <Enter key={p.id} delay={200 + i * 90}>
                  <ResultRow player={p} result={r} delay={400 + i * 90} />
                </Enter>
              ))}
            </ScrollView>
          </View>

          <Enter delay={500}>
            <PrimaryButton label={isLastRound ? 'See final scores' : 'Next question'} onPress={onNext} height={56} />
          </Enter>
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

function ResultRow({ player: p, result: r, delay }: { player: Player; result: RoundResult; delay: number }) {
  const total = useCountUp(p.score, { from: p.score - r.points, duration: 800, delay });
  return (
    <View style={[styles.row, { paddingVertical: 9 }, p.isYou && { borderColor: alpha(colors.magic, 0.45) }]}>
      <Avatar initials={p.initials} color={p.color} size={32} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.text }}>{p.isYou ? 'You' : p.name}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{r.label}</Text>
      </View>
      <Chip ok={r.points > 0}>{r.points > 0 ? `+${r.points}` : '0'}</Chip>
      <Text style={{ width: 46, textAlign: 'right', fontFamily: fonts.number, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] }}>{total}</Text>
    </View>
  );
}
