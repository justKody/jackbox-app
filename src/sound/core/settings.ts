import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore, useStore } from '../../createStore';

const SETTINGS_KEY = 'trivia:sound';
const LEGACY_MUTE_KEY = 'trivia:muted';

/** Volumes are whole percents, 0–100. */
export type SoundSettings = { muted: boolean; music: number; effects: number };

export const soundSettings = createStore<SoundSettings>({ muted: true, music: 70, effects: 100 });

let loaded: Promise<void> | undefined;
/** Reads the saved settings once; every caller waits on that same read. */
export function loadSettings() {
  loaded ??= AsyncStorage.multiGet([SETTINGS_KEY, LEGACY_MUTE_KEY])
    .then(([[, saved], [, legacyMuted]]) => {
      if (saved) soundSettings.set({ ...soundSettings.get(), ...JSON.parse(saved) });
      else if (legacyMuted === '1') soundSettings.set({ ...soundSettings.get(), muted: true });
    })
    .catch(() => {});
  return loaded;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function update(patch: Partial<SoundSettings>) {
  soundSettings.set({ ...soundSettings.get(), ...patch });
  // Sliders fire on every drag tick; only write once they settle.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(soundSettings.get())).catch(() => {}), 300);
}

/** Effects and the Hat's lines play only while sound is on and the effects slider is up. */
export function canPlayEffects() {
  const { muted, effects } = soundSettings.get();
  return !muted && effects > 0;
}

export const effectsVolume = () => soundSettings.get().effects / 100;

export const setMuted = (muted: boolean) => update({ muted });
// Moving a slider means you want to hear it, so it also lifts the mute.
export const setMusicVolume = (v: number) => update({ music: v, muted: false });
export const setEffectsVolume = (v: number) => update({ effects: v, muted: false });

export const useSoundSettings = () => useStore(soundSettings);
