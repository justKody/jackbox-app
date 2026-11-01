# Sound

Everything the app plays: effects, the Wizard Hat's voice lines and fillers, and background music.

## Layout

```
src/sound/
├── index.ts            ★ ENTRY POINT: the public API. Code outside src/sound imports only this.
├── init.ts             initSound(): called once by App.tsx; starts every watcher below.
│
├── library/            WHAT can play: plain data, imports nothing else in src/sound
│   ├── clips.ts        every sound file, and the name types (Sfx, Voice, FillerPool, MusicTrack)
│   └── players.ts      one reusable player per clip; the only file that calls createAudioPlayer
│
├── core/               SHARED RULES every channel follows; never imports library/ or channels/
│   ├── settings.ts     mute and volumes, saved on device; canPlayEffects() is the one "may this play?" check
│   ├── unlock.ts       browsers block audio until the first tap; whenUnlocked(fn) waits for it
│   └── playClip.ts     plays any clip from the top at the effects volume
│
└── channels/           WHAT YOU HEAR: one per kind of sound, built from library/ and core/
    ├── sfx.ts          playSfx
    ├── music.ts        the background loop; follows the music volume
    └── host/           the Wizard Hat
        ├── index.ts    ★ entry point for the Hat; nothing outside host/ imports the files below
        ├── speaker.ts  one line at a time: a new line cuts off the last; playVoice
        ├── fillers.ts  gap-fillers in quiet stretches; setFillers
        └── greeting.ts the welcome-back line on launch
```

Imports flow one way: `library/` and `core/` → `channels/` → `init.ts` → `index.ts`. Lint rules in `eslint.config.js` enforce every arrow, so a wrong import fails `npx expo lint`.

**Folder rule:** a channel starts as one file. When it grows past one, it becomes a folder with an `index.ts`, and that `index.ts` is the only file others may import (as `host/` does).

## Using it

```ts
import { playSfx, playVoice, setMusic, setFillers } from '../sound';

playSfx('correct');
playVoice('welcomeBack');
setMusic('game');
setFillers('guess'); // null keeps the Hat quiet
```

Nothing in this folder runs on import except creating the players. Each channel's `start…()` sets up its listeners and returns its own cleanup; `initSound()` runs them all and returns one cleanup for everything.

## Adding a sound

1. Put the file in the right folder under `assets/sounds/`:
   - `sfx/` for short effects
   - `voice/` for one-off Hat lines
   - `fillers/` for Hat gap-fillers
   - `music/` for background loops
2. Add one line to `library/clips.ts`. The key becomes a valid name for `playSfx` / `playVoice` / `setMusic` with no other edits.

Fillers are entries with `pools`: the moments they may play in. A new pool name in `pools` becomes a valid `setFillers` argument.

### Naming

- Effects and music: kebab-case files (`drumroll.mp3`), camelCase keys (`drumroll`).
- Voice lines and fillers: keep the id from `backend/s3asset/voicelines` (`guess_hurry_1.mp3`) so every clip traces back to its prompt in `voicelines.md`.

## Adding a channel

Add `channels/<name>.ts` that imports from `library/` and `core/`. If it has listeners, give it a `start<Name>()` that returns a cleanup and add it to `initSound()`. Export its public functions from `index.ts`.

The sound panel's open/closed state is UI, so it lives in `src/components/soundPanel.ts`, not here.
