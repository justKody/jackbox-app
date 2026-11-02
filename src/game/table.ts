import type { GameState } from './types';

export type TagTone = 'gold' | 'ok' | 'dim' | 'bad';
export type SeatTag = { text: string; tone: TagTone; locked?: boolean };

export type TableState = {
  tags: Record<string, SeatTag>;
  spotlight: string | null;
  /** The scores the standings show; the round's points only land once the answer is revealed. */
  scores: Record<string, number>;
};

/**
 * The little status beside every player at the table right now, and the score it shows.
 * `revealed` is false during the reveal's drum-roll, so the round's points don't land early.
 */
export function tableState(s: GameState, revealed: boolean): TableState {
  const guesser = s.players[s.guesserIndex];
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
      continue;
    }

    if (isGuesser) {
      tags[p.id] = s.guess === null ? { text: 'Guessing', tone: 'gold' } : { text: `${s.guess}%`, tone: 'gold' };
    } else if (s.phase === 'guess') {
      tags[p.id] = { text: 'Waiting', tone: 'dim' };
    } else {
      tags[p.id] = call ? { text: 'Locked', tone: 'ok', locked: true } : { text: s.phase === 'reveal' ? 'No call' : 'Deciding', tone: 'dim' };
    }
  }

  return { tags, scores, spotlight: s.phase === 'gameOver' ? null : guesser.id };
}
