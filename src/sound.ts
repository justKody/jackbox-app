import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const MUTE_KEY = 'trivia:muted';

// Effects mix over whatever else is playing; nothing keeps playing once the app is backgrounded.
setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});

// Players are created once and reused so effects fire without a load delay.
const effects = {
  sparkle: createAudioPlayer(require('../assets/sounds/sparkle.wav')),
  lock: createAudioPlayer(require('../assets/sounds/lock.wav')),
  vote: createAudioPlayer(require('../assets/sounds/vote.wav')),
  correct: createAudioPlayer(require('../assets/sounds/correct.wav')),
  wrong: createAudioPlayer(require('../assets/sounds/wrong.wav')),
  win: createAudioPlayer(require('../assets/sounds/win.wav')),
};
export type Sfx = keyof typeof effects;

const music = createAudioPlayer(require('../assets/sounds/music.wav'));
music.loop = true;
music.volume = 0.35;

let muted = false;
let musicWanted = false;
const listeners = new Set<() => void>();

const loaded = AsyncStorage.getItem(MUTE_KEY)
  .then((v) => {
    muted = v === '1';
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function playSfx(name: Sfx) {
  if (muted) return;
  const p = effects[name];
  p.seekTo(0).catch(() => {});
  p.play();
}

export function startMusic() {
  musicWanted = true;
  // Wait for the saved mute setting so a muted player never hears a blip of music.
  loaded.then(() => {
    if (musicWanted && !muted) music.play();
  });
}

export function stopMusic() {
  musicWanted = false;
  music.pause();
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) music.pause();
  else if (musicWanted) music.play();
  listeners.forEach((l) => l());
  AsyncStorage.setItem(MUTE_KEY, m ? '1' : '0').catch(() => {});
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

// Browsers block audio until the first tap or key press, so retry the music then.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const unlock = () => {
    if (musicWanted && !muted && !music.playing) music.play();
    document.removeEventListener('pointerup', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerup', unlock);
  document.addEventListener('keydown', unlock);
}
