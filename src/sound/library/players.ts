import { AudioPlayer, AudioSource, createAudioPlayer } from 'expo-audio';
import * as clips from './clips';

// Players are created once and reused so clips fire without a load delay.
// This is the only file that creates players; everything else plays these.

function load<K extends string>(files: Record<K, AudioSource>) {
  return Object.fromEntries(Object.entries(files).map(([name, file]) => [name, createAudioPlayer(file as AudioSource)])) as Record<K, AudioPlayer>;
}

export const sfxPlayers = load(clips.sfx);
export const voicePlayers = load(clips.voices);
export const fillerPlayers = clips.fillers.map((f) => ({ player: createAudioPlayer(f.file), pools: f.pools as readonly clips.FillerPool[] }));
export const musicPlayers = load(clips.music);
Object.values<AudioPlayer>(musicPlayers).forEach((p) => (p.loop = true));
