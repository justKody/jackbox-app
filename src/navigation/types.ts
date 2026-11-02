import type { Seat } from '../game/useGame';

// Define the params for each route
export type RootStackParamList = {
  Landing: undefined;
  Matchmaking: undefined;
  Avatar: undefined;
  Lobby: { code: string };
  LocalGame: { roster: Seat[] };
  OnlineGame: undefined;
};

export type RouteName = keyof RootStackParamList;

/** Routes without params are navigated to by name alone; the rest need their params. */
type ParamsArg<N extends RouteName> = RootStackParamList[N] extends undefined ? [] : [params: RootStackParamList[N]];

export type Navigation = {
  /** Swaps the current screen for `name`; every navigation mounts a fresh screen and plays its entrance. */
  navigate: <N extends RouteName>(name: N, ...params: ParamsArg<N>) => void;
};

export type ScreenProps<N extends RouteName> = {
  params: RootStackParamList[N];
  navigation: Navigation;
};

export type RouteOptions = {
  /** Music bed while the route is up. The Hat's fillers only run under the game bed. */
  music: 'menu' | 'game';
  /** Android back returns to the landing screen. Routes without it handle back themselves, or leave the app. */
  backToLanding?: boolean;
};
