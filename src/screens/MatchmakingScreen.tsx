import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useWardrobe } from '../avatar/store';
import { Enter, Pop, SparkleBurst } from '../components/Effects';
import { HatWizard } from '../components/HatWizard';
import { Avatar, ChevronIcon, GhostButton, RoundButton, SoundButton, styles } from '../components/ui';
import { ROSTER, Seat } from '../game/useGame';
import { native, useAnimatedValue, usePulse, useReduceMotion } from '../motion';
import { clientId, close, connect, LobbyUpdate, onMessage, send } from '../net/server';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

/** How many seats to draw before the server says how big lobbies are. */
const SEATS = 5;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Status = 'connecting' | 'searching' | 'matched' | 'offline';

/** Finds a ranked match on the game server. Once the game starts the socket stays open for it. */
export function MatchmakingScreen({ onMatched, onCancel }: { onMatched: () => void; onCancel: () => void }) {
  const { animal, equipped, ladder } = useWardrobe();
  const [status, setStatus] = useState<Status>('connecting');
  const [lobby, setLobby] = useState<LobbyUpdate>();
  const [startsIn, setStartsIn] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const handedOff = useRef(false);
  const profile = useRef({ animal: animal.id, skin: equipped.id, rp: ladder.ratings.you });
  useEffect(() => {
    profile.current = { animal: animal.id, skin: equipped.id, rp: ladder.ratings.you };
  });

  useEffect(() => {
    let seen = 0;
    const off = onMessage((msg) => {
      switch (msg.type) {
        case 'lobbyUpdate':
          if (msg.data.players.length > seen) {
            playSfx('join');
            Haptics.selectionAsync();
          }
          seen = msg.data.players.length;
          setLobby(msg.data);
          setStartsIn(msg.data.startsIn);
          break;
        case 'game':
          setStatus('matched');
          break;
        case 'closed':
          setStatus('offline');
          break;
      }
    });
    connect(async () => {
      send('findMatch', { clientId: await clientId(), ...profile.current });
      setStatus('searching');
    });
    const tick = setInterval(() => {
      setElapsed((s) => s + 1);
      setStartsIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      off();
      clearInterval(tick);
      // Backing out before the game starts leaves matchmaking; the game keeps the socket.
      if (!handedOff.current) close();
    };
  }, [attempt]);

  const matched = status === 'matched';
  useEffect(() => {
    if (!matched) return;
    playSfx('sparkle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => {
      handedOff.current = true;
      onMatched();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const retry = () => {
    setStatus('connecting');
    setLobby(undefined);
    setElapsed(0);
    setStartsIn(0);
    setAttempt((n) => n + 1);
  };
  const cancel = () => {
    send('cancelMatch');
    onCancel();
  };

  // Everyone the server has seated so far, you first; before that it's just you.
  const seats: Seat[] = lobby
    ? [...lobby.players].sort((a, b) => Number(b.id === lobby.you) - Number(a.id === lobby.you)).map((p) => (p.id === lobby.you ? { ...p, name: ROSTER[0].name, initials: ROSTER[0].initials, isYou: true } : { ...p, isYou: false }))
    : [ROSTER[0]];
  const total = lobby?.maxPlayers ?? SEATS;

  const title = matched ? 'Match found!' : status === 'offline' ? 'Can’t reach the server' : 'Finding rivals…';
  const detail = matched
    ? 'The Hat is preparing your first riddle'
    : status === 'offline'
      ? 'Check the game server is running, then try again'
      : status === 'connecting'
        ? 'Connecting…'
        : startsIn > 0
          ? `${seats.length} of ${total} in · starting in ${startsIn}s`
          : `Searching · ${clock(elapsed)} · ${seats.length} of ${total} in`;

  return (
    <View style={[styles.screen, { justifyContent: 'space-between' }]}>
      <View style={styles.topBar}>
        <RoundButton label="Back to menu" onPress={cancel}>
          <ChevronIcon dir="left" size={18} />
        </RoundButton>
        <Text style={[styles.eyebrow, { color: colors.gold }]}>Ranked match</Text>
        <SoundButton />
      </View>

      <View style={{ alignItems: 'center', gap: 18 }}>
        <Portal active={!matched && status !== 'offline'}>
          <SparkleBurst trigger={matched ? 1 : 0} count={20} radius={150} />
          <HatWizard size={140} mood={matched ? 'cheer' : status === 'offline' ? 'sad' : 'think'} aura={false} />
        </Portal>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Pop key={status} from={0.8}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: matched ? colors.gold : colors.text, textAlign: 'center' }}>
              {title}
            </Text>
          </Pop>
          <Text style={[styles.body, { textAlign: 'center', fontVariant: ['tabular-nums'] }]}>{detail}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <SeatSlot key={seats[i]?.id ?? `empty-${i}`} seat={seats[i]} />
        ))}
      </View>

      <Enter delay={300}>
        {matched ? (
          <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.eyebrow, { color: colors.magic }]}>Starting…</Text>
          </View>
        ) : status === 'offline' ? (
          <GhostButton label="Try again" onPress={retry} />
        ) : (
          <GhostButton label="Cancel search" onPress={cancel} />
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
