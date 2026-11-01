import { setAudioModeAsync } from 'expo-audio';
import { startHost } from './channels/host';
import { startMusic } from './channels/music';
import { loadSettings } from './core/settings';

/** Starts the sound system. Call once from the app root; the returned function tears it down. */
export function initSound() {
  // Effects mix over whatever else is playing; nothing keeps playing once the app is backgrounded.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  loadSettings();
  const stops = [startMusic(), startHost()];
  return () => stops.forEach((stop) => stop());
}
