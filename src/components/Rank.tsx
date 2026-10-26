import { useEffect, useId } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { rankFor, standings, useLadder } from '../game/rank';
import { native, useAnimatedValue } from '../motion';
import { alpha, colors, fonts, shade } from '../theme';
import { ChevronIcon } from './ui';

/** Tier crest: a shield in the tier's colour with a sparkle at its heart. */
export function RankEmblem({ color, size = 36 }: { color: string; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44">
      <Defs>
        <LinearGradient id={`crest${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(color, 0.25)} />
          <Stop offset="1" stopColor={shade(color, -0.45)} />
        </LinearGradient>
      </Defs>
      <Path d="M20 2 L36 8 V22 C36 32 29 39 20 42 C11 39 4 32 4 22 V8 Z" fill={`url(#crest${id})`} stroke={shade(color, 0.5)} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M20 7 L31 11.2 V22 C31 29 26 34.5 20 37" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />
      <Path d="M20 12 C20.8 19 23 21.2 30 22 C23 22.8 20.8 25 20 32 C19.2 25 17 22.8 10 22 C17 21.2 19.2 19 20 12 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/** A slim bar that fills from `from` to `to` (both 0–1) on mount. */
export function RankProgress({ to, from = to, color, height = 6 }: { to: number; from?: number; color: string; height?: number }) {
  const v = useAnimatedValue(from);
  useEffect(() => {
    Animated.timing(v, { toValue: to, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [to, v]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.track, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, transformOrigin: 'left', transform: [{ scaleX: v }] }} />
    </View>
  );
}

/** Top-left of the menu: your tier, ladder position and RP. Tapping opens the scoreboard. */
export function RankBadge({ onPress }: { onPress: () => void }) {
  const ladder = useLadder();
  const rp = ladder.ratings.you;
  const rank = rankFor(rp);
  const position = standings(ladder).find((r) => r.seat.isYou)!.position;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your rank: ${rank.label}, number ${position}, ${rp} RP. Open scoreboard`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        paddingLeft: 8,
        paddingRight: 12,
        borderRadius: 18,
        backgroundColor: pressed ? colors.surfaceRaised : alpha(colors.surface, 0.9),
        borderWidth: 1,
        borderColor: alpha(rank.tier.color, 0.45),
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <RankEmblem color={rank.tier.color} size={30} />
      <View style={{ gap: 3, minWidth: 92 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: rank.tier.color }}>{rank.label}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
          #{position} · {rp.toLocaleString()} RP
        </Text>
        <RankProgress to={rank.progress} color={rank.tier.color} height={3} />
      </View>
      <ChevronIcon size={14} color={colors.muted} />
    </Pressable>
  );
}
