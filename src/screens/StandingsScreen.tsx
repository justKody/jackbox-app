import { useEffect, useState } from 'react';
import { Animated, Easing, Text, useWindowDimensions, View } from 'react-native';
import { AnimalSwatch } from '../avatar/AnimalSwatch';
import { useSeatLook } from '../avatar/store';
import { Enter, Pop } from '../components/Effects';
import { PrimaryButton, styles, TopBar } from '../components/ui';
import type { Player, RoundResult } from '../game/types';
import { native, prefersReducedMotion, useAnimatedValue } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

type Props = {
  round: number;
  total: number;
  /** Everyone with their new totals; the round's points come from `results`. */
  players: Player[];
  results: RoundResult[];
  isLastRound: boolean;
  onNext: () => void;
};

/** When each beat lands, in ms after the screen opens. */
const CHIPS_AT = 400;
const COUNT_AT = 900;
const MOVE_AT = 1700;
const COUNT_MS = 700;
const MOVE_MS = 700;

type Stage = 'start' | 'chips' | 'counted' | 'moved';

type Row = {
  player: Player;
  before: number;
  after: number;
  points: number;
  /** 0-based list positions, best first. */
  from: number;
  to: number;
  /** 1-based places, shared on a tie. */
  oldPlace: number;
  newPlace: number;
};

/** Best first; ties keep seat order so nobody shuffles without cause. */
function order(players: Player[], score: (p: Player) => number) {
  return players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => score(b.p) - score(a.p) || a.i - b.i)
    .map(({ p }) => p.id);
}

function rows(players: Player[], results: RoundResult[]): Row[] {
  const points = (p: Player) => results.find((r) => r.playerId === p.id)?.points ?? 0;
  const before = (p: Player) => p.score - points(p);
  const oldOrder = order(players, before);
  const newOrder = order(players, (p) => p.score);
  return oldOrder.map((id, from) => {
    const p = players.find((q) => q.id === id)!;
    return {
      player: p,
      before: before(p),
      after: p.score,
      points: points(p),
      from,
      to: newOrder.indexOf(id),
      oldPlace: 1 + players.filter((q) => before(q) > before(p)).length,
      newPlace: 1 + players.filter((q) => q.score > p.score).length,
    };
  });
}

/**
 * Between the reveal and the next round: everyone in the old order with their old totals, then the
 * round's points pop on, the totals count up, and the cards slide into the new order — anyone who
 * overtook someone passes in front with a gold glow and a ▲ badge. Reduced motion shows the end.
 */
export function StandingsScreen({ round, total, players, results, isLastRound, onNext }: Props) {
  const { height } = useWindowDimensions();
  const rowH = height < 720 ? 54 : 64;
  const pitch = rowH + 8;
  const [reduce] = useState(prefersReducedMotion);
  const [stage, setStage] = useState<Stage>(reduce ? 'moved' : 'start');
  const list = rows(players, results);
  const anyClimb = list.some((r) => r.to < r.from);

  useEffect(() => {
    if (reduce) return;
    const timers = [
      setTimeout(() => setStage('chips'), CHIPS_AT),
      setTimeout(() => setStage('counted'), COUNT_AT),
      setTimeout(() => setStage('moved'), MOVE_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  useEffect(() => {
    if (stage === 'moved' && anyClimb && !reduce) playSfx('sparkle');
  }, [stage, anyClimb, reduce]);

  const left = total - round;
  return (
    <View style={styles.screen}>
      <TopBar round={round} total={total} label="Standings" />

      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.text }}>Standings</Text>
        <Text style={styles.body}>{isLastRound ? 'That was the last round' : `After round ${round} · ${left} ${left === 1 ? 'round' : 'rounds'} to go`}</Text>
      </View>

      <View accessibilityLabel="Standings" style={{ height: list.length * pitch - 8 }}>
        {list.map((r) => (
          <StandingRow key={r.player.id} row={r} stage={stage} rowH={rowH} pitch={pitch} reduce={reduce} />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <Enter delay={reduce ? 0 : MOVE_AT}>
        <PrimaryButton label={isLastRound ? 'See final scores' : 'Next round'} onPress={onNext} height={56} color={colors.magic} />
      </Enter>
    </View>
  );
}

function StandingRow({ row, stage, rowH, pitch, reduce }: { row: Row; stage: Stage; rowH: number; pitch: number; reduce: boolean }) {
  const seatLook = useSeatLook();
  const { player, before, after, points, from, to } = row;
  const climb = from - to;
  const counted = stage === 'counted' || stage === 'moved';
  const moved = stage === 'moved';
  const y = useAnimatedValue(reduce ? to * pitch : from * pitch);
  const glow = useAnimatedValue(0);

  useEffect(() => {
    if (!moved || reduce) return;
    const slide = Animated.timing(y, { toValue: to * pitch, duration: MOVE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: native });
    const flash =
      climb > 0
        ? Animated.sequence([
            Animated.timing(glow, { toValue: 1, duration: MOVE_MS / 2, useNativeDriver: native }),
            Animated.timing(glow, { toValue: 0, duration: MOVE_MS, delay: 300, useNativeDriver: native }),
          ])
        : null;
    slide.start();
    flash?.start();
    return () => {
      slide.stop();
      flash?.stop();
    };
  }, [moved, reduce, y, glow, to, pitch, climb]);

  const name = player.isYou ? 'You' : player.name;
  const won = points > 0;
  const place = counted ? row.newPlace : row.oldPlace;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${row.newPlace}. ${name}, ${after} points, plus ${points} this round`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: rowH,
        // Climbers pass in front of whoever they overtake.
        zIndex: climb > 0 ? 3 : climb < 0 ? 1 : 2,
        transform: [{ translateY: y }],
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 10,
          paddingRight: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: player.isYou ? alpha(colors.magic, 0.45) : colors.border,
          backgroundColor: player.isYou ? colors.surfaceRaised : colors.surfaceAlt,
        }}
      >
        <Text style={{ width: 22, textAlign: 'center', fontFamily: fonts.number, fontSize: 17, color: counted && place === 1 ? colors.gold : colors.muted }}>{place}</Text>
        <AnimalSwatch look={seatLook(player)} size={rowH - 22} />
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 16, color: player.isYou ? colors.magic : colors.text }}>
            {name}
          </Text>
          {moved && climb > 0 && (
            <Pop from={0.3}>
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.okBg }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.okText }}>▲{climb}</Text>
              </View>
            </Pop>
          )}
        </View>
        {stage !== 'start' && (
          <Pop from={0.3}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: won ? colors.okBg : colors.track }}>
              <Text style={{ fontFamily: fonts.number, fontSize: 14, color: won ? colors.okText : colors.dim, fontVariant: ['tabular-nums'] }}>+{points}</Text>
            </View>
          </Pop>
        )}
        <Total before={before} after={after} counting={counted} reduce={reduce} />
      </View>
      <Animated.View
        style={{ position: 'absolute', left: -1, right: -1, top: -1, bottom: -1, borderRadius: 18, borderWidth: 2, borderColor: colors.gold, backgroundColor: alpha(colors.gold, 0.12), opacity: glow, pointerEvents: 'none' }}
      />
    </Animated.View>
  );
}

/** The running total: the old one until `counting`, then it counts up to the new one in gold. */
function Total({ before, after, counting, reduce }: { before: number; after: number; counting: boolean; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? after : before);
  const v = useAnimatedValue(reduce ? after : before);

  useEffect(() => {
    if (!counting || reduce) return;
    const id = v.addListener(({ value }) => setShown(Math.round(value)));
    const a = Animated.timing(v, { toValue: after, duration: COUNT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [counting, reduce, after, v]);

  return (
    <Text style={{ minWidth: 52, textAlign: 'right', fontFamily: fonts.number, fontSize: 22, color: counting ? colors.gold : colors.text, fontVariant: ['tabular-nums'] }}>
      {shown}
    </Text>
  );
}
