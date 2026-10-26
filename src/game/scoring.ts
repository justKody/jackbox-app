import type { Call, Player, RoundResult } from './types';

export const CORRECT_CALL_POINTS = 100;
export const EXACT_GUESS_POINTS = 150;

/** Which call was right. null when the guess is exactly the answer (nobody wins the call). */
export function correctCall(guess: number, answer: number): Call | null {
  if (answer > guess) return 'higher';
  if (answer < guess) return 'lower';
  return null;
}

/** Guesser earns 100 minus how far off they were; a bullseye earns a bonus. */
export function closenessPoints(guess: number, answer: number): number {
  const off = Math.abs(guess - answer);
  return off === 0 ? EXACT_GUESS_POINTS : Math.max(0, 100 - off);
}

export function scoreRound(
  players: Player[],
  guesserId: string,
  guess: number,
  answer: number,
  votes: Record<string, Call>,
): RoundResult[] {
  const right = correctCall(guess, answer);
  return players.map((p) => {
    if (p.id === guesserId) {
      const points = closenessPoints(guess, answer);
      return { playerId: p.id, label: `Guessed ${guess}% · closeness`, points, correct: points > 0 };
    }
    const call = votes[p.id];
    if (!call) return { playerId: p.id, label: 'No call', points: 0, correct: false };
    const correct = right !== null && call === right;
    return {
      playerId: p.id,
      label: `Called ${call}`,
      points: correct ? CORRECT_CALL_POINTS : 0,
      correct,
    };
  });
}
