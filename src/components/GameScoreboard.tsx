import { useEffect } from 'react';
import { Animated, Text, View } from 'react-native';
import type { Player } from '../game/types';
import { native, useAnimatedValue } from '../motion';
import { alpha, colors, fonts } from '../theme';
import { Avatar } from './ui';

/** How far the guesser's card steps out of the line. */
const GUESSER_SHIFT = 18;

/** The match so far, best score first, with whoever is guessing nudged out of the line. */
export function GameScoreboard({ players, guesserId }: { players: Player[]; guesserId: string }) {
  const rows = [...players].sort((a, b) => b.score - a.score);
  return (
    // Room on the right for the guesser's card to slide into.
    <View style={{ gap: 6, paddingRight: GUESSER_SHIFT }} accessibilityLabel="Scoreboard">
      {rows.map((p, i) => (
        <Row key={p.id} player={p} place={i + 1} guessing={p.id === guesserId} />
      ))}
    </View>
  );
}

function Row({ player, place, guessing }: { player: Player; place: number; guessing: boolean }) {
  const shift = useAnimatedValue(0);
  useEffect(() => {
    Animated.spring(shift, { toValue: guessing ? 1 : 0, friction: 7, tension: 140, useNativeDriver: native }).start();
  }, [guessing, shift]);

  return (
    <Animated.View
      accessibilityLabel={`${place}. ${player.name}, ${player.score} points${guessing ? ', guessing' : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: guessing ? alpha(colors.gold, 0.65) : colors.border,
        backgroundColor: guessing ? alpha(colors.gold, 0.12) : colors.surfaceAlt,
        transform: [{ translateX: shift.interpolate({ inputRange: [0, 1], outputRange: [0, GUESSER_SHIFT] }) }],
      }}
    >
      <Text style={{ width: 16, fontFamily: fonts.bold, fontSize: 13, color: colors.muted, textAlign: 'center' }}>{place}</Text>
      <Avatar initials={player.initials} color={player.color} size={26} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: player.isYou ? colors.magic : colors.text }}>
        {player.name}
      </Text>
      {guessing && (
        <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: alpha(colors.gold, 0.2) }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.gold }}>Guessing</Text>
        </View>
      )}
      <Text style={{ minWidth: 40, textAlign: 'right', fontFamily: fonts.number, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] }}>
        {player.score}
      </Text>
    </Animated.View>
  );
}
