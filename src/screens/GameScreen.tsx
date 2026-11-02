import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { PlayerStrip } from '../avatar/PlayerStrip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Enter } from '../components/Effects';
import { ExitGameContext } from '../components/ui';
import type { RankedResult } from '../game/rank';
import { tableState } from '../game/table';
import { GameControls, Seat, useGame } from '../game/useGame';
import { useOnlineGame } from '../game/useOnlineGame';
import { close as closeServer } from '../net/server';
import { playQuestion, setFillers } from '../sound';
import { GameOverScreen } from './GameOverScreen';
import { GuessScreen } from './GuessScreen';
import { RevealScreen } from './RevealScreen';
import { StandingsScreen } from './StandingsScreen';
import { VoteScreen } from './VoteScreen';

/** A lobby game, played on this device with rivals: just for fun, no RP. */
export function LocalGame({ roster, onExit }: { roster: Seat[]; onExit: () => void }) {
  const game = useGame(roster);
  return <Game game={game} ranked={false} onRestart={game.restart} onExit={onExit} />;
}

/**
 * A ranked match on the game server. Leaving the screen leaves the match: the socket closes
 * here rather than in an effect cleanup, which hot reloads would run mid-game.
 */
export function OnlineGame({ onPlayAgain, onExit }: { onPlayAgain: () => void; onExit: () => void }) {
  const leave = (then: () => void) => () => {
    closeServer();
    then();
  };
  const game = useOnlineGame(leave(onExit));
  return <Game game={game} ranked rank={game.rank} onRestart={leave(onPlayAgain)} onExit={leave(onExit)} />;
}

type GameProps = { game: GameControls; ranked: boolean; rank?: RankedResult; onRestart: () => void; onExit: () => void };

function Game({ game, ranked, rank: rankResult, onRestart, onExit }: GameProps) {
  const { state, guesser, question, voters, totalRounds, guessSeconds, voteSeconds, lockGuess, vote, reveal, next, dial, moveDial } = game;
  const round = state.round + 1;
  const isLastRound = round >= totalRounds;

  // The final scores get their moment without the Hat chattering over them.
  useEffect(() => {
    setFillers(state.phase === 'guess' ? 'guess' : state.phase === 'gameOver' ? null : 'general');
  }, [state.phase]);

  // The Hat reads each question aloud the moment it appears.
  useEffect(() => {
    if (question.voiceOver) playQuestion(question.voiceOver);
  }, [question.id, question.voiceOver]);

  // The strip only shows while guessing and voting; the reveal lists everyone's points itself.
  const table = tableState(state, true);
  const showStrip = state.phase === 'guess' || state.phase === 'vote';

  // Leaving mid-match always asks first, from the top bar's exit button or Android back.
  const [confirmingExit, setConfirmingExit] = useState(false);
  const askExit = () => setConfirmingExit(true);
  useEffect(() => {
    if (state.phase === 'gameOver') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setConfirmingExit(true);
      return true;
    });
    return () => sub.remove();
  }, [state.phase]);

  // The standings sit between the reveal and the next round, still in the reveal phase, so they
  // need nothing from the server: "Next round" on them is the reveal's own next.
  const turn = `${state.round}-${question.id}`;
  const [standingsFor, setStandingsFor] = useState<string | null>(null);
  const showStandings = state.phase === 'reveal' && standingsFor === turn;

  // Each phase gets a fresh key, so every screen change plays its entrance.
  const key = `${question.id}-${state.phase}${showStandings ? '-standings' : ''}`;
  let screen;
  switch (state.phase) {
    case 'guess':
      screen = (
        <GuessScreen
          question={question}
          round={round}
          total={totalRounds}
          duration={guessSeconds}
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
          duration={voteSeconds}
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
      screen = showStandings ? (
        <StandingsScreen round={round} total={totalRounds} players={state.players} results={state.results} isLastRound={isLastRound} onNext={next} />
      ) : (
        <RevealScreen
          question={question}
          round={round}
          total={totalRounds}
          guesser={guesser}
          guess={state.guess ?? 0}
          results={state.results}
          onNext={() => setStandingsFor(turn)}
        />
      );
      break;
    case 'gameOver':
      screen = <GameOverScreen players={state.players} ranked={ranked} rank={rankResult} onRestart={onRestart} onMenu={onExit} />;
      break;
  }
  return (
    <ExitGameContext value={askExit}>
      <View style={{ flex: 1 }}>
        <Enter key={key} from={24} style={{ flex: 1 }}>
          {screen}
        </Enter>
        {showStrip && <PlayerStrip players={state.players} table={table} />}
      </View>
      <ConfirmDialog
        visible={confirmingExit && state.phase !== 'gameOver'}
        title="Abandon the game?"
        message={ranked ? "You'll forfeit this ranked match, and the rest of the table plays on without you." : 'Your progress this game will be lost.'}
        confirmLabel="Abandon game"
        onConfirm={onExit}
        onCancel={() => setConfirmingExit(false)}
      />
    </ExitGameContext>
  );
}
