import { AudioPlayer } from 'expo-audio';
import { effectsVolume } from './settings';

/** Plays a clip from the top at the effects volume. */
export function playClip(p: AudioPlayer) {
  p.volume = effectsVolume();
  p.seekTo(0).catch(() => {});
  p.play();
}
