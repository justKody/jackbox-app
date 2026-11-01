export type Question = {
  id: string;
  text: string;
  /** The true answer, 0–100 (%). */
  answer: number;
};

export type Call = 'higher' | 'lower';

export type Player = {
  id: string;
  name: string;
  initials: string;
  color: string;
  isYou: boolean;
  score: number;
  /** Online players bring their own animal and skin; local rivals use their built-in looks. */
  animal?: string;
  skin?: string;
};

export type Phase = 'guess' | 'vote' | 'reveal' | 'gameOver';

export type RoundResult = {
  playerId: string;
  /** What this player did this round, for the results list. */
  label: string;
  points: number;
  correct: boolean;
};

export type GameState = {
  phase: Phase;
  players: Player[];
  questions: Question[];
  round: number; // 0-based
  guesserIndex: number;
  /** The guesser's locked guess, null until locked. */
  guess: number | null;
  /** Higher/lower calls keyed by player id (guesser never votes). */
  votes: Record<string, Call>;
  results: RoundResult[];
};
