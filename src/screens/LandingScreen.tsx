import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AnimalSwatch } from '../avatar/AnimalSwatch';
import { useWardrobe } from '../avatar/store';
import { SKINS } from '../avatar/skins';
import { Enter, SparkleBurst } from '../components/Effects';
import { HatWizard, SparkleShape } from '../components/HatWizard';
import { RankBadge } from '../components/Rank';
import { ScoreboardSheet } from '../components/Scoreboard';
import { Sheet } from '../components/Sheet';
import { ArrowIcon, MenuCard, SoundButton, styles, TrophyIcon, UsersIcon } from '../components/ui';
import { useReduceMotion } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts } from '../theme';

export type MenuChoice = 'ranked' | 'lobby' | 'avatar';

const STEPS = [
  { icon: 'dial', title: 'Guess the %', body: 'When it’s your turn, spin the dial to your best guess.' },
  { icon: 'arrows', title: 'Call it', body: 'Everyone else bets whether the real answer is higher or lower.' },
  { icon: 'star', title: 'Score', body: 'Guessers earn 100 minus how far off they were (bullseye = 150). Right calls earn 100.' },
] as const;

export function LandingScreen({ onChoose }: { onChoose: (choice: MenuChoice) => void }) {
  const { height } = useWindowDimensions();
  // Three menu cards now, so the Hat gives up a little height on short phones.
  const hatSize = Math.min(210, height * 0.22);
  const { animal, equipped, look, ownedCount, newCount } = useWardrobe();
  const reduce = useReduceMotion();
  const [burst, setBurst] = useState(0);
  const [help, setHelp] = useState(false);
  const [board, setBoard] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const choose = (choice: MenuChoice) => {
    if (leaving) return;
    setLeaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx('sparkle');
    setBurst((n) => n + 1);
    setTimeout(() => onChoose(choice), 550);
  };

  return (
    <View style={[styles.screen, { justifyContent: 'space-between' }]}>
      <View style={styles.topBar}>
        <Enter from={-10}>
          <RankBadge onPress={() => setBoard(true)} />
        </Enter>
        <SoundButton />
      </View>

      <View style={{ alignItems: 'center' }}>
        <Enter from={30} scale>
          <View style={{ width: hatSize, height: hatSize }}>
            <SparkleBurst trigger={burst} count={18} radius={hatSize * 0.7} />
            <Pressable onPress={() => playSfx('sparkle')} accessibilityRole="imagebutton" accessibilityLabel="The Hat">
              {/* Hand-drawn loop, keyed off green screen into a transparent animated WebP. */}
              <Image source={require('../../assets/wizard-menu.webp')} autoplay={!reduce} contentFit="contain" style={{ width: hatSize, height: hatSize }} />
            </Pressable>
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

      <View style={{ gap: 12 }}>
        <Enter delay={340}>
          <MenuCard primary title="Play Ranked" subtitle="Match with 4 rivals · 6 rounds" icon={<TrophyIcon />} onPress={() => choose('ranked')} />
        </Enter>
        <Enter delay={440}>
          <MenuCard title="Play in Lobby" subtitle="Create a room or join with a code" icon={<UsersIcon />} onPress={() => choose('lobby')} />
        </Enter>
        <Enter delay={540}>
          <MenuCard
            title="Avatar"
            subtitle={`${equipped.id === 'natural' ? animal.name : `${equipped.name} ${animal.name}`} · ${ownedCount}/${SKINS.length} skins`}
            badge={newCount ? `${newCount} new` : undefined}
            icon={<AnimalSwatch look={look} size={44} />}
            onPress={() => choose('avatar')}
          />
        </Enter>
        <Enter delay={640}>
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
