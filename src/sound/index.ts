// Entry point: the sound system's public API. Code outside src/sound imports from here only.
export { greetReturningPlayer, playQuestion, playVoice, setFillers } from './channels/host';
export { setMusic } from './channels/music';
export { playSfx } from './channels/sfx';
export { setEffectsVolume, setMusicVolume, setMuted, useSoundSettings, type SoundSettings } from './core/settings';
export { initSound } from './init';
export type { FillerPool, MusicTrack, Sfx, Voice } from './library/clips';
