import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Call, Phase, Player, RoundResult } from '../game/types';

/**
 * The one websocket to the game server. Ranked matches open it, and it stays up from
 * matchmaking through the end of the game. Messages are `{ type, data }` both ways.
 */

const PORT = 4000;

/**
 * Where the Go server lives. Set EXPO_PUBLIC_SERVER_URL to point anywhere; otherwise in
 * development it's the machine running Expo (a phone can't reach that as "localhost").
 */
function serverUrl() {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  const host =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
  return `ws://${host || 'localhost'}:${PORT}/ws`;
}

// What the server sends. Player ids are the server's ("p1", "p2"…), `you` says which is yours.
export type ServerPlayer = Omit<Player, 'isYou'>;

export type LobbyUpdate = { lobbyId: string; you: string; players: ServerPlayer[]; maxPlayers: number; startsIn: number };

export type GameUpdate = {
  you: string;
  phase: Phase;
  players: ServerPlayer[];
  round: number;
  totalRounds: number;
  guesserId: string;
  /** `answer` only arrives with the reveal. */
  question: { id: string; text: string; answer?: number };
  guess: number | null;
  /** Where the guesser's dial sits while they're still guessing. */
  dial: number;
  /** Who has locked in a call; the calls themselves only arrive with the reveal. */
  locked: string[];
  votes?: Record<string, Call>;
  results?: RoundResult[];
};

export type RankResult = { playerId: string; before: number; after: number; delta: number; place: number; of: number };

export type ServerMessage =
  | { type: 'lobbyUpdate'; data: LobbyUpdate }
  | { type: 'matchCancelled'; data: { lobbyId: string } }
  | { type: 'game'; data: GameUpdate }
  | { type: 'dial'; data: { playerId: string; value: number } }
  | { type: 'rankResult'; data: RankResult }
  | { type: 'error'; data: { message: string } }
  | { type: 'closed' };

export type Profile = { clientId: string; name?: string; animal: string; skin: string; rp: number };

type Listener = (msg: ServerMessage) => void;

let socket: WebSocket | null = null;
const listeners = new Set<Listener>();
/** The newest game update, so the game screen can pick up the one that arrived during matchmaking. */
let lastGame: GameUpdate | null = null;

const emit = (msg: ServerMessage) => listeners.forEach((l) => l(msg));

export function connect(onOpen: () => void) {
  close();
  const ws = new WebSocket(serverUrl());
  socket = ws;
  ws.onopen = onOpen;
  ws.onmessage = (e) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (msg.type === 'game') lastGame = msg.data;
    emit(msg);
  };
  ws.onclose = () => {
    // Only report the socket we still care about, not one we closed ourselves.
    if (socket !== ws) return;
    socket = null;
    emit({ type: 'closed' });
  };
}

export function close() {
  const ws = socket;
  socket = null;
  lastGame = null;
  ws?.close();
}

export function send(type: string, data?: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, data }));
}

export function onMessage(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const latestGame = () => lastGame;

const CLIENT_ID_KEY = 'trivia:clientId';

/** A random id kept on device, so the server can keep your RP across matches. */
export async function clientId() {
  const saved = await AsyncStorage.getItem(CLIENT_ID_KEY).catch(() => null);
  if (saved) return saved;
  const id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
  AsyncStorage.setItem(CLIENT_ID_KEY, id).catch(() => {});
  return id;
}
