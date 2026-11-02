import { Text, View } from 'react-native';
import type { SeatTag, TableState } from '../game/table';
import type { Player } from '../game/types';
import { alpha, colors, fonts } from '../theme';
import { AnimalSwatch } from './AnimalSwatch';
import { useSeatLook } from './store';

/** Up to this many players sit in one row of cards; more get a two-column table. */
const ROOMY_MAX = 4;

const TONE: Record<SeatTag['tone'], string> = {
  gold: colors.gold,
  ok: colors.okText,
  dim: colors.muted,
  bad: colors.danger,
};

/**
 * Everyone at the table along the bottom of the guess and vote screens, in seat order: their
 * animal, score and what they're up to. The guesser's card glows gold.
 */
export function PlayerStrip({ players, table }: { players: Player[]; table: TableState }) {
  const seatLook = useSeatLook();
  const roomy = players.length <= ROOMY_MAX;

  return (
    <View
      accessibilityLabel="Players"
      style={{
        flexDirection: 'row',
        flexWrap: roomy ? 'nowrap' : 'wrap',
        gap: roomy ? 8 : 6,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: colors.surfaceAlt,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {players.map((p) => {
        const name = p.isYou ? 'You' : p.name;
        const score = table.scores[p.id] ?? p.score;
        const tag = table.tags[p.id];
        const guessing = p.id === table.spotlight;
        const card = {
          borderRadius: roomy ? 14 : 12,
          borderWidth: 1,
          borderColor: guessing ? alpha(colors.gold, 0.65) : p.isYou ? alpha(colors.magic, 0.45) : 'transparent',
          backgroundColor: guessing ? alpha(colors.gold, 0.12) : 'transparent',
        };
        const label = `${name}, ${score} points${tag ? `, ${tag.text}` : ''}`;

        return roomy ? (
          <View key={p.id} accessible accessibilityLabel={label} style={[card, { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 4 }]}>
            <AnimalSwatch look={seatLook(p)} size={40} />
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: p.isYou ? colors.magic : colors.text }}>
              {name}
            </Text>
            <Text style={{ fontFamily: fonts.number, fontSize: 14, color: colors.gold, fontVariant: ['tabular-nums'] }}>{score}</Text>
            {tag && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: TONE[tag.tone], fontVariant: ['tabular-nums'] }}>{tag.text}</Text>}
          </View>
        ) : (
          <View key={p.id} accessible accessibilityLabel={label} style={[card, { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 8 }]}>
            <AnimalSwatch look={seatLook(p)} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: p.isYou ? colors.magic : colors.text }}>
                {name}
              </Text>
              {tag && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: TONE[tag.tone], fontVariant: ['tabular-nums'] }}>{tag.text}</Text>}
            </View>
            <Text style={{ fontFamily: fonts.number, fontSize: 15, color: colors.gold, fontVariant: ['tabular-nums'] }}>{score}</Text>
          </View>
        );
      })}
    </View>
  );
}
