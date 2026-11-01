import { useEffect } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { Confetti, Enter, Pop } from '../components/Effects';
import { HatWizard, SparkleShape } from '../components/HatWizard';
import { Avatar, GhostButton, PrimaryButton, SectionHeader, SoundButton, styles, WandIcon } from '../components/ui';
import { RankEmblem, RankProgress } from '../components/Rank';
import { ordinal } from '../components/Scoreboard';
import { RankedResult, rankFor } from '../game/rank';
import type { Player } from '../game/types';
import { native, useAnimatedValue, useCountUp, useReduceMotion } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

const MEDALS = [colors.gold, '#C9D3E6', '#D08A52'];

type Props = { players: Player[]; ranked: boolean; rank?: RankedResult; onRestart: () => void; onMenu: () => void };

export function GameOverScreen({ players, ranked: rankedMatch, rank, onRestart, onMenu }: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  const score = useCountUp(winner.score, { duration: 1400, delay: 500 });

  useEffect(() => {
    playSfx(winner.isYou ? 'win' : 'lose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Confetti count={48} duration={4200} />
      <View style={{ alignItems: 'flex-end' }}>
        <SoundButton />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ width: 220, height: 200, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Rays />
          <Pop from={0.3}>
            <Avatar initials={winner.initials} color={winner.color} size={96} ring={colors.gold} />
          </Pop>
          {/* The Hat crowns the champion. */}
          <Enter delay={450} from={-60} style={{ position: 'absolute', top: 4 }}>
            <HatWizard size={130} mood="cheer" aura={false} />
          </Enter>
        </View>
        <Enter delay={250}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SparkleShape size={11} color={colors.gold} />
              <Text style={[styles.eyebrow, { color: colors.gold }]}>The Hat crowns its champion</Text>
              <SparkleShape size={11} color={colors.gold} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 42, lineHeight: 48, color: colors.text, textAlign: 'center' }}>
              {winner.isYou ? 'You win!' : `${winner.name} wins!`}
            </Text>
            <Text style={{ fontFamily: fonts.number, fontSize: 20, color: colors.gold, fontVariant: ['tabular-nums'] }}>{score} points</Text>
          </View>
        </Enter>
        {rank ? (
          <Enter delay={700} style={{ alignSelf: 'stretch' }}>
            <RankChange result={rank} />
          </Enter>
        ) : !rankedMatch ? (
          <Text style={[styles.eyebrow, { color: colors.dim }]}>Friendly lobby game · rank unchanged</Text>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        <SectionHeader left="Final scores" />
        <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
          {ranked.map((p, i) => (
            <Enter key={p.id} delay={600 + i * 90}>
              <View style={[styles.row, i === 0 && { borderColor: alpha(colors.gold, 0.6), backgroundColor: alpha(colors.gold, 0.08) }]}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < 3 ? MEDALS[i] : colors.track }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: i < 3 ? colors.ink : colors.muted }}>{i + 1}</Text>
                </View>
                <Avatar initials={p.initials} color={p.color} />
                <Text style={styles.rowName}>{p.isYou ? 'You' : p.name}</Text>
                <Text style={{ fontFamily: fonts.number, fontSize: 18, color: i === 0 ? colors.gold : colors.text, fontVariant: ['tabular-nums'] }}>{p.score}</Text>
              </View>
            </Enter>
          ))}
        </ScrollView>
      </View>

      <Enter delay={900}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GhostButton label="Menu" onPress={onMenu} style={{ height: 65, paddingHorizontal: 22 }} />
          <PrimaryButton label="Play again" icon={<WandIcon />} onPress={onRestart} style={{ flex: 1 }} />
        </View>
      </Enter>
    </View>
  );
}

/** Your RP swing for a ranked match, with the bar filling to the new total and any promotion. */
function RankChange({ result }: { result: RankedResult }) {
  const before = rankFor(result.before);
  const after = rankFor(result.after);
  const shown = useCountUp(result.after, { from: result.before, duration: 1200, delay: 900 });
  const up = result.delta >= 0;
  const tierMoved = before.tier.name !== after.tier.name;
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 8, borderColor: alpha(after.tier.color, 0.5), backgroundColor: alpha(after.tier.color, 0.07) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <RankEmblem color={after.tier.color} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: after.tier.color }}>{after.label}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
            {ordinal(result.place)} of {result.of} · {shown.toLocaleString()} RP
          </Text>
        </View>
        <Pop>
          <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: up ? colors.okBg : colors.dangerBg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: up ? colors.okText : colors.danger, fontVariant: ['tabular-nums'] }}>
              {up ? '+' : ''}
              {result.delta} RP
            </Text>
          </View>
        </Pop>
      </View>
      <RankProgress from={tierMoved ? 0 : before.progress} to={after.progress} color={after.tier.color} />
      {tierMoved && (
        <Pop>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: up ? colors.gold : colors.muted, textAlign: 'center' }}>
            {up ? `Promoted to ${after.tier.name}!` : `Dropped to ${after.tier.name}`}
          </Text>
        </Pop>
      )}
    </View>
  );
}

/** Slowly turning sunburst behind the champion. */
function Rays() {
  const reduce = useReduceMotion();
  const spin = useAnimatedValue(0);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [spin, reduce]);
  const size = 260;
  const c = size / 2;
  const rays = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const w = 0.09;
    const p = (ang: number, r: number) => `${c + Math.cos(ang) * r} ${c + Math.sin(ang) * r}`;
    return `M ${c} ${c} L ${p(a - w, c)} L ${p(a + w, c)} Z`;
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        bottom: 48 - size / 2,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="rays" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.gold} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {rays.map((d, i) => (
          <Path key={i} d={d} fill="url(#rays)" />
        ))}
      </Svg>
    </Animated.View>
  );
}
