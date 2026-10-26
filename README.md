# Higher or Lower — trivia

React Native (Expo SDK 58, TypeScript) version of the Higher or Lower design.

## Run

```bash
npm install
npx expo start      # scan the QR code with Expo Go, or press i / a
```

## How a round works

1. **Guess** — the guesser sets a % on the circle dial (colour shifts blue → green → yellow → red as it rises) and locks in. Timer auto-locks at 0.
2. **Vote** — everyone else calls **Higher** or **Lower** than that guess. Reveal fires once all calls are in or the timer runs out.
3. **Reveal** — answer, scale bar, and points: +100 for a correct call; guesser gets `100 − distance` (bullseye = 150).

The guesser rotates each round. Right now the other players are local bots (`src/game/useGame.ts`), and ranked matchmaking and private lobbies (create / join by code) are simulated on timers in their screens.

## Layout

```
App.tsx                     routes: landing → ranked matchmaking / lobby → game (guess → vote → reveal → gameOver)
src/theme.ts                "Midnight Academy" palette (taken from the Hat), fonts, heatColor()
src/motion.ts               reduce-motion, pulse/entrance/count-up hooks, seeded random
src/components/HatWizard    the Hat host, drawn in SVG with moods (idle, cast, think, happy, cheer, sad…)
src/components/MagicSky     animated night-sky background (stars, nebulae, motes, shooting stars)
src/components/Effects      sparkle bursts, confetti, Enter/Pop transitions, thinking dots
src/data/questions.ts       question bank — add your own here
src/game/                   types, reducer + bot simulation, scoring, countdown, rank.ts (RP ladder saved on device)
src/components/Rank         rank crest, top-left rank badge, progress bar; Scoreboard + Sheet for the leaderboard
src/components/CircleDial   PanResponder + react-native-svg dial with haptics
src/components/ui.tsx       shared bits (top bar, buttons, avatars, chips)
src/screens/                Landing, Matchmaking, Lobby, Guess, Vote, Reveal, GameOver
```

## Going multiplayer

`useGame` is a reducer driven by actions (`lockGuess`, `vote`, `reveal`, `next`). To go online, replace the bot effects with a WebSocket client that dispatches the same actions from server events, and have the server own the answer + scoring.
