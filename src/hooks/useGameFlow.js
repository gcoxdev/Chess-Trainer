import { useCallback } from 'react';
import { Chess } from 'chess.js';
import { START_FEN, formatScoreValue } from '../lib/chessCore';

export function useGameFlow({
  isGameStarted,
  randomFenMode,
  puzzleMode,
  freeplayMode,
  currentSessionSaved,
  score,
  randomPositionsCompleted,
  puzzlesCompleted,
  randomHistoryKey,
  randomFenPhase,
  scoreModeKey,
  totalTimedMoveMs,
  puzzleHistoryKey,
  puzzleTheme,
  topN,
  classicHistoryKey,
  engineSkillLevel,
  currentPuzzlePendingScoreRef,
  setScoreHistory,
  setGame,
  setSessionStartFen,
  setIsGameStarted,
  setResultOverrideMessage,
  setCurrentTopMoves,
  setLastEvaluatedMoves,
  setShowLastEvaluated,
  setStatus,
  setSelectedSquare,
  setDragSourceSquare,
  setIsProcessing,
  setPlayerMoveMeta,
  setMoveHistory,
  setScore,
  setErrorSquareStyles,
  setRightClickedSquares,
  setDrawnArrows,
  setActivePlayerColor,
  setManualBoardOrientation,
  setAwaitingNextRandomFen,
  setAwaitingNextPuzzle,
  setCurrentPuzzle,
  setCurrentPuzzleMoveIndex,
  setCurrentPuzzlePlayerMoveCount,
  setCurrentPuzzlePendingScore,
  setRandomPositionsCompleted,
  setPuzzlesCompleted,
  setPuzzleHintUnlocked,
  setShowPuzzleHint,
  setCurrentSessionSaved,
  setPlayerTurnStartedAt,
  setTotalTimedMoveMs,
  setLiveTimedTurnMs,
  setPendingPromotion
}) {
  const resetToSetup = useCallback(() => {
    if (isGameStarted && randomFenMode && !currentSessionSaved && (score.possible > 0 || randomPositionsCompleted > 0)) {
      const percent = score.possible ? (Math.max(0, score.earned) / score.possible) * 100 : 0;
      setScoreHistory((prev) => ({
        ...prev,
        randomByPhase: {
          ...(prev.randomByPhase || {}),
          [randomHistoryKey]: [
            {
              earned: score.earned,
              possible: score.possible,
              percent,
              positions: randomPositionsCompleted,
              topN,
              timestamp: Date.now(),
              phase: randomFenPhase,
              scoreMode: scoreModeKey,
              totalMoveTimeMs: totalTimedMoveMs
            },
            ...((prev.randomByPhase?.[randomHistoryKey] ?? []))
          ].slice(0, 100)
        }
      }));
    }
    if (isGameStarted && puzzleMode && !currentSessionSaved && (score.possible > 0 || puzzlesCompleted > 0)) {
      const percent = score.possible ? (Math.max(0, score.earned) / score.possible) * 100 : 0;
      setScoreHistory((prev) => ({
        ...prev,
        puzzleByTheme: {
          ...(prev.puzzleByTheme || {}),
          [puzzleHistoryKey]: [
            {
              earned: score.earned,
              possible: score.possible,
              percent,
              puzzles: puzzlesCompleted,
              timestamp: Date.now(),
              theme: puzzleTheme,
              scoreMode: scoreModeKey,
              totalMoveTimeMs: totalTimedMoveMs
            },
            ...((prev.puzzleByTheme?.[puzzleHistoryKey] ?? []))
          ].slice(0, 100)
        }
      }));
    }

    setGame(new Chess());
    setSessionStartFen(START_FEN);
    setIsGameStarted(false);
    setResultOverrideMessage('');
    setCurrentTopMoves([]);
    setLastEvaluatedMoves([]);
    setShowLastEvaluated(false);
    setStatus('Configure settings, then click Start Game.');
    setSelectedSquare('');
    setDragSourceSquare('');
    setIsProcessing(false);
    setPlayerMoveMeta([]);
    setMoveHistory([]);
    setScore({ earned: 0, possible: 0, errors: 0 });
    setErrorSquareStyles({});
    setRightClickedSquares({});
    setDrawnArrows([]);
    setActivePlayerColor('w');
    setManualBoardOrientation('white');
    setAwaitingNextRandomFen(false);
    setAwaitingNextPuzzle(false);
    setCurrentPuzzle(null);
    setCurrentPuzzleMoveIndex(0);
    setCurrentPuzzlePlayerMoveCount(0);
    setCurrentPuzzlePendingScore(0);
    currentPuzzlePendingScoreRef.current = 0;
    setRandomPositionsCompleted(0);
    setPuzzlesCompleted(0);
    setPuzzleHintUnlocked(false);
    setShowPuzzleHint(false);
    setCurrentSessionSaved(false);
    setPlayerTurnStartedAt(0);
    setTotalTimedMoveMs(0);
    setLiveTimedTurnMs(0);
    setPendingPromotion(null);
  }, [
    isGameStarted,
    randomFenMode,
    currentSessionSaved,
    score,
    randomPositionsCompleted,
    setScoreHistory,
    randomHistoryKey,
    topN,
    randomFenPhase,
    scoreModeKey,
    totalTimedMoveMs,
    puzzleMode,
    puzzlesCompleted,
    puzzleHistoryKey,
    puzzleTheme,
    setGame,
    setSessionStartFen,
    setIsGameStarted,
    setResultOverrideMessage,
    setCurrentTopMoves,
    setLastEvaluatedMoves,
    setShowLastEvaluated,
    setStatus,
    setSelectedSquare,
    setDragSourceSquare,
    setIsProcessing,
    setPlayerMoveMeta,
    setMoveHistory,
    setScore,
    setErrorSquareStyles,
    setRightClickedSquares,
    setDrawnArrows,
    setActivePlayerColor,
    setManualBoardOrientation,
    setAwaitingNextRandomFen,
    setAwaitingNextPuzzle,
    setCurrentPuzzle,
    setCurrentPuzzleMoveIndex,
    setCurrentPuzzlePlayerMoveCount,
    setCurrentPuzzlePendingScore,
    currentPuzzlePendingScoreRef,
    setRandomPositionsCompleted,
    setPuzzlesCompleted,
    setPuzzleHintUnlocked,
    setShowPuzzleHint,
    setCurrentSessionSaved,
    setPlayerTurnStartedAt,
    setTotalTimedMoveMs,
    setLiveTimedTurnMs,
    setPendingPromotion
  ]);

  const finishGame = useCallback((board, scoreSnapshot = score, options = {}) => {
    const { resultOverride = '', statusOverride = '' } = options;
    setResultOverrideMessage(resultOverride || '');

    if (freeplayMode || puzzleMode) {
      setStatus(statusOverride || resultOverride || (board.isGameOver() ? 'Game over.' : (puzzleMode ? 'Puzzle mode ended.' : 'Freeplay ended.')));
      setCurrentTopMoves([]);
      setIsProcessing(false);
      setSelectedSquare('');
      setDragSourceSquare('');
      setAwaitingNextRandomFen(false);
      setAwaitingNextPuzzle(false);
      return;
    }

    const percentValue = scoreSnapshot.possible
      ? (Math.max(0, scoreSnapshot.earned) / scoreSnapshot.possible) * 100
      : 0;
    const percent = percentValue.toFixed(1);
    setStatus(statusOverride || `Final score: ${formatScoreValue(Math.max(0, scoreSnapshot.earned))}/${formatScoreValue(scoreSnapshot.possible)} (${percent}%).`);
    setCurrentTopMoves([]);
    setIsProcessing(false);
    setSelectedSquare('');
    setDragSourceSquare('');
    setAwaitingNextRandomFen(false);

    if (!randomFenMode && !currentSessionSaved && scoreSnapshot.possible > 0) {
      setScoreHistory((prev) => ({
        ...prev,
        classicBySkill: {
          ...(prev.classicBySkill || {}),
          [classicHistoryKey]: [
            {
              earned: scoreSnapshot.earned,
              possible: scoreSnapshot.possible,
              percent: percentValue,
              topN,
              timestamp: Date.now(),
              skillLevel: engineSkillLevel,
              scoreMode: scoreModeKey,
              totalMoveTimeMs: totalTimedMoveMs
            },
            ...((prev.classicBySkill?.[classicHistoryKey] ?? []))
          ].slice(0, 100)
        }
      }));
      setCurrentSessionSaved(true);
    }
  }, [
    score,
    setResultOverrideMessage,
    freeplayMode,
    puzzleMode,
    setStatus,
    setCurrentTopMoves,
    setIsProcessing,
    setSelectedSquare,
    setDragSourceSquare,
    setAwaitingNextRandomFen,
    setAwaitingNextPuzzle,
    randomFenMode,
    currentSessionSaved,
    setScoreHistory,
    classicHistoryKey,
    topN,
    engineSkillLevel,
    scoreModeKey,
    totalTimedMoveMs,
    setCurrentSessionSaved
  ]);

  return { resetToSetup, finishGame };
}
