import { useCallback, useEffect, useReducer } from 'react';
import { QUESTIONS } from '../data/questions';
import { correctCall, scoreRound } from './scoring';
import type { Call, GameState, Player, Question } from './types';

export const ROUNDS = 6;
export const GUESS_SECONDS = 20;
export const VOTE_SECONDS = 15;

export type Seat = Omit<Player, 'score'>;

/** You plus the four rivals that matchmaking and lobbies seat at the table. */
export const ROSTER: Seat[] = [
  { id: 'you', name: 'You', initials: 'YO', color: '#FFD23F', isYou: true },
  { id: 'priya', name: 'Priya', initials: 'PR', color: '#4C8DFF', isYou: false },
  { id: 'sam', name: 'Sam', initials: 'SA', color: '#FF8A3D', isYou: false },
  { id: 'jordan', name: 'Jordan', initials: 'JO', color: '#B58CFF', isYou: false },
  { id: 'mika', name: 'Mika', initials: 'MK', color: '#5ED3A8', isYou: false },
];

type Action =
  | { type: 'restart' }
  | { type: 'lockGuess'; guess: number }
  | { type: 'vote'; playerId: string; call: Call }
  | { type: 'reveal' }
  | { type: 'next' };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A bot guesser lands somewhere near the answer, sometimes way off. */
function botGuess(q: Question): number {
  const spread = Math.random() < 0.25 ? 35 : 15;
  let g = clamp(q.answer + rand(-spread, spread));
  if (g === q.answer) g = clamp(g + (Math.random() < 0.5 ? -3 : 3));
  return g;
}

/** A bot voter is right ~65% of the time. */
function botCall(guess: number, q: Question): Call {
  const right = correctCall(guess, q.answer) ?? 'higher';
  const wrong: Call = right === 'higher' ? 'lower' : 'higher';
  return Math.random() < 0.65 ? right : wrong;
}

/** Enter a round: a bot guesser locks in immediately, you get the dial. */
function beginRound(s: GameState): GameState {
  const guesser = s.players[s.guesserIndex];
  const q = s.questions[s.round];
  if (guesser.isYou) return { ...s, phase: 'guess', guess: null, votes: {}, results: [] };
  return { ...s, phase: 'vote', guess: botGuess(q), votes: {}, results: [] };
}

function newGame(roster: Seat[] = ROSTER): GameState {
  const players = roster.map((p) => ({ ...p, score: 0 }));
  return beginRound({
    phase: 'guess',
    players,
    questions: shuffle(QUESTIONS).slice(0, Math.min(ROUNDS, QUESTIONS.length)),
    round: 0,
    guesserIndex: 0,
    guess: null,
    votes: {},
    results: [],
  });
}

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'restart':
      return newGame(s.players);
    case 'lockGuess':
      if (s.phase !== 'guess') return s;
      return { ...s, phase: 'vote', guess: clamp(a.guess) };
    case 'vote': {
      if (s.phase !== 'vote' || s.votes[a.playerId]) return s;
      if (s.players[s.guesserIndex].id === a.playerId) return s;
      return { ...s, votes: { ...s.votes, [a.playerId]: a.call } };
    }
    case 'reveal': {
      if (s.phase !== 'vote' || s.guess === null) return s;
      const q = s.questions[s.round];
      const results = scoreRound(s.players, s.players[s.guesserIndex].id, s.guess, q.answer, s.votes);
      const players = s.players.map((p) => ({
        ...p,
        score: p.score + (results.find((r) => r.playerId === p.id)?.points ?? 0),
      }));
      return { ...s, phase: 'reveal', results, players };
    }
    case 'next': {
      if (s.phase !== 'reveal') return s;
      if (s.round + 1 >= s.questions.length) return { ...s, phase: 'gameOver' };
      return beginRound({
        ...s,
        round: s.round + 1,
        guesserIndex: (s.guesserIndex + 1) % s.players.length,
      });
    }
  }
}

export function useGame(roster: Seat[] = ROSTER) {
  const [state, dispatch] = useReducer(reducer, roster, newGame);
  const guesser = state.players[state.guesserIndex];
  const question = state.questions[state.round];
  const voters = state.players.filter((p) => p.id !== guesser.id);
  const allVoted = voters.every((p) => state.votes[p.id]);

  // Bots cast their calls at staggered, human-ish times.
  useEffect(() => {
    if (state.phase !== 'vote' || state.guess === null) return;
    const guess = state.guess;
    const timers = voters
      .filter((p) => !p.isYou)
      .map((p) =>
        setTimeout(
          () => dispatch({ type: 'vote', playerId: p.id, call: botCall(guess, question) }),
          rand(900, 5000),
        ),
      );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round]);

  // Reveal shortly after the last call comes in.
  useEffect(() => {
    if (state.phase !== 'vote' || !allVoted) return;
    const t = setTimeout(() => dispatch({ type: 'reveal' }), 900);
    return () => clearTimeout(t);
  }, [state.phase, allVoted]);

  return {
    state,
    guesser,
    question,
    voters,
    totalRounds: state.questions.length,
    lockGuess: useCallback((guess: number) => dispatch({ type: 'lockGuess', guess }), []),
    vote: useCallback((call: Call) => dispatch({ type: 'vote', playerId: 'you', call }), []),
    reveal: useCallback(() => dispatch({ type: 'reveal' }), []),
    next: useCallback(() => dispatch({ type: 'next' }), []),
    restart: useCallback(() => dispatch({ type: 'restart' }), []),
  };
}
