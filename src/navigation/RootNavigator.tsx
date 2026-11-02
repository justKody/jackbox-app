import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';
import { Enter } from '../components/Effects';
import { setFillers, setMusic } from '../sound';
import type { Navigation, RootStackParamList, RouteName, RouteOptions, ScreenProps } from './types';

// Import screens
import { AvatarScreen } from '../screens/AvatarScreen';
import { LocalGame, OnlineGame } from '../screens/GameScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { LobbyScreen, makeRoomCode } from '../screens/LobbyScreen';
import { MatchmakingScreen } from '../screens/MatchmakingScreen';

export type { Navigation, RootStackParamList, ScreenProps } from './types';

// Route option presets
const menuScreen: RouteOptions = { music: 'menu', backToLanding: true };
const gameScreen: RouteOptions = { music: 'game' };

// Define routes
type RouteConfig = {
  [N in RouteName]: { name: N; component: ComponentType<ScreenProps<N>>; options: RouteOptions };
}[RouteName];

const routes: RouteConfig[] = [
  {
    name: 'Landing',
    component: ({ navigation }) => (
      <LandingScreen
        onChoose={(choice) =>
          choice === 'lobby'
            ? navigation.navigate('Lobby', { code: makeRoomCode() })
            : navigation.navigate(choice === 'ranked' ? 'Matchmaking' : 'Avatar')
        }
      />
    ),
    options: { music: 'menu' },
  },
  {
    name: 'Matchmaking',
    component: ({ navigation }) => (
      <MatchmakingScreen onMatched={() => navigation.navigate('OnlineGame')} onCancel={() => navigation.navigate('Landing')} />
    ),
    options: menuScreen,
  },
  {
    name: 'Lobby',
    component: ({ params, navigation }) => (
      <LobbyScreen code={params.code} onStart={(roster) => navigation.navigate('LocalGame', { roster })} onBack={() => navigation.navigate('Landing')} />
    ),
    options: menuScreen,
  },
  {
    name: 'Avatar',
    component: ({ navigation }) => <AvatarScreen onBack={() => navigation.navigate('Landing')} />,
    options: menuScreen,
  },
  {
    name: 'LocalGame',
    component: ({ params, navigation }) => <LocalGame roster={params.roster} onExit={() => navigation.navigate('Landing')} />,
    options: gameScreen,
  },
  {
    name: 'OnlineGame',
    component: ({ navigation }) => (
      <OnlineGame onPlayAgain={() => navigation.navigate('Matchmaking')} onExit={() => navigation.navigate('Landing')} />
    ),
    options: gameScreen,
  },
];

type ActiveRoute = { key: number; name: RouteName; params: RootStackParamList[RouteName] };

export default function RootNavigator({ initialRouteName = 'Landing' }: { initialRouteName?: RouteName }) {
  const [route, setRoute] = useState<ActiveRoute>({ key: 0, name: initialRouteName, params: undefined });
  const navigation = useMemo<Navigation>(
    () => ({
      navigate: (name, ...[params]) => setRoute((r) => ({ key: r.key + 1, name, params })),
    }),
    [],
  );

  const config = routes.find((r) => r.name === route.name)!;
  const { music, backToLanding } = config.options;

  useEffect(() => setMusic(music), [music]);
  // The Hat only fills gaps during play: a running game picks its fillers per phase, menus and matchmaking stay quiet.
  useEffect(() => {
    if (music === 'menu') setFillers(null);
  }, [music]);

  useEffect(() => {
    if (!backToLanding) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Landing');
      return true;
    });
    return () => sub.remove();
  }, [backToLanding, navigation]);

  // Each route's component only ever receives its own params, so the union can be widened here.
  const Screen = config.component as ComponentType<ScreenProps<RouteName>>;
  return (
    <Enter key={route.key} from={20} style={{ flex: 1 }}>
      <Screen params={route.params} navigation={navigation} />
    </Enter>
  );
}
