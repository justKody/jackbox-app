import { Text, View } from 'react-native';
import { rankFor, rpDelta, standings, useLadder } from '../game/rank';
import { ROSTER } from '../game/useGame';
import { alpha, colors, fonts } from '../theme';
import { Enter } from './Effects';
import { HatWizard } from './HatWizard';
import { RankEmblem, RankProgress } from './Rank';
import { Sheet } from './Sheet';
import { Avatar, SectionHeader, styles, TrophyIcon } from './ui';

const MEDALS = [colors.gold, '#C9D3E6', '#D08A52'];

/** Your rank card, recent ranked results and the ladder standings. */
export function ScoreboardSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ladder = useLadder();
  const rp = ladder.ratings.you;
  const rank = rankFor(rp);
  const rows = standings(ladder);
  const winRate = ladder.played ? Math.round((ladder.wins / ladder.played) * 100) : 0;
  const win = rpDelta(1, ROSTER.length);
  const last = rpDelta(ROSTER.length, ROSTER.length);

  return (
    <Sheet visible={visible} onClose={onClose} title="Scoreboard" icon={<TrophyIcon color={colors.gold} />}>
      {/* Your rank */}
      <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: 16, borderColor: alpha(rank.tier.color, 0.45), backgroundColor: alpha(rank.tier.color, 0.07) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <RankEmblem color={rank.tier.color} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Your rank</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: rank.tier.color }}>{rank.label}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.number, fontSize: 26, color: colors.text, fontVariant: ['tabular-nums'] }}>{rp.toLocaleString()}</Text>
            <Text style={styles.eyebrow}>RP</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <RankProgress to={rank.progress} from={0} color={rank.tier.color} height={8} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>
            {rank.next ? `${rank.toNext} RP to ${rank.next.name}` : 'Top tier — the Hat bows to you'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Ranked games" value={ladder.played} />
          <Stat label="Win rate" value={`${winRate}%`} />
          <Stat label="Best score" value={ladder.best} />
        </View>
      </View>

      {/* Recent results */}
      {ladder.history.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader left="Recent ranked games" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ladder.history.slice(0, 6).map((m) => (
              <View key={m.at} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', minWidth: 62 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: m.place === 1 ? colors.gold : colors.text }}>
                  {ordinal(m.place)}
                  <Text style={{ color: colors.dim }}> / {m.of}</Text>
                </Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: m.delta >= 0 ? colors.okText : colors.danger, fontVariant: ['tabular-nums'] }}>
                  {m.delta >= 0 ? '+' : ''}
                  {m.delta} RP
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.row, { gap: 10 }]}>
          <HatWizard size={54} mood="wave" aura={false} />
          <Text style={[styles.body, { flex: 1, color: colors.text }]}>Play a ranked game to start climbing the ladder.</Text>
        </View>
      )}

      {/* Standings */}
      <View style={{ gap: 8 }}>
        <SectionHeader left="Standings" right="RP" />
        {rows.map(({ seat, rp: points, position }, i) => {
          const r = rankFor(points);
          return (
            <Enter key={seat.id} delay={120 + i * 60}>
              <View style={[styles.row, seat.isYou && { borderColor: alpha(colors.magic, 0.55), backgroundColor: alpha(colors.magic, 0.07) }]}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: position <= 3 ? MEDALS[position - 1] : colors.track }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: position <= 3 ? colors.ink : colors.muted }}>{position}</Text>
                </View>
                <Avatar initials={seat.initials} color={seat.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.text }}>{seat.isYou ? 'You' : seat.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <RankEmblem color={r.tier.color} size={12} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: r.tier.color }}>{r.label}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.number, fontSize: 17, color: seat.isYou ? colors.magic : colors.text, fontVariant: ['tabular-nums'] }}>{points.toLocaleString()}</Text>
              </View>
            </Enter>
          );
        })}
      </View>

      <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.dim, textAlign: 'center' }}>
        Ranked: 1st place +{win} RP, last place {last} RP. Lobby games don’t affect your rank.
      </Text>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={{ flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: alpha(colors.bg, 0.5), alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
