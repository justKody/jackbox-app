import * as Haptics from 'expo-haptics';
import { memo, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AnimalSwatch } from '../avatar/AnimalSwatch';
import { CharacterStage } from '../avatar/CharacterStage';
import { Animal, ANIMALS, Look, lookFor, RARITY, Skin, skinById, SKINS } from '../avatar/skins';
import { chooseAnimal, equipSkin, markSeen, UnlockProgress, unlockProgress, useWardrobe } from '../avatar/store';
import { Enter } from '../components/Effects';
import { SparkleShape } from '../components/HatWizard';
import { RankProgress } from '../components/Rank';
import { ChevronIcon, LockIcon, PrimaryButton, RoundButton, SoundButton, styles } from '../components/ui';
import { native, useAnimatedValue } from '../motion';
import { playSfx } from '../sound';
import { alpha, colors, fonts, radii } from '../theme';

const lookName = (animal: Animal, skin: Skin) => (skin.id === 'natural' ? animal.name : `${skin.name} ${animal.name}`);

/** Your character: pick an animal, try skins on it in 3D, equip the ones you've earned. */
export function AvatarScreen({ onBack }: { onBack: () => void }) {
  const { ladder, animal, equipped, owns, isNew, ownedCount } = useWardrobe();
  const [previewId, setPreviewId] = useState(equipped.id);
  const preview = skinById(previewId);
  const look = lookFor(animal.id, preview.id);

  // Opening a skin you own clears its "New" badge.
  useEffect(() => markSeen(previewId), [previewId]);

  // Stable pickers (reading the current selection from refs), so a tap only re-renders the
  // tiles whose state changed — React work on a tap competes with the 3D twirl for frames.
  const current = useRef({ skin: previewId, animal: animal.id });
  useEffect(() => {
    current.current = { skin: previewId, animal: animal.id };
  });
  const pickSkin = useCallback((skin: Skin) => {
    if (skin.id === current.current.skin) return;
    Haptics.selectionAsync();
    playSfx('vote');
    setPreviewId(skin.id);
  }, []);
  const pickAnimal = useCallback((a: Animal) => {
    if (a.id === current.current.animal) return;
    Haptics.selectionAsync();
    playSfx('sparkle');
    chooseAnimal(a.id);
  }, []);

  const equip = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx('correct');
    equipSkin(preview.id);
  };

  return (
    <View style={[styles.screen, { paddingHorizontal: 0, gap: 10 }]}>
      <View style={[styles.topBar, { paddingHorizontal: 20 }]}>
        <RoundButton label="Back to menu" onPress={onBack}>
          <ChevronIcon dir="left" size={18} />
        </RoundButton>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.eyebrow}>Your character</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.text }}>Avatar</Text>
        </View>
        <SoundButton />
      </View>

      <View style={{ flex: 1, minHeight: 200 }}>
        <Stage look={look} label={lookName(animal, preview)} tryOn={!owns(preview.id)} />
      </View>

      <Enter delay={120} style={{ paddingHorizontal: 20 }}>
        <Details animal={animal} skin={preview} />
      </Enter>

      <Enter delay={180}>
        <Rail title="Character" right={`${ANIMALS.length} animals`}>
          {ANIMALS.map((a) => (
            <AnimalChip key={a.id} animal={a} look={lookFor(a.id, preview.id)} selected={a.id === animal.id} onPick={pickAnimal} />
          ))}
        </Rail>
      </Enter>

      <Enter delay={240}>
        <Rail
          title="Skins"
          right={
            <Text style={[styles.eyebrow, { color: colors.text }]}>
              {ownedCount}
              <Text style={{ color: colors.dim }}> / {SKINS.length} collected</Text>
            </Text>
          }
        >
          {SKINS.map((s) => (
            <SkinTile key={s.id} skin={s} look={lookFor(animal.id, s.id)} selected={s.id === previewId} equipped={s.id === equipped.id} owned={owns(s.id)} fresh={isNew(s.id)} onPick={pickSkin} />
          ))}
        </Rail>
      </Enter>

      <Enter delay={300} style={{ paddingHorizontal: 20 }}>
        {owns(preview.id) ? (
          preview.id === equipped.id ? (
            <View accessibilityRole="text" accessibilityLabel={`${preview.name} is equipped`} style={[styles.ghost, { height: 60, borderColor: alpha(colors.okText, 0.35), backgroundColor: colors.okBg }]}>
              <CheckIcon color={colors.okText} />
              <Text style={[styles.ghostText, { color: colors.okText }]}>Equipped</Text>
            </View>
          ) : (
            <PrimaryButton label={`Equip ${preview.name}`} onPress={equip} icon={<SparkleShape size={16} color={colors.ink} />} />
          )
        ) : (
          <LockedPanel skin={preview} progress={unlockProgress(preview, ladder)} />
        )}
      </Enter>
    </View>
  );
}

/** The 3D character with a one-time hint that fades the first time you touch it. */
function Stage({ look, label, tryOn }: { look: Look; label: string; tryOn: boolean }) {
  const hint = useAnimatedValue(1);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) return;
    Animated.timing(hint, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [touched, hint]);

  return (
    <View style={{ flex: 1 }}>
      <CharacterStage look={look} label={label} style={{ flex: 1 }} onTouch={() => setTouched(true)} onPoke={() => playSfx('sparkle')} />
      {tryOn && (
        <View pointerEvents="none" style={[styles.pill, { position: 'absolute', top: 2, alignSelf: 'center', backgroundColor: alpha(colors.surface, 0.85), borderColor: colors.borderStrong }]}>
          <LockIcon color={colors.muted} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted }}>Trying it on — not unlocked yet</Text>
        </View>
      )}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 2, alignSelf: 'center', opacity: hint }}>
        <View style={[styles.pill, { backgroundColor: alpha(colors.surface, 0.8) }]}>
          <SpinIcon />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted }}>Drag to spin · Tap to poke</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function Details({ animal, skin }: { animal: Animal; skin: Skin }) {
  const rarity = RARITY[skin.rarity];
  // Re-runs on every change so the name and blurb slide in with the twirl.
  const t = useAnimatedValue(0);
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [skin.id, animal.id, t]);

  return (
    <Animated.View style={{ alignItems: 'center', gap: 2, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SparkleShape size={10} color={rarity.color} />
        <Text style={[styles.eyebrow, { color: rarity.color }]}>{rarity.label}</Text>
        <SparkleShape size={10} color={rarity.color} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text, textAlign: 'center' }}>{lookName(animal, skin)}</Text>
      <Text numberOfLines={2} style={[styles.body, { textAlign: 'center', fontSize: 14, lineHeight: 19, maxWidth: 330, minHeight: 38 }]}>
        {skin.id === 'natural' ? animal.blurb : skin.blurb}
      </Text>
    </Animated.View>
  );
}

function Rail({ title, right, children }: { title: string; right: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
        <Text style={styles.eyebrow}>{title}</Text>
        {typeof right === 'string' ? <Text style={[styles.eyebrow, { color: colors.dim }]}>{right}</Text> : right}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 4 }}>
        {children}
      </ScrollView>
    </View>
  );
}

/** Springs up a few px when selected. */
function useLift(selected: boolean) {
  const lift = useAnimatedValue(selected ? 1 : 0);
  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, friction: 6, tension: 160, useNativeDriver: native }).start();
  }, [selected, lift]);
  return [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }];
}

const AnimalChip = memo(
  function AnimalChip({ animal, look, selected, onPick }: { animal: Animal; look: Look; selected: boolean; onPick: (a: Animal) => void }) {
    const transform = useLift(selected);
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Play as ${animal.name}`} onPress={() => onPick(animal)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <Animated.View style={{ alignItems: 'center', gap: 3, transform }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.surfaceRaised : alpha(colors.surface, 0.9),
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.magic : colors.border,
            }}
          >
            <AnimalSwatch look={look} size={42} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: selected ? colors.text : colors.muted }}>{animal.name}</Text>
        </Animated.View>
      </Pressable>
    );
  },
  (a, b) => a.animal.id === b.animal.id && a.look.key === b.look.key && a.selected === b.selected && a.onPick === b.onPick,
);

const SkinTile = memo(
  function SkinTile({ skin, look, selected, equipped, owned, fresh, onPick }: { skin: Skin; look: Look; selected: boolean; equipped: boolean; owned: boolean; fresh: boolean; onPick: (s: Skin) => void }) {
    const rarity = RARITY[skin.rarity];
    const transform = useLift(selected);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${skin.name} skin, ${rarity.label}${equipped ? ', equipped' : owned ? '' : ', locked'}${fresh ? ', new' : ''}`}
        onPress={() => onPick(skin)}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Animated.View
          style={{
            width: 74,
            paddingTop: 7,
            paddingBottom: 8,
            alignItems: 'center',
            gap: 3,
            borderRadius: radii.lg,
            overflow: 'hidden',
            backgroundColor: selected ? colors.surfaceRaised : alpha(colors.surface, 0.9),
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? colors.magic : colors.border,
            transform,
          }}
        >
          <View style={{ opacity: owned ? 1 : 0.38 }}>
            <AnimalSwatch look={look} size={46} />
          </View>
          {!owned && (
            <View style={{ position: 'absolute', top: 18, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.bg, 0.75), borderWidth: 1, borderColor: colors.borderStrong }}>
              <LockIcon color={colors.muted} />
            </View>
          )}
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 11, color: owned ? colors.text : colors.dim, paddingHorizontal: 4 }}>
            {skin.name.split(' ')[0]}
          </Text>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: rarity.color, opacity: owned ? 0.9 : 0.4 }} />
          {equipped && (
            <View style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.okText }}>
              <CheckIcon color={colors.ink} size={12} />
            </View>
          )}
          {fresh && !equipped && (
            <View style={[styles.menuBadge, { position: 'absolute', top: 5, left: 5, backgroundColor: colors.magic }]}>
              <Text style={[styles.menuBadgeText, { color: colors.ink, fontSize: 9 }]}>New</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    );
  },
  (a, b) =>
    a.skin.id === b.skin.id && a.look.key === b.look.key && a.selected === b.selected && a.equipped === b.equipped && a.owned === b.owned && a.fresh === b.fresh && a.onPick === b.onPick,
);

function LockedPanel({ skin, progress }: { skin: Skin; progress: UnlockProgress }) {
  const color = RARITY[skin.rarity].color;
  return (
    <View style={[styles.row, { height: 60, paddingVertical: 0, gap: 12, borderColor: alpha(color, 0.35), backgroundColor: alpha(color, 0.07) }]}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color, 0.14) }}>
        <LockIcon color={color} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>
            {progress.label}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
            {progress.have.toLocaleString()} / {progress.need.toLocaleString()} {progress.unit}
          </Text>
        </View>
        <RankProgress key={skin.id} to={progress.frac} from={0} color={color} height={5} />
      </View>
    </View>
  );
}

function CheckIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

function SpinIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12a9 4 0 0 0 18 0M21 12a9 4 0 0 0-15-3" />
      <Path d="M6 5v4h4" />
    </Svg>
  );
}
