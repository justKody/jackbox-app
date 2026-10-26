import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { CircleDial } from '../components/CircleDial';
import { Enter, SparkleBurst } from '../components/Effects';
import { Avatar, HostBubble, LockIcon, PrimaryButton, QuestionCard, styles, TopBar } from '../components/ui';
import { GUESS_SECONDS } from '../game/useGame';
import { useCountdown } from '../game/useCountdown';
import type { Player, Question } from '../game/types';
import { playSfx } from '../sound';
import { colors, fonts, heatColor } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  waiting: Player[];
  onLock: (guess: number) => void;
};

/** Where the Hat's eyes should point to watch the dial knob below it. */
function lookAtKnob(value: number) {
  const a = ((-135 + 2.7 * value) * Math.PI) / 180;
  return { x: Math.sin(a) * 0.9, y: Math.min(1, 0.55 - Math.cos(a) * 0.45) };
}

export function GuessScreen({ question, round, total, waiting, onLock }: Props) {
  const [value, setValue] = useState(50);
  const [writing, setWriting] = useState(true);
  const [locked, setLocked] = useState(false);
  const [burst, setBurst] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lockedRef = useRef(false);
  const { width, height } = useWindowDimensions();
  const dialSize = Math.min(280, width - 40, height < 760 ? 236 : 272);
  const accent = heatColor(value);

  const lock = (v: number) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setBurst((n) => n + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx('lock');
    // Let the spell land before the vote screen takes over.
    setTimeout(() => onLock(v), 520);
  };
  const seconds = useCountdown(GUESS_SECONDS, question.id, !locked, () => lock(valueRef.current));

  const mood = locked ? 'cheer' : writing ? 'cast' : seconds <= 5 ? 'shock' : 'idle';
  const line = locked
    ? `${value}% — sealed with magic!`
    : writing
      ? 'Ahem… let me conjure a question…'
      : seconds <= 5
        ? 'Quick, quick! Lock it in!'
        : 'Your turn! Spin the dial to your best guess.';

  return (
    <View style={styles.screen}>
      <TopBar round={round} total={total} seconds={seconds} duration={GUESS_SECONDS} />

      <HostBubble mood={mood} bubbleKey={line} look={writing || locked ? undefined : lookAtKnob(value)}>
        {line}
      </HostBubble>

      <QuestionCard text={question.text} onWritingChange={setWriting} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <CircleDial value={value} onChange={setValue} size={dialSize} disabled={locked} />
      </View>

      <Enter delay={250}>
        <View>
          <SparkleBurst trigger={burst} count={16} radius={140} />
          <PrimaryButton label={locked ? 'Locked!' : `Lock in ${value}%`} color={accent} icon={<LockIcon />} onPress={() => lock(value)} />
        </View>
      </Enter>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          {waiting.map((p, i) => (
            <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -9 }}>
              <Avatar initials={p.initials} color={p.color} size={28} />
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{waiting.length} players waiting on you</Text>
      </View>
    </View>
  );
}
