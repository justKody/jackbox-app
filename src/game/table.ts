import type { Mood } from '../avatar/animalModel';
import type { GameState } from './types';

export type TagTone = 'gold' | 'ok' | 'dim' | 'bad';
export type SeatTag = { text: string; tone: TagTone; locked?: boolean };

export type TableState = {
  moods: Record<string, Mood>;
  tags: Record<string, SeatTag>;
  spotlight: string | null;
  /** The scores the standings show; the round's points only land once the answer is revealed. */
  scores: Record<string, number>;
};

/**
 * How every animal at the table should act right now, the little status beside it, and the score
 * it's ranked by. `revealed` is false during the reveal's drum-roll, so nobody reacts (or overtakes
 * anyone) before the answer shows.
 */
export function tableState(s: GameState, revealed: boolean): TableState {
  const guesser = s.players[s.guesserIndex];
  const moods: Record<string, Mood> = {};
  const tags: Record<string, SeatTag> = {};
  const scores: Record<string, number> = {};

  for (const p of s.players) {
    const isGuesser = p.id === guesser.id;
    const call = s.votes[p.id];
    const result = s.results.find((r) => r.playerId === p.id);
    scores[p.id] = s.phase === 'reveal' && !revealed ? p.score - (result?.points ?? 0) : p.score;

    if (s.phase === 'reveal' && revealed && result) {
      const pts = result.points;
      tags[p.id] = { text: `+${pts}`, tone: pts > 0 ? 'ok' : 'bad' };
      if (isGuesser) moods[p.id] = pts >= 100 ? 'cheer' : pts >= 60 ? 'happy' : pts > 0 ? 'idle' : 'sad';
      else moods[p.id] = !call ? 'idle' : result.correct ? 'cheer' : 'sad';
      continue;
    }

    if (isGuesser) {
      moods[p.id] = 'think';
      tags[p.id] = s.guess === null ? { text: 'Guessing', tone: 'gold' } : { text: `${s.guess}%`, tone: 'gold' };
    } else if (s.phase === 'guess') {
      moods[p.id] = 'idle';
      tags[p.id] = { text: 'Waiting', tone: 'dim' };
    } else {
      moods[p.id] = call ? 'ready' : 'idle';
      tags[p.id] = call ? { text: 'Locked', tone: 'ok', locked: true } : { text: s.phase === 'reveal' ? 'No call' : 'Deciding', tone: 'dim' };
    }
  }

  return { moods, tags, scores, spotlight: s.phase === 'gameOver' ? null : guesser.id };
}
