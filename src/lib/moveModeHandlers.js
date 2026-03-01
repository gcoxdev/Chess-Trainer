import { Chess } from 'chess.js';

export function handlePuzzleMove({
  testGame,
  humanMove,
  moveUci,
  sourceSquare,
  targetSquare,
  timedMoveSuffix,
  currentPuzzle,
  currentPuzzleMoveIndex,
  currentPuzzlePlayerMoveCount,
  currentPuzzlePendingScoreRef,
  ply,
  timeFactor,
  elapsedMs,
  puzzleReplyDelayMs,
  setStatus,
  setSelectedSquare,
  setDragSourceSquare,
  flashInvalidMoveSquares,
  setPuzzleHintUnlocked,
  setShowPuzzleHint,
  setCurrentPuzzlePendingScore,
  setScore,
  setGame,
  setMoveHistory,
  setPlayerMoveMeta,
  setCurrentPuzzleMoveIndex,
  setAwaitingNextPuzzle,
  setPuzzlesCompleted,
  setIsProcessing,
  setPlayerTurnStartedAt
}) {
  const expectedMove = currentPuzzle?.moves?.[currentPuzzleMoveIndex];
  if (!expectedMove) {
    setStatus('Puzzle sequence is unavailable. Load another puzzle.');
    return false;
  }

  if (moveUci !== expectedMove) {
    setStatus(`Incorrect puzzle move.${timedMoveSuffix}`);
    setSelectedSquare('');
    setDragSourceSquare('');
    flashInvalidMoveSquares(sourceSquare, targetSquare);
    setPuzzleHintUnlocked(true);
    setShowPuzzleHint(false);
    const nextPendingScore = currentPuzzlePendingScoreRef.current - 1;
    currentPuzzlePendingScoreRef.current = nextPendingScore;
    setCurrentPuzzlePendingScore(nextPendingScore);
    setScore((prev) => ({ ...prev, errors: prev.errors + 1 }));
    return false;
  }

  setGame(testGame);
  setMoveHistory((prev) => [...prev, humanMove]);
  setSelectedSquare('');
  setDragSourceSquare('');
  setPlayerMoveMeta((prev) => [
    ...prev,
    {
      ply,
      san: humanMove.san,
      rank: 1,
      label: 'Puzzle Move',
      points: timeFactor,
      timeFactor,
      elapsedMs
    }
  ]);
  const pendingAfterPlayerMove = currentPuzzlePendingScoreRef.current + timeFactor;
  currentPuzzlePendingScoreRef.current = pendingAfterPlayerMove;
  setCurrentPuzzlePendingScore(pendingAfterPlayerMove);

  const nextIndex = currentPuzzleMoveIndex + 1;
  const totalMoves = currentPuzzle?.moves?.length ?? 0;

  if (nextIndex >= totalMoves || testGame.isGameOver()) {
    setCurrentPuzzleMoveIndex(nextIndex);
    setScore((prev) => ({
      ...prev,
      earned: prev.earned + pendingAfterPlayerMove,
      possible: prev.possible + currentPuzzlePlayerMoveCount
    }));
    setCurrentPuzzlePendingScore(0);
    currentPuzzlePendingScoreRef.current = 0;
    setAwaitingNextPuzzle(true);
    setPuzzlesCompleted((prev) => prev + 1);
    setStatus(`Puzzle solved.${timedMoveSuffix} Click Next Puzzle.`);
    return true;
  }

  const boardAfterPlayerMoveFen = testGame.fen();
  setStatus(`Correct puzzle move.${timedMoveSuffix} Opponent replying...`);
  setIsProcessing(true);

  const snapshotPuzzle = currentPuzzle;
  const snapshotNextIndex = nextIndex;
  const snapshotTotalMoves = totalMoves;

  setTimeout(() => {
    const liveBoard = new Chess(boardAfterPlayerMoveFen);
    const opponentMoveUci = snapshotPuzzle?.moves?.[snapshotNextIndex];
    if (!opponentMoveUci) {
      setCurrentPuzzleMoveIndex(snapshotNextIndex);
      setStatus('Puzzle sequence error. Load another puzzle.');
      setIsProcessing(false);
      return;
    }

    const opponentMove = liveBoard.move({
      from: opponentMoveUci.slice(0, 2),
      to: opponentMoveUci.slice(2, 4),
      promotion: opponentMoveUci[4]
    });

    if (!opponentMove) {
      setCurrentPuzzleMoveIndex(snapshotNextIndex);
      setStatus('Puzzle sequence error. Load another puzzle.');
      setIsProcessing(false);
      return;
    }

    setGame(new Chess(liveBoard.fen()));
    setMoveHistory((prev) => [...prev, opponentMove]);
    setCurrentPuzzleMoveIndex(snapshotNextIndex + 1);

    if (snapshotNextIndex + 1 >= snapshotTotalMoves || liveBoard.isGameOver()) {
      setScore((prev) => ({
        ...prev,
        earned: prev.earned + pendingAfterPlayerMove,
        possible: prev.possible + currentPuzzlePlayerMoveCount
      }));
      setCurrentPuzzlePendingScore(0);
      currentPuzzlePendingScoreRef.current = 0;
      setAwaitingNextPuzzle(true);
      setPuzzlesCompleted((prev) => prev + 1);
      setStatus(`Puzzle solved.${timedMoveSuffix} Click Next Puzzle.`);
      setIsProcessing(false);
      return;
    }

    const remaining = snapshotTotalMoves - (snapshotNextIndex + 1);
    setStatus(`Correct puzzle move.${timedMoveSuffix} Opponent replied ${opponentMove.san}. ${remaining} move${remaining === 1 ? '' : 's'} remaining.`);
    setPlayerTurnStartedAt(Date.now());
    setIsProcessing(false);
  }, puzzleReplyDelayMs);

  return true;
}

export function handleFreeplayMove({
  rank,
  topN,
  timeFactor,
  ply,
  humanMove,
  currentTopMoves,
  testGame,
  timedMoveSuffix,
  useTimeScoring,
  elapsedMs,
  score,
  freeplayAnalyzeMoves,
  setPlayerMoveMeta,
  setGame,
  setMoveHistory,
  setSelectedSquare,
  setDragSourceSquare,
  setLastEvaluatedMoves,
  setShowLastEvaluated,
  setCurrentTopMoves,
  setStatus,
  setIsProcessing,
  setPlayerTurnStartedAt,
  preloadTopMoves,
  finishGame,
  formatScoreValue,
  formatTimedPointsSuffix,
  pointsForRank,
  rankLabel
}) {
  const basePoints = rank ? pointsForRank(rank, topN) : 0;
  const earnedPoints = basePoints * timeFactor;
  const rankText = rank ? rankLabel(rank) : '';

  if (freeplayAnalyzeMoves) {
    setPlayerMoveMeta((prev) => [
      ...prev,
      {
        ply,
        san: humanMove.san,
        rank: rank || null,
        label: rankText || `Outside Top ${topN}`,
        points: earnedPoints,
        bestMove: currentTopMoves[0],
        bestMoveUci: currentTopMoves[0] || '',
        timeFactor,
        elapsedMs
      }
    ]);
  }

  setGame(testGame);
  setMoveHistory((prev) => [...prev, humanMove]);
  setSelectedSquare('');
  setDragSourceSquare('');
  setLastEvaluatedMoves(currentTopMoves);
  setShowLastEvaluated(false);
  setCurrentTopMoves([]);

  const moveStatus = !freeplayAnalyzeMoves
    ? `Freeplay move accepted.${timedMoveSuffix}`
    : rank
      ? `${rankText}. +${formatScoreValue(earnedPoints)} move score.${formatTimedPointsSuffix({ useTimeScoring, elapsedMs, timeFactor })}${timedMoveSuffix}`
      : `Outside top ${topN}. Freeplay move accepted.${timedMoveSuffix}`;

  if (testGame.isThreefoldRepetition()) {
    finishGame(testGame, score, {
      resultOverride: 'Draw by threefold repetition.',
      statusOverride: 'Draw by threefold repetition.'
    });
    return true;
  }

  if (testGame.isGameOver()) {
    setStatus(moveStatus);
    setIsProcessing(false);
    return true;
  }

  if (!freeplayAnalyzeMoves) {
    setStatus(moveStatus);
    setPlayerTurnStartedAt(Date.now());
    return true;
  }

  setIsProcessing(true);
  void (async () => {
    try {
      await preloadTopMoves(testGame.fen(), topN);
      setStatus(moveStatus);
      setPlayerTurnStartedAt(Date.now());
    } catch (e) {
      setStatus(e.message || 'Engine error while analyzing freeplay move.');
    } finally {
      setIsProcessing(false);
    }
  })();
  return true;
}

export function handleRankedMove({
  rank,
  randomFenMode,
  allowCommonOpenings,
  ply,
  moveHistory,
  moveUci,
  topN,
  timedMoveSuffix,
  currentTopMoves,
  sourceSquare,
  targetSquare,
  score,
  timeFactor,
  elapsedMs,
  testGame,
  humanMove,
  bestMove,
  useTimeScoring,
  setPlayerMoveMeta,
  setGame,
  setMoveHistory,
  setSelectedSquare,
  setDragSourceSquare,
  setLastEvaluatedMoves,
  setShowLastEvaluated,
  setCurrentTopMoves,
  setIsProcessing,
  setStatus,
  setScore,
  setRandomPositionsCompleted,
  setAwaitingNextRandomFen,
  flashInvalidMoveSquares,
  finishGame,
  applyEngineReply,
  formatScoreValue,
  formatTimedPointsSuffix,
  penaltyForMiss,
  pointsForRank,
  rankLabel,
  findMatchingCommonOpening,
  commonOpeningMaxPly,
  toMoveString
}) {
  if (!rank) {
    const openingMatch = !randomFenMode && allowCommonOpenings && ply <= commonOpeningMaxPly
      ? findMatchingCommonOpening([...moveHistory.map(toMoveString), moveUci])
      : null;

    if (openingMatch) {
      setPlayerMoveMeta((prev) => [
        ...prev,
        {
          ply,
          san: humanMove.san,
          rank: null,
          label: 'Common Opening Allowed',
          points: 0,
          openingAllowed: true,
          bestMove,
          bestMoveUci: currentTopMoves[0] || ''
        }
      ]);

      setGame(testGame);
      setMoveHistory((prev) => [...prev, humanMove]);
      setSelectedSquare('');
      setDragSourceSquare('');
      setLastEvaluatedMoves(currentTopMoves);
      setShowLastEvaluated(false);
      setCurrentTopMoves([]);

      if (testGame.isThreefoldRepetition()) {
        finishGame(testGame, score, { resultOverride: 'Draw by threefold repetition.' });
        return true;
      }

      if (testGame.isGameOver()) {
        finishGame(testGame);
        return true;
      }

      setIsProcessing(true);
      void applyEngineReply(testGame, `Common opening allowed (${openingMatch.label}). No penalty.`, score, [...moveHistory, humanMove]);
      return true;
    }

    setStatus(`Move rejected. Not in top ${topN}.${timedMoveSuffix}`);
    setLastEvaluatedMoves(currentTopMoves);
    setShowLastEvaluated(false);
    setSelectedSquare('');
    setDragSourceSquare('');
    flashInvalidMoveSquares(sourceSquare, targetSquare);
    setScore((prev) => ({ ...prev, earned: prev.earned - penaltyForMiss(topN), errors: prev.errors + 1 }));
    return false;
  }

  const basePoints = pointsForRank(rank, topN);
  const earnedPoints = basePoints * timeFactor;
  const rankText = rankLabel(rank);

  const projectedScore = {
    earned: score.earned + earnedPoints,
    possible: score.possible + 1,
    errors: score.errors
  };

  setScore((prev) => ({
    earned: prev.earned + earnedPoints,
    possible: prev.possible + 1,
    errors: prev.errors
  }));

  setPlayerMoveMeta((prev) => [
    ...prev,
    {
      ply,
      san: humanMove.san,
      rank,
      label: rankText,
      points: earnedPoints,
      bestMove,
      bestMoveUci: currentTopMoves[0] || '',
      timeFactor,
      elapsedMs
    }
  ]);

  setGame(testGame);
  setMoveHistory((prev) => [...prev, humanMove]);
  setSelectedSquare('');
  setDragSourceSquare('');
  setLastEvaluatedMoves(currentTopMoves);
  setShowLastEvaluated(false);
  setCurrentTopMoves([]);

  if (!randomFenMode && testGame.isThreefoldRepetition()) {
    finishGame(testGame, projectedScore, { resultOverride: 'Draw by threefold repetition.' });
    return true;
  }

  if (!randomFenMode && testGame.isGameOver()) {
    finishGame(testGame, projectedScore);
    return true;
  }

  setIsProcessing(true);
  const timedPointsSuffix = formatTimedPointsSuffix({ useTimeScoring, elapsedMs, timeFactor });
  setStatus(`${rankText}. +${formatScoreValue(earnedPoints)} points.${timedPointsSuffix}${timedMoveSuffix}`);

  if (randomFenMode) {
    setRandomPositionsCompleted((prev) => prev + 1);
    setAwaitingNextRandomFen(true);
    setIsProcessing(false);
    setStatus(`${rankText}. +${formatScoreValue(earnedPoints)} points.${timedPointsSuffix}${timedMoveSuffix} Click Next Position.`);
    return true;
  }

  void applyEngineReply(testGame, `${rankText}. +${formatScoreValue(earnedPoints)} points${timedPointsSuffix}`, projectedScore, [...moveHistory, humanMove]);
  return true;
}
