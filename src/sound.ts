import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const SETTINGS_KEY = 'trivia:sound';
const LEGACY_MUTE_KEY = 'trivia:muted';
const VISITED_KEY = 'trivia:visited';
// A full music slider plays the loop at this volume, so it always sits under the effects.
const MUSIC_MAX = 0.5;

// Effects mix over whatever else is playing; nothing keeps playing once the app is backgrounded.
setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});

// Every clip ships inside the app bundle, so sound works offline.
// Players are created once and reused so effects fire without a load delay.
const effects = {
  sparkle: createAudioPlayer(require('../assets/sounds/sparkle.mp3')),
  lock: createAudioPlayer(require('../assets/sounds/lock.mp3')),
  vote: createAudioPlayer(require('../assets/sounds/vote.mp3')),
  join: createAudioPlayer(require('../assets/sounds/join.mp3')),
  tick: createAudioPlayer(require('../assets/sounds/tick.mp3')),
  drumroll: createAudioPlayer(require('../assets/sounds/drumroll.mp3')),
  correct: createAudioPlayer(require('../assets/sounds/correct.mp3')),
  wrong: createAudioPlayer(require('../assets/sounds/wrong.mp3')),
  win: createAudioPlayer(require('../assets/sounds/win.mp3')),
  lose: createAudioPlayer(require('../assets/sounds/lose.mp3')),
};
export type Sfx = keyof typeof effects;

// The Hat's spoken lines follow the effects volume.
const voices = {
  welcomeBack: createAudioPlayer(require('../assets/sounds/welcome-back-to-the-show.mp3')),
};
export type Voice = keyof typeof voices;

// Menus and rounds each get their own loop; only one plays at a time.
const tracks = {
  menu: createAudioPlayer(require('../assets/sounds/music-menu.mp3')),
  game: createAudioPlayer(require('../assets/sounds/music-game.mp3')),
};
export type MusicTrack = keyof typeof tracks;
Object.values(tracks).forEach((t) => (t.loop = true));

/** Volumes are whole percents, 0–100. */
export type SoundSettings = { muted: boolean; music: number; effects: number };

let settings: SoundSettings = { muted: false, music: 70, effects: 100 };
let track: MusicTrack | null = null;
let greetPending = false;
let panelOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function applyMusic() {
  for (const [name, player] of Object.entries(tracks)) {
    player.volume = (settings.music / 100) * MUSIC_MAX;
    if (name === track && !settings.muted && settings.music > 0) {
      if (!player.playing) player.play();
    } else player.pause();
  }
}

const loaded = AsyncStorage.multiGet([SETTINGS_KEY, LEGACY_MUTE_KEY])
  .then(([[, saved], [, legacyMuted]]) => {
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
    else if (legacyMuted === '1') settings = { ...settings, muted: true };
    emit();
  })
  .catch(() => {});

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function update(patch: Partial<SoundSettings>) {
  settings = { ...settings, ...patch };
  applyMusic();
  emit();
  // Sliders fire on every drag tick; only write once they settle.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {}), 300);
}

function play(p: AudioPlayer) {
  p.volume = settings.effects / 100;
  p.seekTo(0).catch(() => {});
  p.play();
}

export function playSfx(name: Sfx) {
  if (settings.muted || settings.effects === 0) return;
  play(effects[name]);
}

export function playVoice(name: Voice) {
  if (settings.muted || settings.effects === 0) return;
  play(voices[name]);
}

/** Switches the background loop; each track picks up where it last paused. */
export function setMusic(next: MusicTrack | null) {
  track = next;
  // Wait for the saved settings so a muted player never hears a blip of music.
  loaded.then(() => {
    if (track === next) applyMusic();
  });
}

/** The Hat welcomes players back on every launch after their first. */
export function greetReturningPlayer() {
  loaded
    .then(() => AsyncStorage.getItem(VISITED_KEY))
    .then((visited) => {
      AsyncStorage.setItem(VISITED_KEY, '1').catch(() => {});
      if (!visited) return;
      // Browsers hold audio until the first tap, so the greeting waits for it there.
      if (Platform.OS === 'web') greetPending = true;
      else playVoice('welcomeBack');
    })
    .catch(() => {});
}

export const setMuted = (muted: boolean) => update({ muted });
// Moving a slider means you want to hear it, so it also lifts the mute.
export const setMusicVolume = (v: number) => update({ music: v, muted: false });
export const setEffectsVolume = (v: number) => update({ effects: v, muted: false });

export function useSoundSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

// The sound panel is mounted once at the app root; any screen's speaker button opens it.
export function setSoundPanelOpen(open: boolean) {
  panelOpen = open;
  emit();
}

export function useSoundPanelOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => panelOpen,
  );
}

// Browsers block audio until the first tap or key press, so retry the music then.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const unlock = () => {
    applyMusic();
    if (greetPending) {
      greetPending = false;
      playVoice('welcomeBack');
    }
    document.removeEventListener('pointerup', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerup', unlock);
  document.addEventListener('keydown', unlock);
}
