import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard, defaultPieces } from 'react-chessboard';
import { MoveListPanel } from './components/MoveListPanel';
import { ScorePanel } from './components/ScorePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useChessboardOptions } from './hooks/useChessboardOptions';
import { useGameFlow } from './hooks/useGameFlow';
import { useStockfish } from './hooks/useStockfish';
import { useResponsiveBoardSize } from './hooks/useResponsiveBoardSize';
import { useScoreHistory } from './hooks/useScoreHistory';
import { COMMON_OPENING_MAX_PLY, findCurrentOpening, findMatchingCommonOpening } from './data/commonOpenings';
import { handleFreeplayMove, handlePuzzleMove, handleRankedMove } from './lib/moveModeHandlers';
import {
  PIECE_TYPE_LABEL,
  PUZZLE_REPLY_DELAY_MS,
  START_FEN,
  VALID_MOVE_DOT,
  approximateEloForSkillLevel,
  bestMoveSanFromHistory,
  clamp,
  extractSquareFromDragArgs,
  formatElapsedSeconds,
  formatMoveMetaDisplay,
  formatPuzzleThemeLabel,
  formatScoreValue,
  formatTimedPointsSuffix,
  generateRandomTrainingBoard,
  getGameResultMessage,
  getTimeScoreFactor,
  moveSanFromFen,
  normalizeArrowTuples,
  penaltyForMiss,
  pointsForRank,
  randomInt,
  rankLabel,
  replayBoardFromMoves,
  toMoveString
} from './lib/chessCore';
import { BOARD_THEMES, PIECE_SYMBOLS, UNICODE_PIECE_STYLES, createCustomPieces } from './lib/pieceThemes';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const saved = window.localStorage.getItem('chess-trainer-dark-mode');
      if (saved === '1') {
        return true;
      }
      if (saved === '0') {
        return false;
      }
    } catch {
      // ignore storage errors and fall back to media query
    }

    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  });
  const [game, setGame] = useState(() => new Chess());
  const [engineSkillLevel, setEngineSkillLevel] = useState(5);
  const [topN, setTopN] = useState(3);
  const [gameMode, setGameMode] = useState('classic');
  const [randomFenPhase, setRandomFenPhase] = useState('random');
  const [puzzleTheme, setPuzzleTheme] = useState('random');
  const [freeplayAnalyzeMoves, setFreeplayAnalyzeMoves] = useState(true);
  const [useTimeScoring, setUseTimeScoring] = useState(false);
  const [allowCommonOpenings, setAllowCommonOpenings] = useState(false);
  const [playerColor, setPlayerColor] = useState('w');
  const [boardStyle, setBoardStyle] = useState('classic');
  const [pieceStyle, setPieceStyle] = useState('default');
  const [manualBoardOrientation, setManualBoardOrientation] = useState('white');
  const [autoFlipBoard, setAutoFlipBoard] = useState(false);
  const [activePlayerColor, setActivePlayerColor] = useState('w');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [resultOverrideMessage, setResultOverrideMessage] = useState('');
  const [status, setStatus] = useState('Configure settings, then click Start Game.');
  const [currentTopMoves, setCurrentTopMoves] = useState([]);
  const [lastEvaluatedMoves, setLastEvaluatedMoves] = useState([]);
  const [showLastEvaluated, setShowLastEvaluated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState('');
  const [dragSourceSquare, setDragSourceSquare] = useState('');
  const [playerMoveMeta, setPlayerMoveMeta] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [viewedPly, setViewedPly] = useState(0);
  const [sessionStartFen, setSessionStartFen] = useState(START_FEN);
  const [errorSquareStyles, setErrorSquareStyles] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [drawnArrows, setDrawnArrows] = useState([]);
  const [showValidMoves, setShowValidMoves] = useState(true);
  const [playerTurnStartedAt, setPlayerTurnStartedAt] = useState(0);
  const [totalTimedMoveMs, setTotalTimedMoveMs] = useState(0);
  const [liveTimedTurnMs, setLiveTimedTurnMs] = useState(0);
  const [score, setScore] = useState({ earned: 0, possible: 0, errors: 0 });
  const [awaitingNextRandomFen, setAwaitingNextRandomFen] = useState(false);
  const [randomPositionsCompleted, setRandomPositionsCompleted] = useState(0);
  const [puzzleManifest, setPuzzleManifest] = useState(null);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [currentPuzzleMoveIndex, setCurrentPuzzleMoveIndex] = useState(0);
  const [currentPuzzlePlayerMoveCount, setCurrentPuzzlePlayerMoveCount] = useState(0);
  const [currentPuzzlePendingScore, setCurrentPuzzlePendingScore] = useState(0);
  const [awaitingNextPuzzle, setAwaitingNextPuzzle] = useState(false);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [puzzleHintUnlocked, setPuzzleHintUnlocked] = useState(false);
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const [currentSessionSaved, setCurrentSessionSaved] = useState(false);
  const [showScoreHistory, setShowScoreHistory] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [collapsedPanels, setCollapsedPanels] = useState({
    settings: false,
    score: false,
    moves: false
  });

  const boardWrapRef = useRef(null);
  const boardStatusRef = useRef(null);
  const moveListRef = useRef(null);
  const puzzlePoolCacheRef = useRef(new Map());
  const invalidFlashTimeoutsRef = useRef([]);
  const previousMoveHistoryLenRef = useRef(0);
  const currentPuzzlePendingScoreRef = useRef(0);
  const boardWidth = useResponsiveBoardSize(boardWrapRef, boardStatusRef);

  const { ready, error, configure, beginNewGame, evaluateTopMoves, chooseMoveFast } = useStockfish();

  const togglePanel = (panelKey) => {
    setCollapsedPanels((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  };

  useEffect(() => {
    if (!ready) {
      return;
    }
    configure({ skillLevel: engineSkillLevel });
    // configure is intentionally omitted to prevent reconfiguration on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, engineSkillLevel]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chess-trainer-dark-mode', darkMode ? '1' : '0');
    } catch {
      // ignore storage errors
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }
  }, [darkMode]);

  const clampedViewedPly = useMemo(() => clamp(viewedPly, 0, moveHistory.length), [viewedPly, moveHistory.length]);
  const viewingHistory = isGameStarted && clampedViewedPly < moveHistory.length;
  const displayedMoveHistory = useMemo(
    () => moveHistory.slice(0, clampedViewedPly),
    [moveHistory, clampedViewedPly]
  );
  const displayedBoard = useMemo(() => {
    if (!viewingHistory) {
      return new Chess(game.fen());
    }
    return replayBoardFromMoves(displayedMoveHistory, sessionStartFen) || new Chess(game.fen());
  }, [viewingHistory, displayedMoveHistory, sessionStartFen, game]);
  const turnLabel = useMemo(() => (displayedBoard.turn() === 'w' ? 'White' : 'Black'), [displayedBoard]);
  const playerTurn = game.turn() === activePlayerColor;
  const engineColor = activePlayerColor === 'w' ? 'b' : 'w';
  const randomFenMode = gameMode === 'random-fen';
  const puzzleMode = gameMode === 'puzzle';
  const freeplayMode = gameMode === 'freeplay';
  const {
    setScoreHistory,
    scoreModeKey,
    scoreModeLabel,
    classicHistoryKey,
    randomHistoryKey,
    puzzleHistoryKey,
    classicHistoryForSelectedSkill,
    randomHistoryForSelectedPhase,
    puzzleHistoryForSelectedTheme,
    bestClassicScore,
    bestRandomSession,
    bestPuzzleSession,
    activeScoreHistory,
    displayedScoreHistory
  } = useScoreHistory({
    gameMode,
    engineSkillLevel,
    randomFenPhase,
    puzzleTheme,
    useTimeScoring
  });
  const effectiveGameOver = game.isGameOver() || Boolean(resultOverrideMessage);
  const timedScoringTurnActive = useMemo(
    () => (
      useTimeScoring
      && isGameStarted
      && !freeplayMode
      && !effectiveGameOver
      && !viewingHistory
      && !isProcessing
      && !awaitingNextRandomFen
      && !awaitingNextPuzzle
      && playerTurn
      && playerTurnStartedAt > 0
    ),
    [
      useTimeScoring,
      isGameStarted,
      freeplayMode,
      effectiveGameOver,
      viewingHistory,
      isProcessing,
      awaitingNextRandomFen,
      awaitingNextPuzzle,
      playerTurn,
      playerTurnStartedAt
    ]
  );
  const displayedTotalTimedMs = useMemo(
    () => totalTimedMoveMs + (timedScoringTurnActive ? liveTimedTurnMs : 0),
    [totalTimedMoveMs, timedScoringTurnActive, liveTimedTurnMs]
  );
  const settingsLocked = isGameStarted;
  const resolvedPlayerColor = freeplayMode
    ? null
    : (isGameStarted ? activePlayerColor : (playerColor === 'random' ? null : playerColor));
  const whiteHeaderLabel = resolvedPlayerColor === 'w' ? 'White (You)' : 'White';
  const blackHeaderLabel = resolvedPlayerColor === 'b' ? 'Black (You)' : 'Black';
  const resultMessage = resultOverrideMessage || (game.isGameOver() ? getGameResultMessage(game) : '');
  const engineThinking = isGameStarted
    && !effectiveGameOver
    && !viewingHistory
    && isProcessing
    && (randomFenMode || puzzleMode || freeplayMode || game.turn() === engineColor);
  const boardOrientation = useMemo(() => {
    if (autoFlipBoard && isGameStarted) {
      return displayedBoard.turn() === 'w' ? 'white' : 'black';
    }
    return manualBoardOrientation;
  }, [autoFlipBoard, isGameStarted, displayedBoard, manualBoardOrientation]);

  const turnDisplay = useMemo(() => {
    if (!isGameStarted) {
      return 'Not started';
    }
    if (effectiveGameOver) {
      return 'Game over';
    }
    if (viewingHistory) {
      return `Reviewing move ${clampedViewedPly}/${moveHistory.length} (${turnLabel} to move)`;
    }
    if (freeplayMode || puzzleMode) {
      return `${turnLabel} to move`;
    }
    if (playerTurn) {
      return `${turnLabel} to move (You)`;
    }
    if (randomFenMode) {
      return `${turnLabel} to move`;
    }
    return `${turnLabel} to move (Engine)`;
  }, [isGameStarted, effectiveGameOver, viewingHistory, clampedViewedPly, moveHistory.length, playerTurn, turnLabel, randomFenMode, freeplayMode, puzzleMode]);
  const scorePercent = useMemo(() => {
    if (!score.possible) {
      return 0;
    }
    return ((Math.max(0, score.earned) / score.possible) * 100).toFixed(1);
  }, [score]);
  const showWhiteRankColumn = freeplayMode || resolvedPlayerColor === 'w';
  const showBlackRankColumn = freeplayMode || resolvedPlayerColor === 'b';
  const moveRowTemplate = showWhiteRankColumn && showBlackRankColumn
    ? '36px minmax(0, 1fr) minmax(90px, 0.8fr) minmax(0, 1fr) minmax(90px, 0.8fr)'
    : showWhiteRankColumn
      ? '36px minmax(0, 1fr) minmax(90px, 0.8fr) minmax(0, 1fr)'
      : showBlackRankColumn
        ? '36px minmax(0, 1fr) minmax(0, 1fr) minmax(90px, 0.8fr)'
        : '36px minmax(0, 1fr) minmax(0, 1fr)';

  useEffect(() => {
    currentPuzzlePendingScoreRef.current = currentPuzzlePendingScore;
  }, [currentPuzzlePendingScore]);

  useEffect(() => {
    setShowScoreHistory(false);
  }, [gameMode]);

  useEffect(() => {
    if (!puzzleMode || puzzleManifest) {
      return;
    }
    void ensurePuzzleManifest().catch(() => {
      // surfaced when mode starts/loads puzzle
    });
  }, [puzzleMode, puzzleManifest]);

  useEffect(() => {
    if (!timedScoringTurnActive) {
      setLiveTimedTurnMs(0);
      return;
    }

    const tick = () => {
      setLiveTimedTurnMs(Math.max(0, Date.now() - playerTurnStartedAt));
    };

    tick();
    const intervalId = setInterval(tick, 200);
    return () => clearInterval(intervalId);
  }, [timedScoringTurnActive, playerTurnStartedAt]);

  const playerMetaByPly = useMemo(() => {
    const map = new Map();
    for (const item of playerMoveMeta) {
      map.set(item.ply, item);
    }
    return map;
  }, [playerMoveMeta]);

  const replayBestMoveArrow = useMemo(() => {
    if (!viewingHistory) {
      return null;
    }

    // Show the missed-best-move arrow when reviewing the move itself and
    // also one ply before it, so the hint is visible before the move is played.
    const candidatePlys = [clampedViewedPly, clampedViewedPly + 1];
    for (const ply of candidatePlys) {
      if (ply < 1 || ply > moveHistory.length) {
        continue;
      }

      const meta = playerMetaByPly.get(ply);
      const bestMoveUci = String(meta?.bestMoveUci || '');
      if (!bestMoveUci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMoveUci)) {
        continue;
      }

      const playedMove = moveHistory[ply - 1];
      if (!playedMove || toMoveString(playedMove) === bestMoveUci) {
        continue;
      }

      return [bestMoveUci.slice(0, 2), bestMoveUci.slice(2, 4), 'rgb(255,170,0)'];
    }

    return null;
  }, [viewingHistory, clampedViewedPly, playerMetaByPly, moveHistory]);

  const displayArrows = useMemo(() => {
    const arrows = Array.isArray(drawnArrows) ? drawnArrows : [];
    if (!replayBestMoveArrow) {
      return arrows;
    }

    const [from, to] = replayBestMoveArrow;
    const exists = arrows.some((arrow) => Array.isArray(arrow) && arrow[0] === from && arrow[1] === to);
    return exists ? arrows : [...arrows, replayBestMoveArrow];
  }, [drawnArrows, replayBestMoveArrow]);

  const areArrowsEqual = useCallback((a, b) => {
    if (a === b) {
      return true;
    }
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];
      if (!Array.isArray(left) || !Array.isArray(right)) {
        return false;
      }
      if (left[0] !== right[0] || left[1] !== right[1] || (left[2] || '') !== (right[2] || '')) {
        return false;
      }
    }
    return true;
  }, []);

  const handleArrowsChange = useCallback((nextArrows) => {
    const normalized = normalizeArrowTuples(nextArrows);
    setDrawnArrows((prev) => (areArrowsEqual(prev, normalized) ? prev : normalized));
  }, [areArrowsEqual]);

  const moveRows = useMemo(() => {
    const rows = [];

    for (let i = 0; i < moveHistory.length; i += 2) {
      const whiteMove = moveHistory[i];
      const blackMove = moveHistory[i + 1];
      const moveNumber = Math.floor(i / 2) + 1;

      rows.push({
        moveNumber,
        white: whiteMove,
        black: blackMove,
        whiteMeta: whiteMove ? playerMetaByPly.get(i + 1) : null,
        blackMeta: blackMove ? playerMetaByPly.get(i + 2) : null
      });
    }

    return rows;
  }, [moveHistory, playerMetaByPly]);

  const capturedPieces = useMemo(() => {
    const capturedByWhite = [];
    const capturedByBlack = [];

    for (const move of displayedMoveHistory) {
      if (!move?.captured) {
        continue;
      }

      const capturedCode = `${move.color === 'w' ? 'b' : 'w'}${move.captured.toUpperCase()}`;
      if (!PIECE_SYMBOLS[capturedCode]) {
        continue;
      }

      if (move.color === 'w') {
        capturedByWhite.push(capturedCode);
      } else {
        capturedByBlack.push(capturedCode);
      }
    }

    return { capturedByWhite, capturedByBlack };
  }, [displayedMoveHistory]);

  const currentOpening = useMemo(() => {
    if (randomFenMode || puzzleMode || !moveHistory.length) {
      return null;
    }

    const lineMoves = moveHistory.map(toMoveString);
    for (let i = lineMoves.length; i >= 1; i -= 1) {
      const match = findCurrentOpening(lineMoves.slice(0, i));
      if (match) {
        return match;
      }
    }

    return null;
  }, [randomFenMode, puzzleMode, moveHistory]);

  const puzzleThemeDisplay = useMemo(() => {
    if (!puzzleMode) {
      return '';
    }
    if (puzzleTheme !== 'random') {
      return formatPuzzleThemeLabel(puzzleTheme);
    }
    const actualTheme = currentPuzzle?.themes?.[0];
    return actualTheme ? `Random (${formatPuzzleThemeLabel(actualTheme)})` : 'Random';
  }, [puzzleMode, puzzleTheme, currentPuzzle]);
  const activeScoreHistoryTitle = useMemo(() => {
    if (puzzleMode) {
      return `Puzzle History (${formatPuzzleThemeLabel(puzzleTheme)}, ${scoreModeLabel})`;
    }
    if (randomFenMode) {
      return `Random History (${randomFenPhase === 'random' ? 'Random' : randomFenPhase}, ${scoreModeLabel})`;
    }
    return `Classic History (Level ${engineSkillLevel}, ${scoreModeLabel})`;
  }, [puzzleMode, puzzleTheme, randomFenMode, randomFenPhase, engineSkillLevel, scoreModeLabel]);
  const clearHistoryButtonTitle = useMemo(() => {
    if (puzzleMode) {
      return `Clear Puzzle History (${formatPuzzleThemeLabel(puzzleTheme)})`;
    }
    if (randomFenMode) {
      return 'Clear Random History';
    }
    return `Clear Classic History (Level ${engineSkillLevel})`;
  }, [puzzleMode, puzzleTheme, randomFenMode, engineSkillLevel]);
  const clearHistoryAriaLabel = useMemo(() => {
    if (puzzleMode) {
      return `Clear Puzzle History for theme ${formatPuzzleThemeLabel(puzzleTheme)}`;
    }
    if (randomFenMode) {
      return `Clear Random History for ${randomFenPhase === 'random' ? 'Random' : randomFenPhase} phase`;
    }
    return `Clear Classic History for Skill Level ${engineSkillLevel}`;
  }, [puzzleMode, puzzleTheme, randomFenMode, randomFenPhase, engineSkillLevel]);

  const nextPuzzleHint = useMemo(() => {
    if (!puzzleMode || !puzzleHintUnlocked || awaitingNextPuzzle) {
      return '';
    }
    const nextMoveUci = currentPuzzle?.moves?.[currentPuzzleMoveIndex];
    if (!nextMoveUci) {
      return '';
    }
    return moveSanFromFen(game.fen(), nextMoveUci);
  }, [puzzleMode, puzzleHintUnlocked, awaitingNextPuzzle, currentPuzzle, currentPuzzleMoveIndex, game]);

  const chessboardTheme = useMemo(() => BOARD_THEMES[boardStyle] || BOARD_THEMES.classic, [boardStyle]);
  const lightSquareStyle = useMemo(() => ({ backgroundColor: chessboardTheme.light }), [chessboardTheme.light]);
  const darkSquareStyle = useMemo(() => ({ backgroundColor: chessboardTheme.dark }), [chessboardTheme.dark]);
  const dropSquareStyle = useMemo(() => ({ boxShadow: 'inset 0 0 0 6px rgba(255, 255, 255, 0.78)' }), []);
  const boardRenderStyle = useMemo(
    () => ({ ...chessboardTheme.board, width: `${boardWidth}px`, maxWidth: '100%' }),
    [chessboardTheme.board, boardWidth]
  );
  const customPieces = useMemo(() => createCustomPieces(pieceStyle), [pieceStyle]);

  const renderPromotionPreviewPiece = useCallback((pieceCode) => {
    const pieceRenderer = (customPieces || defaultPieces)?.[pieceCode];
    if (!pieceRenderer) {
      return PIECE_SYMBOLS[pieceCode] || '';
    }

    try {
      return pieceRenderer({ square: 'e4', svgStyle: { width: '100%', height: '100%' } });
    } catch {
      return pieceRenderer();
    }
  }, [customPieces]);

  const renderCapturedPiece = (pieceCode, key) => {
    const unicodeStyle = UNICODE_PIECE_STYLES[pieceStyle] || (pieceStyle === 'glyph' ? UNICODE_PIECE_STYLES.unicode1 : null);
    return (
      <span
        className={`capture-piece-glyph ${pieceCode[0] === 'w' ? 'capture-piece-glyph-white-text' : 'capture-piece-glyph-black-text'}`}
        key={key}
        title={pieceCode}
        style={unicodeStyle ? { fontFamily: unicodeStyle.fontFamily } : undefined}
      >
        {PIECE_SYMBOLS[pieceCode]}
      </span>
    );
  };

  useEffect(() => {
    if (!moveListRef.current) {
      return;
    }
    moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [moveRows.length]);

  useLayoutEffect(() => {
    const previousLen = previousMoveHistoryLenRef.current;
    setViewedPly((prev) => (prev === previousLen ? moveHistory.length : Math.min(prev, moveHistory.length)));
    previousMoveHistoryLenRef.current = moveHistory.length;
    setRightClickedSquares({});
    setDrawnArrows([]);
  }, [moveHistory.length]);

  useEffect(() => {
    if (!viewingHistory) {
      return;
    }
    setSelectedSquare('');
    setDragSourceSquare('');
  }, [viewingHistory]);

  const selectedSquareStyles = useMemo(() => {
    const styles = { ...rightClickedSquares, ...errorSquareStyles };
    const sourceSquare = dragSourceSquare || selectedSquare;

    if (showValidMoves && sourceSquare) {
      const validTargets = displayedBoard.moves({ square: sourceSquare, verbose: true });
      for (const move of validTargets) {
        styles[move.to] = {
          backgroundImage: VALID_MOVE_DOT,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '54% 54%',
          boxShadow: 'inset 0 0 0 6px rgba(34,139,34,0.85)'
        };
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        background: 'radial-gradient(circle, rgba(255,240,114,0.7), rgba(255,216,44,0.35))'
      };
    }
    return styles;
  }, [selectedSquare, dragSourceSquare, rightClickedSquares, errorSquareStyles, showValidMoves, displayedBoard]);

  const flashInvalidMoveSquares = (sourceSquare, targetSquare) => {
    for (const timeoutId of invalidFlashTimeoutsRef.current) {
      clearTimeout(timeoutId);
    }
    invalidFlashTimeoutsRef.current = [];

    const initial = {
      transition: 'background-color 1500ms ease-out',
      backgroundColor: 'rgba(110, 0, 0, 0.95)',
      boxShadow: 'inset 0 0 0 6px rgba(255, 70, 70, 0.95)'
    };
    const faded = {
      transition: 'background-color 1500ms ease-out',
      backgroundColor: 'rgba(110, 0, 0, 0.28)',
      boxShadow: 'inset 0 0 0 6px rgba(255, 70, 70, 0.95)'
    };

    setErrorSquareStyles({
      [sourceSquare]: initial,
      [targetSquare]: initial
    });

    const fadeTimeout = setTimeout(() => {
      setErrorSquareStyles({
        [sourceSquare]: faded,
        [targetSquare]: faded
      });
    }, 40);

    const clearTimeoutId = setTimeout(() => {
      setErrorSquareStyles({});
    }, 1600);

    invalidFlashTimeoutsRef.current = [fadeTimeout, clearTimeoutId];
  };

  useEffect(() => {
    return () => {
      for (const timeoutId of invalidFlashTimeoutsRef.current) {
        clearTimeout(timeoutId);
      }
      invalidFlashTimeoutsRef.current = [];
    };
  }, []);

  const { resetToSetup, finishGame } = useGameFlow({
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
  });

  const preloadTopMoves = async (fen, nextTopN) => {
    const { topMoves } = await evaluateTopMoves({ fen, topN: nextTopN });
    setCurrentTopMoves(topMoves);
    return topMoves;
  };

  const ensurePuzzleManifest = async () => {
    if (puzzleManifest) {
      return puzzleManifest;
    }
    const res = await fetch('/puzzles/manifest.json');
    if (!res.ok) {
      throw new Error('Puzzle pack not found. Run the puzzle pack build step first.');
    }
    const manifest = await res.json();
    setPuzzleManifest(manifest);
    return manifest;
  };

  const loadPuzzlePool = async (themeKey) => {
    const cacheKey = themeKey || 'random';
    const cached = puzzlePoolCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const manifest = await ensurePuzzleManifest();
    let path = manifest.randomFile;
    if (cacheKey !== 'random') {
      const match = manifest.themes?.find((t) => t.theme === cacheKey || t.slug === cacheKey);
      if (!match) {
        throw new Error(`Puzzle theme not found: ${cacheKey}`);
      }
      path = match.file;
    }

    const res = await fetch(`/puzzles/${path}`);
    if (!res.ok) {
      throw new Error('Failed to load puzzle data.');
    }
    const pool = await res.json();
    puzzlePoolCacheRef.current.set(cacheKey, pool);
    return pool;
  };

  const loadPuzzlePosition = async (statusMessage) => {
    const pool = await loadPuzzlePool(puzzleTheme);
    if (!Array.isArray(pool) || !pool.length) {
      throw new Error('No puzzles available for the selected theme.');
    }

    const puzzle = pool[randomInt(0, pool.length - 1)];
    const board = new Chess(puzzle.fen);
    const puzzleMoves = Array.isArray(puzzle.moves) ? puzzle.moves : [];
    let startIndex = 0;
    let seedMove = null;

    // Lichess puzzle CSV lines typically include the pre-played move first.
    // Apply it so the player starts on the tactical side.
    if (puzzleMoves.length) {
      const first = puzzleMoves[0];
      const applied = board.move({
        from: first.slice(0, 2),
        to: first.slice(2, 4),
        promotion: first[4]
      });
      if (applied) {
        seedMove = applied;
        startIndex = 1;
      }
    }

    const playerMoveCount = puzzleMoves.reduce((count, _, idx) => (
      idx >= startIndex && ((idx - startIndex) % 2 === 0) ? count + 1 : count
    ), 0);
    const puzzleSide = board.turn();

    setCurrentPuzzle(puzzle);
    setCurrentPuzzleMoveIndex(startIndex);
    setCurrentPuzzlePlayerMoveCount(playerMoveCount);
    setCurrentPuzzlePendingScore(0);
    currentPuzzlePendingScoreRef.current = 0;
    setAwaitingNextPuzzle(false);
    setPuzzleHintUnlocked(false);
    setShowPuzzleHint(false);
    setSessionStartFen(puzzle.fen);
    setGame(new Chess(board.fen()));
    setActivePlayerColor(puzzleSide);
    setManualBoardOrientation(puzzleSide === 'w' ? 'white' : 'black');
    setMoveHistory(seedMove ? [seedMove] : []);
    setPlayerMoveMeta([]);
    setCurrentTopMoves([]);
    setLastEvaluatedMoves([]);
    setShowLastEvaluated(false);
    setSelectedSquare('');
    setDragSourceSquare('');
    setErrorSquareStyles({});
    setRightClickedSquares({});
    setDrawnArrows([]);
    setStatus(statusMessage || `Puzzle loaded${puzzleTheme !== 'random' ? ` (${puzzleTheme})` : ''}.`);
    setPlayerTurnStartedAt(Date.now());
  };

  const loadRandomFenPosition = async (playerSide, statusMessage) => {
    const board = await generateRandomTrainingBoard({
      playerColor: playerSide,
      minLegalMoves: Math.max(1, topN),
      phase: randomFenPhase
    });
    const seedHistory = board.history({ verbose: true });

    setSessionStartFen(START_FEN);
    setGame(new Chess(board.fen()));
    setSelectedSquare('');
    setDragSourceSquare('');
    setErrorSquareStyles({});
    setRightClickedSquares({});
    setDrawnArrows([]);
    setMoveHistory(seedHistory);
    setPlayerMoveMeta([]);
    setCurrentTopMoves([]);
    setAwaitingNextRandomFen(false);

    await preloadTopMoves(board.fen(), topN);
    setStatus(statusMessage || 'Random position loaded.');
    setPlayerTurnStartedAt(Date.now());
  };

  const nextRandomFenPosition = async () => {
    if (!isGameStarted || !randomFenMode || isProcessing || !awaitingNextRandomFen) {
      return;
    }

    setIsProcessing(true);
    try {
      await loadRandomFenPosition(activePlayerColor, 'New random position loaded.');
    } catch (e) {
      setStatus(e.message || 'Engine error while loading random position.');
    } finally {
      setIsProcessing(false);
    }
  };

  const nextPuzzlePosition = async () => {
    if (!isGameStarted || !puzzleMode || isProcessing || !awaitingNextPuzzle) {
      return;
    }

    setIsProcessing(true);
    try {
      await loadPuzzlePosition('New puzzle loaded.');
    } catch (e) {
      setStatus(e.message || 'Error loading next puzzle.');
    } finally {
      setIsProcessing(false);
    }
  };

  const applyEngineReply = async (boardAfterHumanMove, lastRankLabel, scoreSnapshot = score, historyAfterHumanMove = null) => {
    const bestMove = await chooseMoveFast({ fen: boardAfterHumanMove.fen() });
    const liveBoard = new Chess(boardAfterHumanMove.fen());
    let engineMove = null;

    if (bestMove && bestMove !== '(none)') {
      engineMove = liveBoard.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove[4]
      });

      if (!engineMove) {
        setStatus('Engine produced an invalid move. Start a new game.');
        setIsProcessing(false);
        return;
      }

      setGame(new Chess(liveBoard.fen()));
      setMoveHistory((prev) => [...prev, engineMove]);
      setSelectedSquare('');
      setDragSourceSquare('');
    }

    if (!randomFenMode && !puzzleMode) {
      const repetitionLine = historyAfterHumanMove
        ? (engineMove ? [...historyAfterHumanMove, engineMove] : historyAfterHumanMove)
        : null;
      const repetitionBoard = repetitionLine ? replayBoardFromMoves(repetitionLine) : null;
      if (repetitionBoard && repetitionBoard.isThreefoldRepetition()) {
        finishGame(repetitionBoard, scoreSnapshot, { resultOverride: 'Draw by threefold repetition.' });
        return;
      }
      if (!repetitionBoard && liveBoard.isThreefoldRepetition()) {
        finishGame(liveBoard, scoreSnapshot, { resultOverride: 'Draw by threefold repetition.' });
        return;
      }
    }

    if (liveBoard.isGameOver()) {
      finishGame(liveBoard, scoreSnapshot);
      return;
    }

    await preloadTopMoves(liveBoard.fen(), topN);
    setStatus(lastRankLabel);
    setPlayerTurnStartedAt(Date.now());
    setIsProcessing(false);
  };

  const startGame = async () => {
    if (!ready) {
      setStatus('Engine is still loading. Try again in a moment.');
      return;
    }

    beginNewGame();

    const chosenColor =
      playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : playerColor;
    const board = new Chess();
    setGame(board);
    setSessionStartFen(START_FEN);
    setIsGameStarted(true);
    setResultOverrideMessage('');
    setActivePlayerColor(chosenColor);
    setManualBoardOrientation(chosenColor === 'b' ? 'black' : 'white');
    setCurrentTopMoves([]);
    setLastEvaluatedMoves([]);
    setShowLastEvaluated(false);
    setSelectedSquare('');
    setDragSourceSquare('');
    setPlayerMoveMeta([]);
    setMoveHistory([]);
    setScore({ earned: 0, possible: 0, errors: 0 });
    setErrorSquareStyles({});
    setRightClickedSquares({});
    setDrawnArrows([]);
    setIsProcessing(true);
    setRandomPositionsCompleted(0);
    setCurrentSessionSaved(false);
    setPlayerTurnStartedAt(0);
    setTotalTimedMoveMs(0);
    setLiveTimedTurnMs(0);

    try {
      if (randomFenMode) {
        await loadRandomFenPosition(
          chosenColor,
          `Random mode started as ${chosenColor === 'w' ? 'White' : 'Black'}.`
        );
        setIsProcessing(false);
        return;
      }

      if (puzzleMode) {
        await ensurePuzzleManifest();
        await loadPuzzlePosition('Puzzle mode started.');
        setIsProcessing(false);
        return;
      }

      if (freeplayMode) {
        if (freeplayAnalyzeMoves) {
          await preloadTopMoves(board.fen(), topN);
          setStatus(`Freeplay started (${chosenColor === 'w' ? 'White' : 'Black'} orientation). Analysis on.`);
        } else {
          setCurrentTopMoves([]);
          setStatus(`Freeplay started (${chosenColor === 'w' ? 'White' : 'Black'} orientation). Analysis off.`);
        }
        setPlayerTurnStartedAt(Date.now());
        setIsProcessing(false);
        return;
      }

      if (chosenColor === 'b') {
        const bestMove = await chooseMoveFast({ fen: board.fen() });
        if (bestMove && bestMove !== '(none)') {
          const openingEngineMove = board.move({
            from: bestMove.slice(0, 2),
            to: bestMove.slice(2, 4),
            promotion: bestMove[4]
          });
          if (openingEngineMove) {
            setMoveHistory((prev) => [...prev, openingEngineMove]);
          }
          setGame(new Chess(board.fen()));
        }
      }

      await preloadTopMoves(board.fen(), topN);
      setStatus(`Game started as ${chosenColor === 'w' ? 'White' : 'Black'}.`);
      setPlayerTurnStartedAt(Date.now());
    } catch (e) {
      setStatus(e.message || 'Engine error while starting game.');
    }

    setIsProcessing(false);
  };

  const tryPlayerMove = (sourceSquare, targetSquare, forcedPromotion) => {
    if (!ready) {
      setStatus('Engine not ready yet.');
      return false;
    }

    if (!isGameStarted) {
      setStatus('Click Start Game before moving.');
      return false;
    }

    if (isProcessing) {
      setStatus('Engine is thinking. Please wait.');
      return false;
    }

    if (viewingHistory) {
      setStatus('Review mode active. Click Latest in Move List to continue playing.');
      return false;
    }

    if (randomFenMode && awaitingNextRandomFen) {
      setStatus('Click Next Position to continue.');
      return false;
    }

    if (puzzleMode && awaitingNextPuzzle) {
      setStatus('Click Next Puzzle to continue.');
      return false;
    }

    if (effectiveGameOver) {
      setStatus('Game is over. Start a new game.');
      return false;
    }

    if (!freeplayMode && !playerTurn) {
      setStatus('It is not your turn.');
      return false;
    }

    if ((!freeplayMode || freeplayAnalyzeMoves) && !puzzleMode && !currentTopMoves.length) {
      setStatus('Analyzing position...');
      return false;
    }

    const needsHistoryAwareBoard = !randomFenMode && !puzzleMode;
    const testGame = needsHistoryAwareBoard
      ? (replayBoardFromMoves(moveHistory) || new Chess(game.fen()))
      : new Chess(game.fen());
    const movingPiece = testGame.get(sourceSquare);
    let promotion = forcedPromotion;

    const isPromotionMove = Boolean(
      movingPiece?.type === 'p' &&
      ((movingPiece.color === 'w' && targetSquare.endsWith('8')) ||
        (movingPiece.color === 'b' && targetSquare.endsWith('1')))
    );
    if (isPromotionMove) {
      promotion = ['q', 'r', 'b', 'n'].includes(forcedPromotion) ? forcedPromotion : 'q';
    }

    let humanMove;
    try {
      humanMove = testGame.move({ from: sourceSquare, to: targetSquare, promotion });
    } catch (e) {
      return false;
    }

    if (!humanMove) {
      return false;
    }

    const moveUci = toMoveString(humanMove);
    const rank = (freeplayMode && !freeplayAnalyzeMoves) ? 0 : (currentTopMoves.indexOf(moveUci) + 1);
    const bestMove = bestMoveSanFromHistory(moveHistory, currentTopMoves[0]);
    const ply = testGame.history().length;
    const elapsedMs = playerTurnStartedAt ? Math.max(0, Date.now() - playerTurnStartedAt) : 0;
    const timeFactor = useTimeScoring ? getTimeScoreFactor(elapsedMs) : 1;
    const timedMoveSuffix = useTimeScoring ? ` Time: ${formatElapsedSeconds(elapsedMs)}.` : '';
    if (useTimeScoring && !freeplayMode) {
      setTotalTimedMoveMs((prev) => prev + elapsedMs);
    }

    if (puzzleMode) {
      return handlePuzzleMove({
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
        puzzleReplyDelayMs: PUZZLE_REPLY_DELAY_MS,
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
      });
    }

    if (freeplayMode) {
      return handleFreeplayMove({
        rank,
        topN,
        timeFactor,
        ply,
        humanMove,
        currentTopMoves,
        bestMove,
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
      });
    }

    return handleRankedMove({
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
      commonOpeningMaxPly: COMMON_OPENING_MAX_PLY,
      toMoveString
    });
  };

  const getPromotionContextForMove = useCallback((sourceSquare, targetSquare) => {
    if (!sourceSquare || !targetSquare) {
      return null;
    }

    const needsHistoryAwareBoard = !randomFenMode && !puzzleMode;
    const testGame = needsHistoryAwareBoard
      ? (replayBoardFromMoves(moveHistory) || new Chess(game.fen()))
      : new Chess(game.fen());
    const movingPiece = testGame.get(sourceSquare);

    if (!movingPiece || movingPiece.type !== 'p') {
      return null;
    }

    const reachesLastRank =
      (movingPiece.color === 'w' && targetSquare.endsWith('8'))
      || (movingPiece.color === 'b' && targetSquare.endsWith('1'));
    if (!reachesLastRank) {
      return null;
    }

    return {
      sourceSquare,
      targetSquare,
      color: movingPiece.color
    };
  }, [randomFenMode, puzzleMode, moveHistory, game]);

  const openPromotionChooser = useCallback((sourceSquare, targetSquare) => {
    const context = getPromotionContextForMove(sourceSquare, targetSquare);
    if (!context) {
      return false;
    }

    setPendingPromotion(context);
    setSelectedSquare('');
    setDragSourceSquare('');
    return true;
  }, [getPromotionContextForMove]);

  const resolvePromotionChoice = (promotionPiece) => {
    if (!pendingPromotion) {
      return;
    }

    const { sourceSquare, targetSquare } = pendingPromotion;
    setPendingPromotion(null);
    void tryPlayerMove(sourceSquare, targetSquare, promotionPiece);
  };

  const onDrop = (sourceSquare, targetSquare) => {
    if (!sourceSquare || !targetSquare) {
      setDragSourceSquare('');
      return false;
    }

    if (openPromotionChooser(sourceSquare, targetSquare)) {
      return false;
    }

    setDragSourceSquare('');
    return tryPlayerMove(sourceSquare, targetSquare);
  };

  const resignGame = () => {
    if (!isGameStarted || isProcessing || effectiveGameOver || randomFenMode || puzzleMode) {
      return;
    }

    const resigningSide = game.turn() === 'w' ? 'White' : 'Black';
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    const result = `${resigningSide} resigned. ${winner} wins.`;

    if (freeplayMode) {
      finishGame(game, score, { resultOverride: result, statusOverride: result });
      return;
    }

    finishGame(game, score, { resultOverride: result });
  };

  const clearActiveScoreHistory = () => {
    const confirmMessage = puzzleMode
      ? `Clear Puzzle score history and top score for theme ${puzzleTheme} (${scoreModeLabel})?`
      : randomFenMode
        ? `Clear Random Position score history and top score for ${randomFenPhase === 'random' ? 'Random' : randomFenPhase} phase (${scoreModeLabel})?`
        : `Clear Classic score history and top score for Skill Level ${engineSkillLevel} (${scoreModeLabel})?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setScoreHistory((prev) => {
      if (randomFenMode) {
        const nextRandomByPhase = { ...(prev.randomByPhase || {}) };
        delete nextRandomByPhase[randomHistoryKey];
        if (scoreModeKey === 'standard') {
          delete nextRandomByPhase[String(randomFenPhase)];
        }
        return { ...prev, randomByPhase: nextRandomByPhase };
      }

      if (puzzleMode) {
        const nextPuzzleByTheme = { ...(prev.puzzleByTheme || {}) };
        delete nextPuzzleByTheme[puzzleHistoryKey];
        if (scoreModeKey === 'standard') {
          delete nextPuzzleByTheme[String(puzzleTheme)];
        }
        return { ...prev, puzzleByTheme: nextPuzzleByTheme };
      }

      const nextClassicBySkill = { ...(prev.classicBySkill || {}) };
      delete nextClassicBySkill[classicHistoryKey];
      if (scoreModeKey === 'standard') {
        delete nextClassicBySkill[String(engineSkillLevel)];
      }
      return { ...prev, classicBySkill: nextClassicBySkill };
    });
    setShowScoreHistory(false);
    setStatus(
      puzzleMode
        ? `Puzzle history cleared for theme ${puzzleTheme} (${scoreModeLabel}).`
        : randomFenMode
          ? `Random score history cleared for ${randomFenPhase === 'random' ? 'Random' : randomFenPhase} phase (${scoreModeLabel}).`
          : `Classic history cleared for skill level ${engineSkillLevel} (${scoreModeLabel}).`
    );
  };

  const onPieceDragBegin = (...args) => {
    const sourceSquare = extractSquareFromDragArgs(...args);

    if (!sourceSquare) {
      return;
    }

    setSelectedSquare('');
    setDragSourceSquare(sourceSquare);
  };

  const onPieceDragEnd = () => {
    setDragSourceSquare('');
  };

  const onSquareClick = (square) => {
    if (pendingPromotion) {
      return;
    }

    if (randomFenMode && awaitingNextRandomFen) {
      setStatus('Click Next Position to continue.');
      return;
    }
    if (puzzleMode && awaitingNextPuzzle) {
      setStatus('Click Next Puzzle to continue.');
      return;
    }

    if (!isGameStarted || isProcessing || effectiveGameOver || (!freeplayMode && !playerTurn)) {
      return;
    }

    if (viewingHistory) {
      setStatus('Review mode active. Click Latest in Move List to continue playing.');
      return;
    }

    const piece = displayedBoard.get(square);
    const selectableColor = freeplayMode ? displayedBoard.turn() : activePlayerColor;

    if (!selectedSquare) {
      if (piece && piece.color === selectableColor) {
        setDragSourceSquare('');
        setSelectedSquare(square);
      }
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare('');
      setDragSourceSquare('');
      return;
    }

    if (piece && piece.color === selectableColor) {
      setDragSourceSquare('');
      setSelectedSquare(square);
      return;
    }

    if (openPromotionChooser(selectedSquare, square)) {
      return;
    }

    const moved = tryPlayerMove(selectedSquare, square);
    if (!moved) {
      setSelectedSquare('');
    }
  };

  const onSquareRightClick = (square) => {
    if (!square || !/^[a-h][1-8]$/.test(square)) {
      return;
    }
    if (!isGameStarted || effectiveGameOver) {
      return;
    }

    setRightClickedSquares((prev) => {
      if (prev[square]) {
        const next = { ...prev };
        delete next[square];
        return next;
      }

      return {
        ...prev,
        [square]: {
          backgroundColor: 'rgba(215, 38, 61, 0.58)',
          boxShadow: 'inset 0 0 0 6px rgba(165, 18, 36, 0.92)'
        }
      };
    });
  };

  const goToFirstMove = () => {
    setViewedPly(0);
  };

  const goToPreviousMove = () => {
    setViewedPly((prev) => Math.max(0, prev - 1));
  };

  const goToNextMove = () => {
    setViewedPly((prev) => Math.min(moveHistory.length, prev + 1));
  };

  const goToLatestMove = () => {
    setViewedPly(moveHistory.length);
  };

  useEffect(() => {
    const onGlobalHistoryKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        const isFormControl = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
        if (isFormControl || target.isContentEditable) {
          return;
        }
      }

      if (!moveHistory.length || pendingPromotion) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousMove();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextMove();
          break;
        case 'ArrowUp':
          event.preventDefault();
          goToFirstMove();
          break;
        case 'ArrowDown':
          event.preventDefault();
          goToLatestMove();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onGlobalHistoryKeyDown);
    return () => window.removeEventListener('keydown', onGlobalHistoryKeyDown);
  }, [moveHistory.length, pendingPromotion]);

  const chessboardOptions = useChessboardOptions({
    displayedBoard,
    boardOrientation,
    boardRenderStyle,
    lightSquareStyle,
    darkSquareStyle,
    dropSquareStyle,
    selectedSquareStyles,
    customPieces,
    isGameStarted,
    viewingHistory,
    isProcessing,
    effectiveGameOver,
    freeplayMode,
    puzzleMode,
    playerTurn,
    pendingPromotion,
    displayArrows,
    handleArrowsChange,
    onPieceDragBegin,
    onPieceDragEnd,
    onDrop,
    onSquareClick,
    onSquareRightClick
  });

  const settingsPanelProps = {
    collapsed: collapsedPanels.settings,
    onToggle: () => togglePanel('settings'),
    gameMode,
    settingsLocked,
    setGameMode,
    randomFenMode,
    randomFenPhase,
    setRandomFenPhase,
    puzzleMode,
    puzzleTheme,
    setPuzzleTheme,
    puzzleManifest,
    formatPuzzleThemeLabel,
    engineSkillLevel,
    freeplayMode,
    setEngineSkillLevel,
    clamp,
    approximateEloForSkillLevel,
    topN,
    setTopN,
    allowCommonOpenings,
    setAllowCommonOpenings,
    freeplayAnalyzeMoves,
    setFreeplayAnalyzeMoves,
    playerColor,
    setPlayerColor,
    boardStyle,
    setBoardStyle,
    BOARD_THEMES,
    pieceStyle,
    setPieceStyle,
    UNICODE_PIECE_STYLES,
    showValidMoves,
    setShowValidMoves,
    darkMode,
    setDarkMode,
    useTimeScoring,
    setUseTimeScoring,
    isGameStarted,
    startGame,
    resetToSetup,
    ready,
    isProcessing
  };

  const scorePanelProps = {
    collapsed: collapsedPanels.score,
    onToggle: () => togglePanel('score'),
    status,
    freeplayMode,
    score,
    scorePercent,
    useTimeScoring,
    displayedTotalTimedMs,
    randomFenMode,
    puzzleMode,
    currentOpening,
    randomPositionsCompleted,
    puzzlesCompleted,
    puzzleThemeDisplay,
    freeplayAnalyzeMoves,
    topN,
    scoreModeLabel,
    bestClassicScore,
    bestRandomSession,
    bestPuzzleSession,
    randomFenPhase,
    puzzleTheme,
    showScoreHistory,
    onToggleScoreHistory: () => setShowScoreHistory((prev) => !prev),
    activeScoreHistoryTitle,
    clearActiveScoreHistory,
    clearHistoryButtonTitle,
    clearHistoryAriaLabel,
    activeScoreHistory,
    displayedScoreHistory,
    lastEvaluatedMoves,
    showLastEvaluated,
    onToggleLastEvaluated: () => setShowLastEvaluated((prev) => !prev),
    puzzleHintUnlocked,
    nextPuzzleHint,
    showPuzzleHint,
    onTogglePuzzleHint: () => setShowPuzzleHint((prev) => !prev),
    error
  };

  const moveListPanelProps = {
    collapsed: collapsedPanels.moves,
    onToggle: () => togglePanel('moves'),
    moveHistory,
    clampedViewedPly,
    viewingHistory,
    goToFirstMove,
    goToPreviousMove,
    goToNextMove,
    goToLatestMove,
    moveRows,
    moveListRef,
    moveRowTemplate,
    resolvedPlayerColor,
    whiteHeaderLabel,
    blackHeaderLabel,
    showWhiteRankColumn,
    showBlackRankColumn,
    formatMoveMetaDisplay
  };

  return (
    <div className={`app ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      <div className="board-status" ref={boardStatusRef}>
        <div className="board-head">
          <div className="board-title">Chess Trainer</div>
          <div className="board-actions">
            {!autoFlipBoard ? (
              <button
                type="button"
                className="secondary board-flip-button"
                onClick={() => setManualBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
              >
                Flip Board
              </button>
            ) : null}
            {freeplayMode ? (
              <label className="board-toggle">
                <span>Flip Each Turn</span>
                <input
                  type="checkbox"
                  checked={autoFlipBoard}
                  onChange={(e) => setAutoFlipBoard(e.target.checked)}
                />
              </label>
            ) : null}
            {isGameStarted && !randomFenMode && !puzzleMode ? (
              <button
                type="button"
                className="secondary board-flip-button"
                onClick={resignGame}
                disabled={isProcessing || effectiveGameOver}
              >
                Resign
              </button>
            ) : null}
          </div>
        </div>
        <div className="turn-line" role="status" aria-live="polite" aria-atomic="true">
          <strong>Turn:</strong> {turnDisplay}
          {engineThinking ? <span className="spinner" aria-label="Engine thinking" /> : null}
        </div>
        {resultMessage ? (
          <div className="result-line" role="alert" aria-live="assertive" aria-atomic="true">
            <strong>Result:</strong> {resultMessage}
          </div>
        ) : null}
      </div>

      <main className="board-wrap" ref={boardWrapRef}>
        <div className="board-area" onContextMenu={(e) => e.preventDefault()}>
          <Chessboard options={chessboardOptions} />
          {pendingPromotion ? (
            <div className="promotion-overlay" role="dialog" aria-label="Choose promotion piece">
              <div className="promotion-card">
                <div className="promotion-title">Choose Promotion Piece</div>
                <div className="promotion-actions">
                  {['q', 'r', 'b', 'n'].map((pieceType) => {
                    const pieceCode = `${pendingPromotion.color}${pieceType.toUpperCase()}`;
                    return (
                      <button
                        type="button"
                        key={pieceType}
                        className="promotion-button"
                        onClick={() => resolvePromotionChoice(pieceType)}
                      >
                        <span className="promotion-glyph">{renderPromotionPreviewPiece(pieceCode)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {randomFenMode ? (
        <div className="random-next-bar" aria-label="Random position controls">
          <button
            type="button"
            className="random-next-button"
            onClick={nextRandomFenPosition}
            disabled={!isGameStarted || isProcessing || !awaitingNextRandomFen}
          >
            Next Position
          </button>
        </div>
      ) : puzzleMode ? (
        <div className="random-next-bar" aria-label="Puzzle controls">
          <button
            type="button"
            className="random-next-button"
            onClick={nextPuzzlePosition}
            disabled={!isGameStarted || isProcessing || !awaitingNextPuzzle}
          >
            Next Puzzle
          </button>
        </div>
      ) : (
        <aside className="capture-bar" aria-label="Captured pieces">
          <div className="capture-group">
            <div className="capture-label">Black Taken</div>
            <div className="capture-list">
              {capturedPieces.capturedByWhite.length ? (
                capturedPieces.capturedByWhite.map((piece, index) => (
                  renderCapturedPiece(piece, `bw-${piece}-${index}`)
                ))
              ) : (
                <span className="capture-empty">-</span>
              )}
            </div>
          </div>
          <div className="capture-group">
            <div className="capture-label">White Taken</div>
            <div className="capture-list">
              {capturedPieces.capturedByBlack.length ? (
                capturedPieces.capturedByBlack.map((piece, index) => (
                  renderCapturedPiece(piece, `wb-${piece}-${index}`)
                ))
              ) : (
                <span className="capture-empty">-</span>
              )}
            </div>
          </div>
        </aside>
      )}

      <div className="left-column">
        <SettingsPanel {...settingsPanelProps} />
        <ScorePanel {...scorePanelProps} />
        <MoveListPanel {...moveListPanelProps} />
      </div>
    </div>
  );
}
