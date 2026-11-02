import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CircleDial } from '../components/CircleDial';
import { Enter, SparkleBurst } from '../components/Effects';
import { ArrowIcon, Avatar, HostQuestion, LockIcon, PrimaryButton, styles, TopBar } from '../components/ui';
import { useCountdown } from '../game/useCountdown';
import type { Player, Question } from '../game/types';
import { usePulse } from '../motion';
import { playSfx } from '../sound';
import { colors, fonts, heatColor } from '../theme';

type Props = {
  question: Question;
  round: number;
  total: number;
  /** Seconds the guesser has, from the game's rules (the server's, when online). */
  duration: number;
  guesser: Player;
  players: Player[];
  /** The guesser's dial as the server last reported it, when someone else is guessing. */
  dial?: number;
  /** Your dial moved, so the others can watch it. */
  onDial: (value: number) => void;
  onLock: (guess: number) => void;
};

export function GuessScreen(props: Props) {
  return props.guesser.isYou ? <YourGuess {...props} /> : <WatchGuess {...props} />;
}

/** Your turn: you hold the dial. */
function YourGuess({ question, round, total, duration, onDial, onLock }: Props) {
  const [value, setValue] = useState(50);
  const [locked, setLocked] = useState(false);
  const [burst, setBurst] = useState(0);
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
  // The countdown always calls its latest callback, so time running out locks wherever the dial is now.
  const seconds = useCountdown(duration, question.id, !locked, () => lock(value));
  useEffect(() => {
    if (!locked && seconds > 0 && seconds <= 5) playSfx('tick');
  }, [seconds, locked]);

  return (
    <View style={styles.screen}>
      <TopBar round={round} total={total} seconds={seconds} duration={duration} />

      <HostQuestion text={question.text} />

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

/** Someone else's turn: their dial turns on its own as they drag it, and you get ready to call it. */
function WatchGuess({ question, round, total, duration, guesser, dial = 50 }: Props) {
  const { width } = useWindowDimensions();
  // Smaller than your own dial, in whatever room the standings under the screen leave (minus the pill).
  const [room, setRoom] = useState(0);
  const dialSize = Math.min(230, width - 40, Math.max(120, room ? room - 44 : 180));
  // The server locks their guess when time runs out, nothing to do here.
  const seconds = useCountdown(duration, question.id, true, () => {});
  const blink = usePulse(1200);

  return (
    <View style={[styles.screen, { gap: 12 }]}>
      <TopBar round={round} total={total} seconds={seconds} duration={duration} />

      <HostQuestion text={question.text} compact />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }} onLayout={(e) => setRoom(Math.floor(e.nativeEvent.layout.height))}>
        <View style={watch.live}>
          <Avatar initials={guesser.initials} color={guesser.color} size={24} />
          <Text style={watch.liveText}>{guesser.name} is turning the dial</Text>
          <Animated.View style={[watch.liveDot, { opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]} />
          <Text style={watch.liveTag}>LIVE</Text>
        </View>
        <CircleDial
          value={dial}
          onChange={() => {}}
          size={dialSize}
          readOnly
          knob={{ label: guesser.initials, color: guesser.color }}
          trail
          status="Not locked yet"
          label={`${guesser.name}’s guess in percent`}
        />
      </View>

      {/* What you'll do once they lock in; the buttons are only a preview. */}
      <View accessible accessibilityLabel="Up next: will the answer be higher or lower?" style={watch.next}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>Up next</Text>
          <Text style={watch.nextText}>Will the answer be higher or lower?</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, opacity: 0.5 }}>
          <View style={[watch.preview, { backgroundColor: colors.higher }]}>
            <ArrowIcon dir="up" color={colors.higherInk} size={20} />
          </View>
          <View style={[watch.preview, { backgroundColor: colors.lower }]}>
            <ArrowIcon dir="down" color={colors.lowerInk} size={20} />
          </View>
        </View>
      </View>
    </View>
  );
}

const watch = StyleSheet.create({
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  liveTag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, color: colors.danger },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  nextText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  preview: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
