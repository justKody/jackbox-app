import { useCallback, useEffect, useRef, useState } from 'react';
import { GameUpdate, latestGame, onMessage, send } from '../net/server';
import { RankedResult, recordRankedGame } from './rank';
import type { Call, GameState, Player } from './types';
import { GameControls, ROSTER } from './useGame';

/** How often a guesser's dial goes out while they drag it. */
const DIAL_SEND_MS = 80;

/**
 * A ranked match played on the game server. Same shape as useGame, so the screens don't care,
 * but every rule, timer and score lives on the server: this only sends your moves and shows
 * what comes back. Your seat is renamed "you" so the screens and your wardrobe find it.
 */
export function useOnlineGame(onDisconnect: () => void): GameControls & { rank?: RankedResult } {
  const [update, setUpdate] = useState<GameUpdate | null>(latestGame);
  const [myCall, setMyCall] = useState<{ round: number; call: Call }>();
  const [rank, setRank] = useState<RankedResult>();
  // The guesser's dial as it streams in, kept per round so a new round starts from its own value.
  const [dial, setDial] = useState<{ round: number; value: number }>();
  const dialOut = useRef<{ value: number; last: number; timer?: ReturnType<typeof setTimeout> }>({ value: 0, last: 0 });

  useEffect(() => {
    const off = onMessage((msg) => {
      switch (msg.type) {
        case 'game':
          setUpdate(msg.data);
          break;
        case 'dial': {
          const round = latestGame()?.round ?? 0;
          setDial({ round, value: msg.data.value });
          break;
        }
        case 'rankResult': {
          const me = latestGame()?.players.find((p) => p.id === msg.data.playerId);
          setRank(recordRankedGame(msg.data, me?.score ?? 0));
          break;
        }
        case 'error':
          console.warn('server rejected a move:', msg.data.message);
          break;
        case 'closed':
          // Once the game is over nothing more is coming, so a dropped socket doesn't matter.
          if (latestGame()?.phase !== 'gameOver') onDisconnect();
          break;
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Throttled, but the last position always goes out, so the others' dial ends where yours stopped.
  const moveDial = useCallback((value: number) => {
    const out = dialOut.current;
    out.value = value;
    if (out.timer) return;
    out.timer = setTimeout(() => {
      out.timer = undefined;
      out.last = Date.now();
      send('dial', { value: out.value });
    }, Math.max(0, out.last + DIAL_SEND_MS - Date.now()));
  }, []);
  useEffect(() => () => clearTimeout(dialOut.current.timer), []);

  const state = toState(update!, myCall && myCall.round === update!.round ? myCall.call : undefined);
  const guesser = state.players[state.guesserIndex];
  const question = { id: update!.question.id, text: update!.question.text, answer: update!.question.answer ?? 0 };

  return {
    state,
    guesser,
    question,
    voters: state.players.filter((p) => p.id !== guesser.id),
    totalRounds: update!.totalRounds,
    lockGuess: useCallback((guess: number) => send('lockGuess', { guess }), []),
    vote: useCallback(
      (call: Call) => {
        setMyCall({ round: update!.round, call });
        send('vote', { call });
      },
      [update],
    ),
    // The server reveals when every call is in or time runs out.
    reveal: useCallback(() => {}, []),
    next: useCallback(() => send('next'), []),
    // Playing again means a new match, which the app starts from matchmaking.
    restart: useCallback(() => {}, []),
    // A dial message is newer than the last game update, unless it's from an earlier round.
    dial: dial && dial.round === update!.round ? dial.value : update!.dial,
    moveDial,
    rank,
  };
}

/** The server names you "Player N"; on your own screen you're always "You". */
const YOU = { name: ROSTER[0].name, initials: ROSTER[0].initials };

function toState(u: GameUpdate, myCall: Call | undefined): GameState {
  const id = (serverId: string) => (serverId === u.you ? 'you' : serverId);
  const players: Player[] = u.players.map((p) => (p.id === u.you ? { ...p, ...YOU, id: 'you', isYou: true } : { ...p, isYou: false }));

  // Calls stay secret until the reveal, but the table only needs to know who has locked in.
  // Others get a stand-in call; yours is the one you made.
  let votes: Record<string, Call> = {};
  if (u.votes) {
    for (const [pid, call] of Object.entries(u.votes)) votes[id(pid)] = call;
  } else {
    votes = Object.fromEntries(u.locked.map((pid) => [id(pid), pid === u.you && myCall ? myCall : 'higher']));
  }

  return {
    phase: u.phase,
    players,
    // The server keeps the question list; the current question comes with every update.
    questions: [],
    round: u.round,
    guesserIndex: Math.max(0, u.players.findIndex((p) => p.id === u.guesserId)),
    guess: u.guess,
    votes,
    results: (u.results ?? []).map((r) => ({ ...r, playerId: id(r.playerId) })),
  };
}
