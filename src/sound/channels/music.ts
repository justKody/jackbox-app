import { loadSettings, soundSettings } from '../core/settings';
import { whenUnlocked } from '../core/unlock';
import type { MusicTrack } from '../library/clips';
import { musicPlayers } from '../library/players';

// A full music slider plays the loop at this volume, so it always sits under the effects.
const MUSIC_MAX = 0.5;

let track: MusicTrack | null = null;

function applyMusic() {
  const { muted, music } = soundSettings.get();
  for (const [name, player] of Object.entries(musicPlayers)) {
    player.volume = (music / 100) * MUSIC_MAX;
    if (name === track && !muted && music > 0) {
      if (!player.playing) player.play();
    } else player.pause();
  }
}

/** Switches the background loop; each track picks up where it last paused. */
export function setMusic(next: MusicTrack | null) {
  track = next;
  // Wait for the saved settings so a muted player never hears a blip of music.
  loadSettings().then(() => {
    if (track === next) applyMusic();
  });
}

/** Keeps the loop in step with the volume settings, and retries it once a browser allows audio. */
export function startMusic() {
  const stops = [soundSettings.subscribe(applyMusic), whenUnlocked(applyMusic)];
  return () => stops.forEach((stop) => stop());
}
