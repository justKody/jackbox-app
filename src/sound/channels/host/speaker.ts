import { AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
import { playClip } from '../../core/playClip';
import { canPlayEffects, effectsVolume, soundSettings } from '../../core/settings';
import type { Voice } from '../../library/clips';
import { fillerPlayers, voicePlayers } from '../../library/players';

/** The Hat says one line at a time: a new line cuts off whatever it was saying. */

// The line the Hat is saying right now; there is only ever one.
let speaking: AudioPlayer | null = null;
const lineListeners = new Set<() => void>();
const lineChanged = () => lineListeners.forEach((l) => l());

export const currentLine = () => speaking;

/** Runs fn whenever a line starts or finishes. */
export function onLineChange(fn: () => void) {
  lineListeners.add(fn);
  return () => {
    lineListeners.delete(fn);
  };
}

export function speak(p: AudioPlayer) {
  stopSpeaking();
  speaking = p;
  playClip(p);
  lineChanged();
}

export function stopSpeaking() {
  speaking?.pause();
  speaking = null;
}

export function playVoice(name: Voice) {
  if (!canPlayEffects()) return;
  speak(voicePlayers[name]);
}

export function startSpeaker() {
  const lines = [...Object.values<AudioPlayer>(voicePlayers), ...fillerPlayers.map((f) => f.player)];
  const finished = lines.map((p) =>
    p.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish || speaking !== p) return;
      speaking = null;
      lineChanged();
    }),
  );
  const volume = soundSettings.subscribe(() => {
    if (!canPlayEffects()) stopSpeaking();
    else if (speaking) speaking.volume = effectsVolume();
  });
  // Leaving the app cuts the Hat off mid-line.
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') stopSpeaking();
  });
  return () => {
    finished.forEach((sub) => sub.remove());
    volume();
    appState.remove();
  };
}
