import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold_Italic, Fraunces_700Bold, Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Enter } from './src/components/Effects';
import { HatWizard } from './src/components/HatWizard';
import { MagicSky } from './src/components/MagicSky';
import { SoundSheet } from './src/components/SoundSheet';
import { PlayerTable } from './src/avatar/PlayerTable';
import type { RankedResult } from './src/game/rank';
import { tableState } from './src/game/table';
import { GameControls, Seat, useGame } from './src/game/useGame';
import { useOnlineGame } from './src/game/useOnlineGame';
import { close as closeServer } from './src/net/server';
import { AvatarScreen } from './src/screens/AvatarScreen';
import { GameOverScreen } from './src/screens/GameOverScreen';
import { GuessScreen } from './src/screens/GuessScreen';
import { RevealScreen, SUSPENSE_MS } from './src/screens/RevealScreen';
import { LandingScreen } from './src/screens/LandingScreen';
import { LobbyScreen, makeRoomCode } from './src/screens/LobbyScreen';
import { MatchmakingScreen } from './src/screens/MatchmakingScreen';
import { VoteScreen } from './src/screens/VoteScreen';
import { greetReturningPlayer, setMusic } from './src/sound';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
  });
  const [route, setRoute] = useState<Route>({ name: 'landing' });
  const home = () => setRoute({ name: 'landing' });
  const inGame = route.name === 'game' || route.name === 'online';

  useEffect(greetReturningPlayer, []);
  useEffect(() => setMusic(inGame ? 'game' : 'menu'), [inGame]);

  // Android back: menus step back to the landing screen; a running game is left alone.
  useEffect(() => {
    if (route.name === 'landing' || route.name === 'game' || route.name === 'online') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setRoute({ name: 'landing' });
      return true;
    });
    return () => sub.remove();
  }, [route.name]);

  let screen;
  switch (route.name) {
    case 'landing':
      screen = <LandingScreen onChoose={(c) => setRoute(c === 'lobby' ? { name: 'lobby', code: makeRoomCode() } : c === 'ranked' ? { name: 'ranked' } : { name: 'avatar' })} />;
      break;
    case 'ranked':
      screen = <MatchmakingScreen onMatched={() => setRoute({ name: 'online', id: Date.now() })} onCancel={home} />;
      break;
    case 'lobby':
      screen = <LobbyScreen code={route.code} onStart={(roster) => setRoute({ name: 'game', roster, id: Date.now() })} onBack={home} />;
      break;
    case 'avatar':
      screen = <AvatarScreen onBack={home} />;
      break;
    case 'game':
      screen = <LocalGame key={route.id} roster={route.roster} onExit={home} />;
      break;
    case 'online':
      screen = <OnlineGame key={route.id} onPlayAgain={() => setRoute({ name: 'ranked' })} onExit={home} />;
      break;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }}>
        <MagicSky />
        <SafeAreaView style={{ flex: 1 }}>
          {!fontsLoaded ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <HatWizard size={120} mood="think" />
            </View>
          ) : (
            <Enter key={route.name} from={20} style={{ flex: 1 }}>
              {screen}
            </Enter>
          )}
        </SafeAreaView>
      </View>
      {fontsLoaded && <SoundSheet />}
    </SafeAreaProvider>
  );
}

type Route =
  | { name: 'landing' }
  | { name: 'ranked' }
  | { name: 'avatar' }
  | { name: 'lobby'; code: string }
  | { name: 'game'; roster: Seat[]; id: number }
  | { name: 'online'; id: number };

/** A lobby game, played on this device with rivals: just for fun, no RP. */
function LocalGame({ roster, onExit }: { roster: Seat[]; onExit: () => void }) {
  const game = useGame(roster);
  return <Game game={game} ranked={false} onRestart={game.restart} onExit={onExit} />;
}

/**
 * A ranked match on the game server. Leaving the screen leaves the match: the socket closes
 * here rather than in an effect cleanup, which hot reloads would run mid-game.
 */
function OnlineGame({ onPlayAgain, onExit }: { onPlayAgain: () => void; onExit: () => void }) {
  const leave = (then: () => void) => () => {
    closeServer();
    then();
  };
  const game = useOnlineGame(leave(onExit));
  return <Game game={game} ranked rank={game.rank} onRestart={leave(onPlayAgain)} onExit={leave(onExit)} />;
}

type GameProps = { game: GameControls; ranked: boolean; rank?: RankedResult; onRestart: () => void; onExit: () => void };

function Game({ game, ranked, rank: rankResult, onRestart, onExit }: GameProps) {
  const { state, guesser, question, voters, totalRounds, lockGuess, vote, reveal, next, dial, moveDial } = game;
  const round = state.round + 1;
  const isLastRound = round >= totalRounds;

  // The table holds its reaction until the reveal's drum-roll is over.
  const turnKey = `${state.round}-${state.phase}`;
  const [revealedTurn, setRevealedTurn] = useState('');
  useEffect(() => {
    if (state.phase !== 'reveal') return;
    const t = setTimeout(() => setRevealedTurn(turnKey), SUSPENSE_MS);
    return () => clearTimeout(t);
  }, [state.phase, turnKey]);
  const table = tableState(state, revealedTurn === turnKey);

  // Each phase gets a fresh key, so every screen change plays its entrance.
  const key = `${question.id}-${state.phase}`;
  let screen;
  switch (state.phase) {
    case 'guess':
      screen = (
        <GuessScreen
          question={question}
          round={round}
          total={totalRounds}
          guesser={guesser}
          players={state.players}
          dial={dial}
          onDial={moveDial}
          onLock={lockGuess}
        />
      );
      break;
    case 'vote':
      screen = (
        <VoteScreen
          question={question}
          round={round}
          total={totalRounds}
          guesser={guesser}
          guess={state.guess ?? 0}
          voters={voters}
          votes={state.votes}
          onVote={vote}
          onTimeUp={reveal}
        />
      );
      break;
    case 'reveal':
      screen = (
        <RevealScreen
          question={question}
          round={round}
          total={totalRounds}
          guesser={guesser}
          guess={state.guess ?? 0}
          results={state.results}
          isLastRound={isLastRound}
          onNext={next}
        />
      );
      break;
    case 'gameOver':
      screen = <GameOverScreen players={state.players} ranked={ranked} rank={rankResult} onRestart={onRestart} onMenu={onExit} />;
      break;
  }
  return (
    <View style={{ flex: 1 }}>
      <Enter key={key} from={24} style={{ flex: 1 }}>
        {screen}
      </Enter>
      {/* Stays mounted through every phase so the animals never reload mid-match. */}
      {state.phase !== 'gameOver' && <PlayerTable players={state.players} table={table} />}
    </View>
  );
}
