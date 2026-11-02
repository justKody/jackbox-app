import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { Ladder, TIERS, useLadder } from '../game/rank';
import { animalById, DEFAULT_ANIMAL, DEFAULT_SKIN, Look, lookFor, RIVAL_LOOKS, Skin, skinById, SKINS } from './skins';

/**
 * Your character, saved on device: the animal you play as, its equipped skin, every skin you've
 * earned (kept even if your RP later dips below a tier) and which ones you've already looked at.
 */

const AVATAR_KEY = 'trivia:avatar';

type Wardrobe = { animal: string; equipped: string; earned: string[]; seen: string[] };

const FREE = SKINS.filter((s) => s.unlock.kind === 'free').map((s) => s.id);
const FRESH: Wardrobe = { animal: DEFAULT_ANIMAL.id, equipped: DEFAULT_SKIN.id, earned: FREE, seen: FREE };

let wardrobe: Wardrobe = FRESH;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const save = () => AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(wardrobe)).catch(() => {});

AsyncStorage.getItem(AVATAR_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Wardrobe>;
    wardrobe = {
      animal: animalById(saved.animal ?? '').id,
      equipped: saved.equipped && SKINS.some((s) => s.id === saved.equipped) ? saved.equipped : FRESH.equipped,
      earned: [...new Set([...FREE, ...(saved.earned ?? [])])],
      seen: [...new Set([...FREE, ...(saved.seen ?? [])])],
    };
    emit();
  })
  .catch(() => {});

function update(next: Partial<Wardrobe>) {
  wardrobe = { ...wardrobe, ...next };
  emit();
  save();
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type UnlockProgress = { met: boolean; have: number; need: number; label: string; unit: string; /** 0–1 */ frac: number };

/** How far you are towards a skin's unlock, from the ladder. */
export function unlockProgress(skin: Skin, ladder: Ladder): UnlockProgress {
  const u = skin.unlock;
  switch (u.kind) {
    case 'free':
      return { met: true, have: 1, need: 1, label: 'Unlocked from the start', unit: '', frac: 1 };
    case 'tier': {
      const i = Math.max(0, TIERS.findIndex((t) => t.name === u.tier));
      const need = TIERS[i].min;
      // Measured across the tier just below, so a fresh player doesn't look 80% of the way there.
      const from = TIERS[Math.max(0, i - 1)].min;
      const have = ladder.ratings.you;
      return { met: have >= need, have, need, label: `Reach ${u.tier} rank`, unit: 'RP', frac: clamp01((have - from) / Math.max(1, need - from)) };
    }
    case 'wins':
      return { met: ladder.wins >= u.count, have: ladder.wins, need: u.count, label: `Win ${u.count} ranked ${u.count === 1 ? 'match' : 'matches'}`, unit: 'wins', frac: clamp01(ladder.wins / u.count) };
    case 'played':
      return { met: ladder.played >= u.count, have: ladder.played, need: u.count, label: `Play ${u.count} ranked matches`, unit: 'played', frac: clamp01(ladder.played / u.count) };
  }
}

/** Earned skins stay earned; anything newly met on the ladder is banked. */
function bankUnlocks(ladder: Ladder) {
  const fresh = SKINS.filter((s) => !wardrobe.earned.includes(s.id) && unlockProgress(s, ladder).met).map((s) => s.id);
  if (fresh.length) update({ earned: [...wardrobe.earned, ...fresh] });
}

export function useWardrobe() {
  const ladder = useLadder();
  const w = useSyncExternalStore(subscribe, () => wardrobe);
  useEffect(() => bankUnlocks(ladder), [ladder]);

  const owns = (id: string) => w.earned.includes(id);
  return {
    ladder,
    animal: animalById(w.animal),
    equipped: skinById(w.equipped),
    look: lookFor(animalById(w.animal).id, w.equipped),
    owns,
    /** Owned but never opened in the wardrobe. */
    isNew: (id: string) => owns(id) && !w.seen.includes(id),
    ownedCount: SKINS.filter((s) => owns(s.id)).length,
    newCount: SKINS.filter((s) => owns(s.id) && !w.seen.includes(s.id)).length,
  };
}

export function equipSkin(id: string) {
  if (!wardrobe.earned.includes(id) || wardrobe.equipped === id) return;
  update({ equipped: id });
}

export function chooseAnimal(id: string) {
  if (wardrobe.animal === id) return;
  update({ animal: id });
}

type SeatLookOf = { id: string; animal?: string; skin?: string };

/** What a seat looks like at the table: you wear your wardrobe, online players what they picked, rivals have their own. */
export function useSeatLook(): (seat: SeatLookOf) => Look {
  const w = useSyncExternalStore(subscribe, () => wardrobe);
  return (seat) => {
    if (seat.id === 'you') return lookFor(animalById(w.animal).id, w.equipped);
    if (seat.animal) return lookFor(animalById(seat.animal).id, seat.skin ?? DEFAULT_SKIN.id);
    return RIVAL_LOOKS[seat.id] ?? lookFor('fox', 'natural');
  };
}

export function markSeen(id: string) {
  // Only owned skins count as seen, so a locked one still shows "New" the day you earn it.
  if (!wardrobe.earned.includes(id) || wardrobe.seen.includes(id)) return;
  update({ seen: [...wardrobe.seen, id] });
}
