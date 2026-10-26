import * as Haptics from 'expo-haptics';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Enter, Pop, SparkleBurst, ThinkingDots } from '../components/Effects';
import { HatMood } from '../components/HatWizard';
import { Avatar, ChevronIcon, Chip, GhostButton, HostBubble, MuteButton, PrimaryButton, RoundButton, SectionHeader, ShareIcon, styles, WandIcon } from '../components/ui';
import { ROSTER, Seat } from '../game/useGame';
import { native, useAnimatedValue, usePulse } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I mix-ups
const CODE_LEN = 6;

/** A fresh, easy-to-read room code. Call from event handlers, not render. */
export function makeRoomCode() {
  return Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

const formatCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;
const YOU = ROSTER[0];
const FRIENDS = ROSTER.slice(1);
/** Keep everyone in the same seat order as the main roster. */
const seated = (ids: string[]) => ROSTER.filter((p) => p.isYou || ids.includes(p.id));

type Props = { code: string; onStart: (roster: Seat[]) => void; onBack: () => void };

/**
 * Private rooms. Friends are simulated locally for now (they join and ready up on timers);
 * swap the timers for lobby socket events to make it truly multiplayer.
 */
export function LobbyScreen({ code, onStart, onBack }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <RoundButton label="Back to menu" onPress={onBack}>
          <ChevronIcon dir="left" size={18} />
        </RoundButton>
        <Text style={[styles.eyebrow, { color: colors.magic }]}>Private lobby</Text>
        <MuteButton />
      </View>

      <Segmented value={mode} onChange={setMode} />

      {mode === 'create' ? <HostRoom key="create" code={code} onStart={onStart} /> : <JoinRoom key="join" onStart={onStart} />}
    </View>
  );
}

function Segmented({ value, onChange }: { value: 'create' | 'join'; onChange: (v: 'create' | 'join') => void }) {
  const [w, setW] = useState(0);
  const x = useAnimatedValue(0);
  useEffect(() => {
    Animated.spring(x, { toValue: value === 'create' ? 0 : 1, friction: 8, tension: 120, useNativeDriver: native }).start();
  }, [value, x]);
  const half = (w - 8) / 2;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 46, borderRadius: 16, padding: 4, flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}>
      {w > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            bottom: 4,
            width: half,
            borderRadius: 12,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: alpha(colors.magic, 0.4),
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) }],
          }}
        />
      )}
      {(['create', 'join'] as const).map((v) => (
        <Pressable
          key={v}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === v }}
          onPress={() => {
            if (v === value) return;
            Haptics.selectionAsync();
            onChange(v);
          }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: value === v ? colors.text : colors.muted }}>{v === 'create' ? 'Create room' : 'Join with code'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Create ─────────────────────────────────────────────────────────────────

function HostRoom({ code, onStart }: { code: string; onStart: (roster: Seat[]) => void }) {
  const [joined, setJoined] = useState<string[]>([]);
  const [ready, setReady] = useState<string[]>([]);

  // Friends trickle in, then ready up a moment later.
  useEffect(() => {
    const timers = FRIENDS.flatMap((p, i) => {
      const at = 1400 + i * 1600 + Math.random() * 600;
      return [
        setTimeout(() => {
          setJoined((j) => [...j, p.id]);
          playSfx('vote');
          Haptics.selectionAsync();
        }, at),
        setTimeout(() => setReady((r) => [...r, p.id]), at + 1000 + Math.random() * 1400),
      ];
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const allReady = joined.length > 0 && joined.every((id) => ready.includes(id));
  const [mood, line]: [HatMood, string] =
    joined.length === 0
      ? ['wave', 'Share the code with your friends — I’ll keep the seats warm.']
      : allReady
        ? ['happy', joined.length === FRIENDS.length ? 'A full table! Start whenever you like.' : 'Everyone here is ready. Start now, or wait for more?']
        : ['idle', `${joined.length} joined. Waiting for everyone to get ready…`];

  const share = () => {
    Share.share({ message: `Join my Higher or Lower lobby! Room code: ${code}` }).catch(() => {});
  };

  return (
    <>
      <HostBubble mood={mood} bubbleKey={line} size={70}>
        {line}
      </HostBubble>

      <Enter delay={120}>
        <View style={[styles.row, { paddingVertical: 14, paddingHorizontal: 16, borderColor: alpha(colors.gold, 0.4), backgroundColor: alpha(colors.gold, 0.06) }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.eyebrow}>Room code</Text>
            <Text selectable style={{ fontFamily: fonts.number, fontSize: 30, letterSpacing: 4, color: colors.gold }}>
              {formatCode(code)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share room code"
            onPress={share}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderWidth: 1, borderColor: colors.borderStrong })}
          >
            <ShareIcon />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>Share</Text>
          </Pressable>
        </View>
      </Enter>

      <View style={{ flex: 1, gap: 8 }}>
        <SectionHeader left="Players" right={`${joined.length + 1} / ${ROSTER.length}`} />
        <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
          <MemberRow seat={YOU} host ready />
          {FRIENDS.map((p) => (joined.includes(p.id) ? <MemberRow key={p.id} seat={p} ready={ready.includes(p.id)} /> : <EmptySeat key={p.id} />))}
        </ScrollView>
      </View>

      <PrimaryButton
        label={joined.length === 0 ? 'Waiting for players…' : allReady ? `Start game · ${joined.length + 1} players` : 'Waiting for ready…'}
        icon={<WandIcon color={allReady ? colors.ink : colors.dim} />}
        disabled={!allReady}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          playSfx('sparkle');
          onStart(seated(joined));
        }}
      />
    </>
  );
}

// ─── Join ───────────────────────────────────────────────────────────────────

function JoinRoom({ onStart }: { onStart: (roster: Seat[]) => void }) {
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'enter' | 'joining' | 'in'>('enter');
  const [members, setMembers] = useState<string[]>(['priya', 'sam']);
  const [meReady, setMeReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const host = FRIENDS[0];

  const join = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSfx('sparkle');
    setPhase('joining');
    setTimeout(() => {
      setPhase('in');
      setBurst((n) => n + 1);
      playSfx('lock');
    }, 1300);
  };

  // Once you're in, one more friend shows up.
  useEffect(() => {
    if (phase !== 'in') return;
    const t = setTimeout(() => {
      setMembers((m) => [...m, 'jordan']);
      playSfx('vote');
    }, 1800);
    return () => clearTimeout(t);
  }, [phase]);

  // The countdown reads the latest members when it fires, not when it was armed.
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // When you're ready, the host counts the room down and starts.
  useEffect(() => {
    if (!meReady) return;
    let n = 3;
    let tick: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => {
      setCount(n);
      tick = setInterval(() => {
        n -= 1;
        if (n > 0) return setCount(n);
        clearInterval(tick);
        onStart(seated(membersRef.current));
      }, 1000);
    }, 700);
    return () => {
      clearTimeout(t0);
      clearInterval(tick);
      setCount(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meReady]);

  if (phase !== 'in') {
    const joining = phase === 'joining';
    const line = joining ? `Opening a portal to room ${formatCode(code)}…` : 'Got a code from a friend? Pop it in below.';
    return (
      <>
        <HostBubble mood={joining ? 'cast' : 'think'} bubbleKey={line} size={70}>
          {line}
        </HostBubble>
        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Text style={[styles.eyebrow, { textAlign: 'center' }]}>Enter room code</Text>
          <CodeInput value={code} onChange={setCode} disabled={joining} />
        </View>
        <PrimaryButton
          label={joining ? 'Joining…' : 'Join room'}
          color={colors.magic}
          icon={<ChevronIcon color={code.length === CODE_LEN ? colors.ink : colors.dim} />}
          disabled={code.length < CODE_LEN || joining}
          onPress={join}
        />
      </>
    );
  }

  const roster = seated(members);
  const [mood, line]: [HatMood, string] =
    count !== null ? ['cheer', `${host.name} is starting the game in ${count}…`] : meReady ? ['happy', 'You’re ready! Waiting for the host…'] : ['wave', `Welcome to ${host.name}’s room! Ready up when you are.`];

  return (
    <>
      <HostBubble mood={mood} bubbleKey={line} size={70}>
        {line}
      </HostBubble>

      <View style={[styles.row, { paddingVertical: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Room</Text>
          <Text style={{ fontFamily: fonts.number, fontSize: 22, letterSpacing: 3, color: colors.magic }}>{formatCode(code)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.eyebrow}>Host</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{host.name}</Text>
        </View>
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        <SectionHeader left="Players" right={`${roster.length} / ${ROSTER.length}`} />
        <View>
          <SparkleBurst trigger={burst} count={14} radius={120} />
        </View>
        <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
          {roster.map((p) => (
            <MemberRow key={p.id} seat={p} host={p.id === host.id} ready={p.isYou ? meReady : true} />
          ))}
          {ROSTER.length - roster.length > 0 && <EmptySeat />}
        </ScrollView>
      </View>

      {meReady ? (
        <GhostButton label={count !== null ? `Starting in ${count}…` : 'Not ready yet'} onPress={() => setMeReady(false)} />
      ) : (
        <PrimaryButton
          label="I’m ready"
          color={colors.leaf}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            playSfx('lock');
            setMeReady(true);
          }}
        />
      )}
    </>
  );
}

/** Six letter boxes over one invisible TextInput, with a blinking caret in the active box. */
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const caret = usePulse(900, focused && !disabled);

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {Array.from({ length: CODE_LEN }, (_, i) => {
          const ch = value[i];
          const active = focused && i === Math.min(value.length, CODE_LEN - 1);
          return (
            <View
              key={i}
              style={{
                width: 46,
                height: 58,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ch ? alpha(colors.magic, 0.1) : colors.surfaceAlt,
                borderWidth: active ? 2 : 1,
                borderColor: active ? colors.magic : ch ? alpha(colors.magic, 0.45) : colors.border,
                marginRight: i === 2 ? 10 : 0,
              }}
            >
              {ch ? (
                <Pop key={ch + i} from={0.4}>
                  <Text style={{ fontFamily: fonts.number, fontSize: 26, color: colors.text }}>{ch}</Text>
                </Pop>
              ) : active ? (
                <Animated.View style={{ width: 2, height: 26, borderRadius: 1, backgroundColor: colors.magic, opacity: caret }} />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        editable={!disabled}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={CODE_LEN}
        accessibilityLabel="Room code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(t) => {
          const clean = t
            .toUpperCase()
            .split('')
            .filter((c) => CODE_CHARS.includes(c))
            .join('')
            .slice(0, CODE_LEN);
          if (clean.length > value.length) Haptics.selectionAsync();
          onChange(clean);
        }}
        caretHidden
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0 }}
      />
    </Pressable>
  );
}

// ─── Rows ───────────────────────────────────────────────────────────────────

function MemberRow({ seat, host = false, ready }: { seat: Seat; host?: boolean; ready: boolean }) {
  return (
    <Pop from={0.85}>
      <View style={[styles.row, seat.isYou && { borderColor: alpha(colors.magic, 0.45) }]}>
        <Avatar initials={seat.initials} color={seat.color} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.rowName, { flex: 0 }]}>{seat.isYou ? 'You' : seat.name}</Text>
          {host && (
            <View style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: alpha(colors.gold, 0.18) }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.gold }}>HOST</Text>
            </View>
          )}
        </View>
        {ready ? (
          <Pop key="ready">
            <Chip ok>Ready</Chip>
          </Pop>
        ) : (
          <Chip ok={false}>
            <ThinkingDots />
          </Chip>
        )}
      </View>
    </Pop>
  );
}

function EmptySeat() {
  const pulse = usePulse(1600);
  return (
    <Animated.View
      style={[
        styles.row,
        { borderStyle: 'dashed', backgroundColor: 'transparent', borderColor: colors.borderStrong, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }) },
      ]}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }} />
      <Text style={[styles.rowName, { color: colors.dim }]}>Waiting for a player…</Text>
    </Animated.View>
  );
}
