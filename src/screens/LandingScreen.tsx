import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Enter, SparkleBurst } from '../components/Effects';
import { HatMood, HatWizard, SparkleShape } from '../components/HatWizard';
import { RankBadge } from '../components/Rank';
import { ScoreboardSheet } from '../components/Scoreboard';
import { Sheet } from '../components/Sheet';
import { ArrowIcon, MenuCard, MuteButton, styles, TrophyIcon, UsersIcon } from '../components/ui';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

export type MenuChoice = 'ranked' | 'lobby';

const STEPS = [
  { icon: 'dial', title: 'Guess the %', body: 'When it’s your turn, spin the dial to your best guess.' },
  { icon: 'arrows', title: 'Call it', body: 'Everyone else bets whether the real answer is higher or lower.' },
  { icon: 'star', title: 'Score', body: 'Guessers earn 100 minus how far off they were (bullseye = 150). Right calls earn 100.' },
] as const;

export function LandingScreen({ onChoose }: { onChoose: (choice: MenuChoice) => void }) {
  const { height } = useWindowDimensions();
  const hatSize = Math.min(220, height * 0.26);
  const [burst, setBurst] = useState(0);
  const [mood, setMood] = useState<HatMood>('wave');
  const [help, setHelp] = useState(false);
  const [board, setBoard] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const choose = (choice: MenuChoice) => {
    if (leaving) return;
    setLeaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx('sparkle');
    setMood('cast');
    setBurst((n) => n + 1);
    setTimeout(() => onChoose(choice), 550);
  };

  return (
    <View style={[styles.screen, { justifyContent: 'space-between' }]}>
      <View style={styles.topBar}>
        <Enter from={-10}>
          <RankBadge onPress={() => setBoard(true)} />
        </Enter>
        <MuteButton />
      </View>

      <View style={{ alignItems: 'center' }}>
        <Enter from={30} scale>
          <View style={{ width: hatSize, height: hatSize }}>
            <SparkleBurst trigger={burst} count={18} radius={hatSize * 0.7} />
            <HatWizard size={hatSize} mood={mood} onPress={() => playSfx('sparkle')} />
          </View>
        </Enter>
        <Enter delay={180}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SparkleShape size={11} color={colors.gold} />
              <Text style={[styles.eyebrow, { color: colors.gold }]}>The Hat presents</Text>
              <SparkleShape size={11} color={colors.gold} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.text, textAlign: 'center' }}>
              Higher <Text style={{ fontFamily: fonts.serifItalic, color: colors.magic }}>or</Text> Lower
            </Text>
            <Text style={[styles.body, { textAlign: 'center', maxWidth: 300 }]}>A trivia game of percentages, guesswork and a little bit of magic.</Text>
          </View>
        </Enter>
      </View>

      <View style={{ gap: 14 }}>
        <Enter delay={340}>
          <MenuCard primary title="Play Ranked" subtitle="Match with 4 rivals · 6 rounds" icon={<TrophyIcon />} onPress={() => choose('ranked')} />
        </Enter>
        <Enter delay={440}>
          <MenuCard title="Play in Lobby" subtitle="Create a room or join with a code" icon={<UsersIcon />} onPress={() => choose('lobby')} />
        </Enter>
        <Enter delay={540}>
          <Pressable accessibilityRole="button" onPress={() => setHelp(true)} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted, textDecorationLine: 'underline', textDecorationColor: colors.borderStrong }}>How to play</Text>
          </Pressable>
        </Enter>
      </View>

      <HowToSheet visible={help} onClose={() => setHelp(false)} />
      <ScoreboardSheet visible={board} onClose={() => setBoard(false)} />
    </View>
  );
}

/** The three rules, in the shared bottom sheet. */
function HowToSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="How to play" icon={<HatWizard size={48} mood="idle" aura={false} />}>
      {STEPS.map((s, i) => (
        <View key={s.title} style={[styles.row, { paddingVertical: 12, gap: 14, alignItems: 'flex-start' }]}>
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.magic, 0.12), borderWidth: 1, borderColor: alpha(colors.magic, 0.3) }}>
            <StepIcon icon={s.icon} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>
              {i + 1}. {s.title}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted }}>{s.body}</Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

function StepIcon({ icon }: { icon: (typeof STEPS)[number]['icon'] }) {
  if (icon === 'arrows')
    return (
      <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
        <ArrowIcon dir="up" color={colors.higher} size={18} />
        <ArrowIcon dir="down" color={colors.lower} size={18} />
      </View>
    );
  if (icon === 'star') return <SparkleShape size={20} color={colors.gold} />;
  return <Text style={{ fontFamily: fonts.number, fontSize: 16, color: colors.magic }}>%</Text>;
}
