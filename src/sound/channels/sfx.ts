import { playClip } from '../core/playClip';
import { canPlayEffects } from '../core/settings';
import type { Sfx } from '../library/clips';
import { sfxPlayers } from '../library/players';

export function playSfx(name: Sfx) {
  if (!canPlayEffects()) return;
  playClip(sfxPlayers[name]);
}
