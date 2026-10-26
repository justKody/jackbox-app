import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { Player } from './types';
import { ROSTER } from './useGame';

/**
 * The ranked ladder: everyone you play ranked with has a rating (RP), saved on device.
 * Only ranked games move RP; lobby games are just for fun.
 * To go online, replace load/save with the server's ladder and keep the same shapes.
 */

const LADDER_KEY = 'trivia:ladder';

export type Tier = { name: string; min: number; color: string };

/** Lowest first. Each tier spans 100 RP and is split into divisions III → I. */
export const TIERS: Tier[] = [
  { name: 'Apprentice', min: 0, color: '#A9B1C9' },
  { name: 'Adept', min: 1000, color: '#5CE1FF' },
  { name: 'Conjurer', min: 1100, color: '#9ACD5E' },
  { name: 'Sorcerer', min: 1200, color: '#A98BFF' },
  { name: 'Archmage', min: 1300, color: '#F4C15D' },
];

export type RankInfo = {
  tier: Tier;
  /** e.g. "II"; empty for the top tier, which has no divisions. */
  division: string;
  label: string;
  /** 0–1 progress through the current tier. */
  progress: number;
  next?: Tier;
  toNext: number;
};

export function rankFor(rp: number): RankInfo {
  let i = TIERS.length - 1;
  while (i > 0 && rp < TIERS[i].min) i--;
  const tier = TIERS[i];
  const next = TIERS[i + 1];
  const span = next ? next.min - tier.min : 100;
  const into = Math.max(0, rp - tier.min);
  const progress = next ? Math.min(1, into / span) : Math.min(1, into / 300);
  const division = next ? ['III', 'II', 'I'][Math.min(2, Math.floor(progress * 3))] : '';
  return { tier, division, label: division ? `${tier.name} ${division}` : tier.name, progress, next, toNext: next ? next.min - rp : 0 };
}

export type MatchRecord = { at: number; place: number; of: number; score: number; delta: number };

export type Ladder = {
  ratings: Record<string, number>;
  played: number;
  wins: number;
  best: number;
  history: MatchRecord[];
};

const FRESH: Ladder = {
  // Rivals start spread out so the board has some shape before your first match.
  ratings: { you: 1000, priya: 1185, sam: 1090, jordan: 1015, mika: 960 },
  played: 0,
  wins: 0,
  best: 0,
  history: [],
};

let ladder: Ladder = FRESH;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(LADDER_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Ladder;
    ladder = { ...FRESH, ...saved, ratings: { ...FRESH.ratings, ...saved.ratings } };
    emit();
  })
  .catch(() => {});

export function useLadder() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ladder,
  );
}

/** RP for finishing `place` (1-based) out of `of`: winner +30, last −20, linear between. */
export function rpDelta(place: number, of: number) {
  if (of < 2) return 0;
  return Math.round(30 - (50 * (place - 1)) / (of - 1));
}

export type RankedResult = { before: number; after: number; delta: number; place: number; of: number };

/** Apply a finished ranked match to every player at the table, save, and return your change. */
export function recordRankedGame(players: Player[]): RankedResult {
  // Ties share the better place.
  const placeOf = (p: Player) => 1 + players.filter((o) => o.score > p.score).length;
  const ratings = { ...ladder.ratings };
  for (const p of players) ratings[p.id] = Math.max(0, (ratings[p.id] ?? 1000) + rpDelta(placeOf(p), players.length));

  const me = players.find((p) => p.isYou)!;
  const place = placeOf(me);
  const before = ladder.ratings.you;
  const after = ratings.you;
  ladder = {
    ratings,
    played: ladder.played + 1,
    wins: ladder.wins + (place === 1 ? 1 : 0),
    best: Math.max(ladder.best, me.score),
    history: [{ at: Date.now(), place, of: players.length, score: me.score, delta: after - before }, ...ladder.history].slice(0, 20),
  };
  emit();
  AsyncStorage.setItem(LADDER_KEY, JSON.stringify(ladder)).catch(() => {});
  return { before, after, delta: after - before, place, of: players.length };
}

/** Everyone on the ladder, best first, with their 1-based position. */
export function standings(l: Ladder) {
  return ROSTER.map((seat) => ({ seat, rp: l.ratings[seat.id] ?? 1000 }))
    .sort((a, b) => b.rp - a.rp)
    .map((row, i) => ({ ...row, position: i + 1 }));
}
