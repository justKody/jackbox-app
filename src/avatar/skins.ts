import { colors } from '../theme';

/**
 * Player characters: every player is an animal, and any animal can wear any skin.
 * "Natural" is each animal's own colouring; the themed skins recolour fur, eyes and scarf,
 * and some add a printed (sometimes glowing) pattern. The Hat is the host, never a player.
 */

export type Species = 'fox' | 'cat' | 'bunny' | 'bear' | 'owl' | 'frog';

export type FurPalette = {
  fur: string;
  furLight: string;
  furDeep: string;
  /** Muzzle, belly and tail tip. */
  belly: string;
  /** Inner ears and cheek blush. */
  blush: string;
  nose: string;
  eye: string;
  eyeDeep: string;
  /** The scarf every character wears. */
  scarf: string;
  scarfDeep: string;
  /** Particles, pedestal runes and rim light. */
  aura: string;
};

export type Animal = { id: Species; name: string; blurb: string; palette: FurPalette };

/** Printed onto the fur in 3D. */
export type Pattern = 'none' | 'stars' | 'snow' | 'stripes' | 'leaves' | 'runes' | 'diamonds';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type Unlock =
  | { kind: 'free' }
  | { kind: 'tier'; tier: string }
  | { kind: 'wins'; count: number }
  | { kind: 'played'; count: number };

export type Skin = {
  id: string;
  name: string;
  blurb: string;
  rarity: Rarity;
  unlock: Unlock;
  /** Omitted for "Natural", which uses the animal's own colours. */
  palette?: FurPalette;
  pattern: Pattern;
  patternColor: string;
  /** 0–1: how brightly the pattern glows. */
  glow: number;
};

/** A fully resolved look: what the 3D model and swatches actually draw. */
export type Look = { species: Species; palette: FurPalette; pattern: Pattern; patternColor: string; glow: number; key: string };

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Common', color: '#A9B1C9' },
  rare: { label: 'Rare', color: colors.higher },
  epic: { label: 'Epic', color: '#A98BFF' },
  legendary: { label: 'Legendary', color: colors.gold },
};

export const ANIMALS: Animal[] = [
  {
    id: 'fox',
    name: 'Fox',
    blurb: 'Quick, clever, and absolutely sure the answer is 63%.',
    palette: { fur: '#E8743B', furLight: '#F7A066', furDeep: '#A8461C', belly: '#FFF2E2', blush: '#FF9C8A', nose: '#2A1A14', eye: '#F2B33D', eyeDeep: '#9A5A12', scarf: '#5CE1FF', scarfDeep: '#1A9FD6', aura: '#FFB25C' },
  },
  {
    id: 'cat',
    name: 'Cat',
    blurb: 'Pretends not to care about the score. Cares deeply about the score.',
    palette: { fur: '#8C87A3', furLight: '#B4AFC8', furDeep: '#58536E', belly: '#F1ECF8', blush: '#F2A7B8', nose: '#F07A9A', eye: '#9BE564', eyeDeep: '#3E8A2A', scarf: '#FF6B86', scarfDeep: '#B83A55', aura: '#9BE564' },
  },
  {
    id: 'bunny',
    name: 'Bunny',
    blurb: 'Always calls “higher”. Hops either way.',
    palette: { fur: '#F2ECE4', furLight: '#FFFFFF', furDeep: '#C9BCAC', belly: '#FFFFFF', blush: '#F7B3C2', nose: '#F07A9A', eye: '#C27BFF', eyeDeep: '#6E3AB8', scarf: '#F4C15D', scarfDeep: '#C48A2C', aura: '#F7B3C2' },
  },
  {
    id: 'bear',
    name: 'Bear',
    blurb: 'Slow to guess, impossible to rattle. Snacks during the vote.',
    palette: { fur: '#8A5A3B', furLight: '#B07A52', furDeep: '#5A3820', belly: '#E3C29A', blush: '#E89A7A', nose: '#2A1A14', eye: '#F2B866', eyeDeep: '#8A5A1F', scarf: '#9ACD5E', scarfDeep: '#5E8A33', aura: '#F4C15D' },
  },
  {
    id: 'owl',
    name: 'Owl',
    blurb: 'Has read every survey ever printed. Still gets it wrong sometimes.',
    palette: { fur: '#8E6E4E', furLight: '#BC9670', furDeep: '#5E4630', belly: '#F2E3C6', blush: '#E8A07A', nose: '#F4C15D', eye: '#FFC93D', eyeDeep: '#C47A12', scarf: '#A98BFF', scarfDeep: '#6A4FCF', aura: '#FFC93D' },
  },
  {
    id: 'frog',
    name: 'Frog',
    blurb: 'Leaps to conclusions. Lands on them surprisingly often.',
    palette: { fur: '#5DBB46', furLight: '#8EDB6C', furDeep: '#347A26', belly: '#E6F5C4', blush: '#FF9C9C', nose: '#2A3A1E', eye: '#FFD84D', eyeDeep: '#B08A12', scarf: '#FF9447', scarfDeep: '#C25A18', aura: '#8EDB6C' },
  },
];

export const SKINS: Skin[] = [
  {
    id: 'natural',
    name: 'Natural',
    blurb: 'Just as nature intended — fresh from the forest, scarf included.',
    rarity: 'common',
    unlock: { kind: 'free' },
    pattern: 'none',
    patternColor: '#FFFFFF',
    glow: 0,
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Warmed by the fireplace in the east tower. Smells faintly of toast.',
    rarity: 'common',
    unlock: { kind: 'free' },
    palette: { fur: '#B8323F', furLight: '#E0626A', furDeep: '#6E1A26', belly: '#FFD9B0', blush: '#FF8A5C', nose: '#3A1410', eye: '#FFB25C', eyeDeep: '#C2581A', scarf: '#F4C15D', scarfDeep: '#B0761E', aura: '#FF7A45' },
    pattern: 'diamonds',
    patternColor: '#D2505C',
    glow: 0,
  },
  {
    id: 'frost',
    name: 'Frostbound',
    blurb: 'Fur like fresh snow. Your guesses will be ice cold — in a good way.',
    rarity: 'rare',
    unlock: { kind: 'played', count: 3 },
    palette: { fur: '#CFE6F7', furLight: '#FFFFFF', furDeep: '#7FA6C8', belly: '#FFFFFF', blush: '#9FD4FF', nose: '#3E6E9E', eye: '#5CC6F0', eyeDeep: '#1A6FA6', scarf: '#3E6E9E', scarfDeep: '#1A2F4E', aura: '#9FE2FF' },
    pattern: 'snow',
    patternColor: '#FFFFFF',
    glow: 0.25,
  },
  {
    id: 'candy',
    name: 'Candy',
    blurb: 'Earned by winning your first match. Loud, proud and a little sticky.',
    rarity: 'rare',
    unlock: { kind: 'wins', count: 1 },
    palette: { fur: '#FF8DB5', furLight: '#FFC2D8', furDeep: '#C2457A', belly: '#FFF1F6', blush: '#FF5C8A', nose: '#7A1E46', eye: '#3FC9B4', eyeDeep: '#1D7A6C', scarf: '#3FC9B4', scarfDeep: '#1D7A6C', aura: '#FF8DB5' },
    pattern: 'stripes',
    patternColor: '#FFE3EE',
    glow: 0,
  },
  {
    id: 'grove',
    name: 'Grove Warden',
    blurb: 'Mossy, leafy, and fond of long naps in the sun.',
    rarity: 'rare',
    unlock: { kind: 'tier', tier: 'Conjurer' },
    palette: { fur: '#4F7A3A', furLight: '#7FAA5A', furDeep: '#2A4420', belly: '#E8DDB0', blush: '#D9A23A', nose: '#2A1A10', eye: '#D6FF7A', eyeDeep: '#6E9A22', scarf: '#8A5A35', scarfDeep: '#5C3920', aura: '#9ACD5E' },
    pattern: 'leaves',
    patternColor: '#87B85C',
    glow: 0,
  },
  {
    id: 'starweaver',
    name: 'Starweaver',
    blurb: 'Woven on the observatory loom. The stars on it are real — just very far away.',
    rarity: 'epic',
    unlock: { kind: 'tier', tier: 'Sorcerer' },
    palette: { fur: '#232870', furLight: '#4A52B8', furDeep: '#0E1036', belly: '#C9C2FF', blush: '#8C6CFF', nose: '#F4C15D', eye: '#B7A4FF', eyeDeep: '#7458F0', scarf: '#F4C15D', scarfDeep: '#B0761E', aura: '#A98BFF' },
    pattern: 'stars',
    patternColor: '#FFE39A',
    glow: 1,
  },
  {
    id: 'phantom',
    name: 'Void Phantom',
    blurb: 'Five wins and something answered back. It glows when it’s thinking.',
    rarity: 'epic',
    unlock: { kind: 'wins', count: 5 },
    palette: { fur: '#1E1828', furLight: '#3A2E4E', furDeep: '#0A070F', belly: '#3A2E4E', blush: '#B04DFF', nose: '#E04DFF', eye: '#FF5CE1', eyeDeep: '#B0209A', scarf: '#E04DFF', scarfDeep: '#7A1E8A', aura: '#E04DFF' },
    pattern: 'runes',
    patternColor: '#E04DFF',
    glow: 1,
  },
  {
    id: 'royal',
    name: 'Royal Gold',
    blurb: 'Reserved for the top of the ladder. Gilded fur and a very smug expression.',
    rarity: 'legendary',
    unlock: { kind: 'tier', tier: 'Archmage' },
    palette: { fur: '#F4C15D', furLight: '#FFE39A', furDeep: '#B07A1E', belly: '#FFF6DA', blush: '#FF9C6A', nose: '#5C3920', eye: '#7E45B8', eyeDeep: '#4A1E78', scarf: '#7E45B8', scarfDeep: '#4A1E78', aura: '#F4C15D' },
    pattern: 'stars',
    patternColor: '#FFF6DA',
    glow: 0.45,
  },
];

export const DEFAULT_ANIMAL = ANIMALS[0];
export const DEFAULT_SKIN = SKINS[0];

export const animalById = (id: string) => ANIMALS.find((a) => a.id === id) ?? DEFAULT_ANIMAL;
export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;

export function lookFor(species: Species, skinId: string): Look {
  const skin = skinById(skinId);
  return {
    species,
    palette: skin.palette ?? animalById(species).palette,
    pattern: skin.pattern,
    patternColor: skin.patternColor,
    glow: skin.glow,
    key: `${species}:${skin.id}`,
  };
}

/** The rivals' characters, so every seat at the table looks the same from game to game. */
export const RIVAL_LOOKS: Record<string, Look> = {
  priya: lookFor('cat', 'candy'),
  sam: lookFor('bear', 'natural'),
  jordan: lookFor('owl', 'starweaver'),
  mika: lookFor('frog', 'natural'),
};
