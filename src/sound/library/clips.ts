/**
 * Every clip the app can play. Each one ships inside the app bundle, so sound works offline.
 *
 * To add a sound, put the file in assets/sounds/<kind>/ and add one line here. Its key becomes
 * a valid name everywhere (playSfx('…'), playVoice('…'), setMusic('…')) with no other edits.
 */

export const sfx = {
  sparkle: require('../../../assets/sounds/sfx/sparkle.mp3'),
  lock: require('../../../assets/sounds/sfx/lock.mp3'),
  vote: require('../../../assets/sounds/sfx/vote.mp3'),
  join: require('../../../assets/sounds/sfx/join.mp3'),
  tick: require('../../../assets/sounds/sfx/tick.mp3'),
  drumroll: require('../../../assets/sounds/sfx/drumroll.mp3'),
  correct: require('../../../assets/sounds/sfx/correct.mp3'),
  wrong: require('../../../assets/sounds/sfx/wrong.mp3'),
  win: require('../../../assets/sounds/sfx/win.mp3'),
  lose: require('../../../assets/sounds/sfx/lose.mp3'),
};
export type Sfx = keyof typeof sfx;

// The Hat's spoken lines. Files keep their id from backend/s3asset/voicelines so each one traces back to its prompt.
export const voices = {
  welcomeBack: require('../../../assets/sounds/voice/welcome-back-to-the-show.mp3'),
};
export type Voice = keyof typeof voices;

// Gap-fillers the Hat drops into quiet stretches, tagged with the moments they suit.
export const fillers = [
  { file: require('../../../assets/sounds/fillers/filler_1.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/filler_2.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/filler_3.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/filler_4.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/filler_5.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/filler_6.mp3'), pools: ['general', 'guess'] },
  { file: require('../../../assets/sounds/fillers/guess_filler_1.mp3'), pools: ['guess'] },
  { file: require('../../../assets/sounds/fillers/guess_filler_2.mp3'), pools: ['guess'] },
  { file: require('../../../assets/sounds/fillers/guess_filler_3.mp3'), pools: ['guess'] },
] as const;
export type FillerPool = (typeof fillers)[number]['pools'][number];

// Menus and rounds each get their own loop; only one plays at a time.
export const music = {
  menu: require('../../../assets/sounds/music/menu.mp3'),
  game: require('../../../assets/sounds/music/game.mp3'),
};
export type MusicTrack = keyof typeof music;
