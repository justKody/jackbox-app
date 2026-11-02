import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Pop } from '../components/Effects';
import type { SeatTag, TableState } from '../game/table';
import type { Player } from '../game/types';
import { native, useAnimatedValue, useReduceMotion } from '../motion';
import { alpha, colors, fonts } from '../theme';
import type { Mood } from './animalModel';
import { AnimalSwatch } from './AnimalSwatch';
import { GLSurface } from './GLSurface';
import { useSeatLook } from './store';
import { createTableau, SWAP_DELAY_MS, SWAP_MS, TableLayout, Tableau } from './tableau';

const GAP = 5;
/** Card padding and the place number's column, which the animals stand just right of. */
const PAD_L = 8;
const PLACE_W = 18;
/** How long the "moved up" badge stays after an overtake. */
const CLIMB_BADGE_MS = 2600;

/**
 * Everyone's animal in a leaderboard along the bottom of the game, best score on top, reacting to
 * the round: the guesser steps into a halo, callers nod when they lock in, and the reveal sends
 * right calls bouncing and wrong ones slumping. When the points land, anyone who overtakes
 * someone climbs past them. Mounted once per match.
 */
export function PlayerTable({ players, table }: { players: Player[]; table: TableState }) {
  const { height: screenH } = useWindowDimensions();
  const rowH = Math.round(Math.min(44, Math.max(32, screenH * 0.048)));
  const pitch = rowH + GAP;
  const avatarW = Math.round(rowH * 1.3);
  // Room above the top row for its animal's ears.
  const headRoom = Math.round(rowH * 0.5);
  const n = players.length;
  const listH = n * pitch - GAP;
  const layout: TableLayout = { top: headRoom, rowH, pitch, height: listH + headRoom };

  const seatLook = useSeatLook();
  const reduce = useReduceMotion();

  // Best score first; ties keep seat order so nobody shuffles without cause.
  const scoreOf = (p: Player) => table.scores[p.id] ?? p.score;
  const order = players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => scoreOf(b.p) - scoreOf(a.p) || a.i - b.i)
    .map(({ p }) => p.id);
  const ranks = Object.fromEntries(order.map((id, i) => [id, i]));
  const orderKey = order.join(',');

  // Each row's offset, shared by its card and (without WebGL) its 2D animal.
  const [slides] = useState(() => new Map(order.map((id, i) => [id, new Animated.Value(i * pitch)])));
  useEffect(() => {
    const anims = orderKey.split(',').map((id, i) =>
      Animated.timing(slides.get(id)!, {
        toValue: i * pitch,
        duration: reduce ? 0 : SWAP_MS,
        delay: reduce ? 0 : SWAP_DELAY_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: native,
      }),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [orderKey, pitch, reduce, slides]);

  const scene = useRef<Tableau | null>(null);
  // The seats and their looks are fixed for the match; read once when the GL context arrives.
  const latest = useRef({ table, reduce, layout, ranks });
  const prevMoods = useRef<Record<string, Mood>>({});

  useEffect(() => {
    latest.current = { table, reduce, layout, ranks };
    scene.current?.setMoods(table.moods, table.spotlight);
    // Sparkle over anyone who just locked in or started cheering.
    for (const [id, mood] of Object.entries(table.moods)) {
      const before = prevMoods.current[id];
      if (before && before !== mood && (mood === 'ready' || mood === 'cheer')) scene.current?.sparkle(id);
    }
    prevMoods.current = table.moods;
  });
  useEffect(() => scene.current?.setStill(reduce), [reduce]);
  useEffect(() => scene.current?.setRanks(latest.current.ranks), [orderKey]);
  useEffect(() => scene.current?.setLayout(latest.current.layout), [rowH, n]);

  return (
    <View style={{ height: listH, marginHorizontal: 20, marginBottom: 10 }} accessibilityLabel="Standings">
      {players.map((p) => {
        const score = scoreOf(p);
        return (
          <Row
            key={p.id}
            player={p}
            place={1 + players.filter((o) => scoreOf(o) > score).length}
            rank={ranks[p.id]}
            score={score}
            tag={table.tags[p.id]}
            guessing={p.id === table.spotlight}
            y={slides.get(p.id)!}
            rowH={rowH}
            avatarW={avatarW}
          />
        );
      })}
      <GLSurface
        style={{ position: 'absolute', zIndex: 3, pointerEvents: 'none', left: PAD_L + PLACE_W, top: -headRoom, width: avatarW, height: layout.height }}
        create={(gl, ready) => {
          const { table: t, reduce: still, layout: l, ranks: r } = latest.current;
          const s = createTableau(
            gl,
            players.map((p) => ({ id: p.id, look: seatLook(p), color: p.color })),
            { layout: l, ranks: r },
            still,
            ready,
          );
          s.setMoods(t.moods, t.spotlight);
          return s;
        }}
        onScene={(s) => (scene.current = s)}
        fallback={players.map((p) => (
          <Animated.View key={p.id} style={{ position: 'absolute', left: 0, top: headRoom + rowH - avatarW, transform: [{ translateY: slides.get(p.id)! }] }}>
            <AnimalSwatch look={seatLook(p)} size={avatarW} />
          </Animated.View>
        ))}
      />
    </View>
  );
}

type RowProps = {
  player: Player;
  /** 1-based, shared on a tie. */
  place: number;
  /** 0-based position in the list. */
  rank: number;
  score: number;
  tag?: SeatTag;
  guessing: boolean;
  y: Animated.Value;
  rowH: number;
  avatarW: number;
};

/** One standings card; when it overtakes someone it rises above them and flashes gold on the way. */
function Row({ player, place, rank, score, tag, guessing, y, rowH, avatarW }: RowProps) {
  const reduce = useReduceMotion();
  const rise = useAnimatedValue(0);
  const prevRank = useRef(rank);
  const [climb, setClimb] = useState<{ by: number; key: number } | null>(null);

  useEffect(() => {
    const by = prevRank.current - rank;
    prevRank.current = rank;
    if (by <= 0) return;
    setClimb({ by, key: Date.now() });
    const clear = setTimeout(() => setClimb(null), SWAP_DELAY_MS + CLIMB_BADGE_MS);
    const half = SWAP_MS / 2;
    const a = Animated.sequence([
      Animated.delay(SWAP_DELAY_MS),
      Animated.timing(rise, { toValue: 1, duration: half, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(rise, { toValue: 0, duration: half + 400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]);
    if (!reduce) a.start();
    return () => {
      clearTimeout(clear);
      a.stop();
      rise.setValue(0);
      setClimb(null);
    };
  }, [rank, reduce, rise]);

  const name = player.isYou ? 'You' : player.name;
  return (
    <Animated.View
      accessibilityLabel={`${place}. ${name}, ${score} points${tag ? `, ${tag.text}` : ''}`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: rowH,
        // A climber passes in front of whoever it overtakes.
        zIndex: climb ? 2 : 1,
        transform: [{ translateY: y }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: PAD_L,
          paddingRight: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: guessing ? alpha(colors.gold, 0.65) : player.isYou ? alpha(colors.magic, 0.45) : colors.border,
          backgroundColor: guessing ? alpha(colors.gold, 0.12) : colors.surfaceAlt,
        }}
      >
        <Text style={{ width: PLACE_W, fontFamily: fonts.bold, fontSize: 13, color: place === 1 ? colors.gold : colors.muted, textAlign: 'center' }}>{place}</Text>
        {/* The animal stands here, drawn by the 3D layer above the cards. */}
        <View style={{ width: avatarW + 4 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: player.color }} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: player.isYou ? colors.magic : colors.text }}>
            {name}
          </Text>
          {climb && <ClimbBadge key={climb.key} by={climb.by} />}
        </View>
        <Tag key={`${player.id}-${tag?.text}`} tag={tag} />
        <Score value={score} />
      </View>
      {/* Gold flash while it climbs. */}
      <Animated.View
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, borderWidth: 2, borderColor: colors.gold, backgroundColor: alpha(colors.gold, 0.1), opacity: rise, pointerEvents: 'none' }}
      />
    </Animated.View>
  );
}

/** "▲2" next to someone who just moved up the standings. */
function ClimbBadge({ by }: { by: number }) {
  const [shown, setShown] = useState(false);
  // Pops in as the card starts to climb, not before.
  useEffect(() => {
    const t = setTimeout(() => setShown(true), SWAP_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <Pop from={0.4}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, height: 16, borderRadius: 8, backgroundColor: colors.okBg }}>
        <Svg width={7} height={7} viewBox="0 0 10 10">
          <Path d="M5 1 L9.5 8.5 H0.5 Z" fill={colors.okText} />
        </Svg>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.okText, fontVariant: ['tabular-nums'] }}>{by}</Text>
      </View>
    </Pop>
  );
}

/** The score, counting up to its new value when points land. */
function Score({ value }: { value: number }) {
  const reduce = useReduceMotion();
  const v = useAnimatedValue(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    return () => v.removeListener(id);
  }, [v]);
  useEffect(() => {
    if (reduce) {
      v.setValue(value);
      return;
    }
    const a = Animated.timing(v, { toValue: value, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [value, reduce, v]);
  return (
    <Text style={{ minWidth: 40, marginLeft: 8, textAlign: 'right', fontFamily: fonts.number, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] }}>
      {shown}
    </Text>
  );
}

const TONES: Record<SeatTag['tone'], { fg: string; bg: string }> = {
  gold: { fg: colors.gold, bg: alpha(colors.gold, 0.14) },
  ok: { fg: colors.okText, bg: colors.okBg },
  dim: { fg: colors.dim, bg: alpha(colors.surface, 0.85) },
  bad: { fg: colors.danger, bg: colors.dangerBg },
};

/** Status pill that pops in whenever its text changes. */
function Tag({ tag }: { tag?: SeatTag }) {
  if (!tag) return null;
  const tone = TONES[tag.tone];
  return (
    <Pop from={0.6}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: tone.bg }}>
        {tag.locked && (
          <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={tone.fg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={5} y={11} width={14} height={10} rx={2} />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </Svg>
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: tone.fg, fontVariant: ['tabular-nums'] }}>{tag.text}</Text>
      </View>
    </Pop>
  );
}
