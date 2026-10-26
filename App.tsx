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
import { RankedResult, recordRankedGame } from './src/game/rank';
import { Seat, useGame } from './src/game/useGame';
import { GameOverScreen } from './src/screens/GameOverScreen';
import { GuessScreen } from './src/screens/GuessScreen';
import { RevealScreen } from './src/screens/RevealScreen';
import { LandingScreen } from './src/screens/LandingScreen';
import { LobbyScreen, makeRoomCode } from './src/screens/LobbyScreen';
import { MatchmakingScreen } from './src/screens/MatchmakingScreen';
import { VoteScreen } from './src/screens/VoteScreen';
import { startMusic, stopMusic } from './src/sound';
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

  // Android back: menus step back to the landing screen; a running game is left alone.
  useEffect(() => {
    if (route.name === 'landing' || route.name === 'game') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setRoute({ name: 'landing' });
      return true;
    });
    return () => sub.remove();
  }, [route.name]);

  let screen;
  switch (route.name) {
    case 'landing':
      screen = <LandingScreen onChoose={(c) => setRoute(c === 'ranked' ? { name: 'ranked' } : { name: 'lobby', code: makeRoomCode() })} />;
      break;
    case 'ranked':
      screen = <MatchmakingScreen onMatched={(roster) => setRoute({ name: 'game', roster, ranked: true, id: Date.now() })} onCancel={home} />;
      break;
    case 'lobby':
      screen = <LobbyScreen code={route.code} onStart={(roster) => setRoute({ name: 'game', roster, ranked: false, id: Date.now() })} onBack={home} />;
      break;
    case 'game':
      screen = <Game key={route.id} roster={route.roster} ranked={route.ranked} onExit={home} />;
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
    </SafeAreaProvider>
  );
}

type Route = { name: 'landing' } | { name: 'ranked' } | { name: 'lobby'; code: string } | { name: 'game'; roster: Seat[]; ranked: boolean; id: number };

function Game({ roster, ranked, onExit }: { roster: Seat[]; ranked: boolean; onExit: () => void }) {
  const { state, guesser, question, voters, totalRounds, lockGuess, vote, reveal, next, restart } = useGame(roster);
  const round = state.round + 1;
  const isLastRound = round >= totalRounds;
  const [rankResult, setRankResult] = useState<RankedResult>();

  // Leaving the last reveal ends the match: that's when a ranked game counts.
  const onNext = () => {
    if (isLastRound && ranked && state.phase === 'reveal') setRankResult(recordRankedGame(state.players));
    next();
  };
  const onRestart = () => {
    setRankResult(undefined);
    restart();
  };

  useEffect(() => {
    startMusic();
    return stopMusic;
  }, []);

  // Each phase gets a fresh key, so every screen change plays its entrance.
  const key = `${question.id}-${state.phase}`;
  let screen;
  switch (state.phase) {
    case 'guess':
      screen = <GuessScreen question={question} round={round} total={totalRounds} waiting={voters} onLock={lockGuess} />;
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
          players={state.players}
          results={state.results}
          isLastRound={isLastRound}
          onNext={onNext}
        />
      );
      break;
    case 'gameOver':
      screen = <GameOverScreen players={state.players} ranked={ranked} rank={rankResult} onRestart={onRestart} onMenu={onExit} />;
      break;
  }
  return (
    <Enter key={key} from={24} style={{ flex: 1 }}>
      {screen}
    </Enter>
  );
}
