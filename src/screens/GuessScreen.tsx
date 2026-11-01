import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { CircleDial } from '../components/CircleDial';
import { Enter, SparkleBurst } from '../components/Effects';
import { Avatar, HostBubble, LockIcon, PrimaryButton, QuestionCard, styles, TopBar } from '../components/ui';
import { GUESS_SECONDS } from '../game/useGame';
import { useCountdown } from '../game/useCountdown';
import type { Player, Question } from '../game/types';
import { playSfx } from '../sound';
import { heatColor } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  guesser: Player;
  players: Player[];
  /** The guesser's dial as the server last reported it, when someone else is guessing. */
  dial?: number;
  /** Your dial moved, so the others can watch it. */
  onDial: (value: number) => void;
  onLock: (guess: number) => void;
};

/** Where the Hat's eyes should point to watch the dial knob below it. */
function lookAtKnob(value: number) {
  const a = ((-135 + 2.7 * value) * Math.PI) / 180;
  return { x: Math.sin(a) * 0.9, y: Math.min(1, 0.55 - Math.cos(a) * 0.45) };
}

export function GuessScreen(props: Props) {
  return props.guesser.isYou ? <YourGuess {...props} /> : <WatchGuess {...props} />;
}

/** Your turn: you hold the dial. */
function YourGuess({ question, round, total, onDial, onLock }: Props) {
  const [value, setValue] = useState(50);
  const [writing, setWriting] = useState(true);
  const [locked, setLocked] = useState(false);
  const [burst, setBurst] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lockedRef = useRef(false);
  const { width } = useWindowDimensions();
  // As big as the space between the question and the button allows, with the standings below.
  const [room, setRoom] = useState(0);
  const dialSize = Math.min(272, width - 40, Math.max(140, room || 200));
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
  useEffect(() => {
    if (!locked && seconds > 0 && seconds <= 5) playSfx('tick');
  }, [seconds, locked]);

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

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setRoom(Math.floor(e.nativeEvent.layout.height))}>
        <CircleDial
          value={value}
          onChange={(v) => {
            setValue(v);
            onDial(v);
          }}
          size={dialSize}
          disabled={locked}
        />
      </View>

      <Enter delay={250}>
        <View>
          <SparkleBurst trigger={burst} count={16} radius={140} />
          <PrimaryButton label={locked ? 'Locked!' : `Lock in ${value}%`} color={accent} icon={<LockIcon />} onPress={() => lock(value)} />
        </View>
      </Enter>
    </View>
  );
}

/** Someone else's turn: their dial turns on its own as they drag it. */
function WatchGuess({ question, round, total, guesser, dial = 50 }: Props) {
  const [writing, setWriting] = useState(true);
  const { width } = useWindowDimensions();
  // Smaller than your own dial, in whatever room the standings under the screen leave (minus the label).
  const [room, setRoom] = useState(0);
  const dialSize = Math.min(230, width - 40, Math.max(120, room ? room - 30 : 180));
  // The server locks their guess when time runs out, nothing to do here.
  const seconds = useCountdown(GUESS_SECONDS, question.id, true, () => {});

  const mood = writing ? 'cast' : seconds <= 5 ? 'shock' : 'think';
  const line = writing
    ? 'Ahem… let me conjure a question…'
    : seconds <= 5
      ? `Tick tock, ${guesser.name}! Lock it in!`
      : `${guesser.name} is turning the dial. Get ready to call it!`;

  return (
    <View style={[styles.screen, { gap: 12 }]}>
      <TopBar round={round} total={total} seconds={seconds} duration={GUESS_SECONDS} />

      <HostBubble mood={mood} bubbleKey={line} look={writing ? undefined : lookAtKnob(dial)} size={70}>
        {line}
      </HostBubble>

      <QuestionCard text={question.text} compact onWritingChange={setWriting} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }} onLayout={(e) => setRoom(Math.floor(e.nativeEvent.layout.height))}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar initials={guesser.initials} color={guesser.color} size={22} />
          <Text style={styles.eyebrow}>{guesser.name}’s dial</Text>
        </View>
        <CircleDial value={dial} onChange={() => {}} size={dialSize} readOnly label={`${guesser.name}’s guess in percent`} />
      </View>
    </View>
  );
}
