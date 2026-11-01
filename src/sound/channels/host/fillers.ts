import { AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
import { canPlayEffects } from '../../core/settings';
import { isAudioUnlocked } from '../../core/unlock';
import type { FillerPool } from '../../library/clips';
import { fillerPlayers } from '../../library/players';
import { currentLine, onLineChange, speak, stopSpeaking } from './speaker';

/** Gap-fillers the Hat drops into quiet stretches. */

// Once the Hat stops talking, the next filler waits a random 15–40 seconds.
const FILLER_GAP_MS = [15_000, 40_000] as const;

const allFillers = fillerPlayers.map((f) => f.player);
const fillersFor = (pool: FillerPool) => fillerPlayers.filter((f) => f.pools.includes(pool)).map((f) => f.player);

let fillerPool: FillerPool | null = null;
let lastFiller: AudioPlayer | null = null;
let fillerTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFiller() {
  clearTimeout(fillerTimer);
  if (!fillerPool) return;
  const [min, max] = FILLER_GAP_MS;
  fillerTimer = setTimeout(playFiller, min + Math.random() * (max - min));
}

function playFiller() {
  // A filler never talks over another line, or plays where nobody can hear it; it waits another break.
  if (!fillerPool || currentLine()?.playing || !isAudioUnlocked() || !canPlayEffects()) {
    scheduleFiller();
    return;
  }
  const choices = fillersFor(fillerPool).filter((p) => p !== lastFiller);
  lastFiller = choices[Math.floor(Math.random() * choices.length)];
  speak(lastFiller);
}

/** Picks which gap-fillers the Hat may use from now on; null keeps it quiet. */
export function setFillers(pool: FillerPool | null) {
  if (pool === fillerPool) return;
  // A filler meant for the moment just left stops rather than spill into the next one.
  const line = currentLine();
  if (line && allFillers.includes(line) && !(pool && fillersFor(pool).includes(line))) stopSpeaking();
  const wasQuiet = !fillerPool;
  fillerPool = pool;
  // Moving between moments keeps the running break, so a phase change never resets the clock.
  if (!pool) clearTimeout(fillerTimer);
  else if (wasQuiet) scheduleFiller();
}

export function startFillers() {
  // A new break starts when a line ends; the one from its start only covers a finish event that never arrives.
  const lines = onLineChange(scheduleFiller);
  // The break starts over on returning to the app.
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleFiller();
    else clearTimeout(fillerTimer);
  });
  return () => {
    lines();
    appState.remove();
    clearTimeout(fillerTimer);
  };
}
