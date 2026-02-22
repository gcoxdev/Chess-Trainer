import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useStockfish } from './hooks/useStockfish';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toMoveString(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function ordinal(rank) {
  const mod10 = rank % 10;
  const mod100 = rank % 100;
  if (mod10 === 1 && mod100 !== 11) return `${rank}st`;
  if (mod10 === 2 && mod100 !== 12) return `${rank}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function rankLabel(rank) {
  return rank === 1 ? 'Top Move Played' : `${ordinal(rank)} Best Move Played`;
}

function pointsForRank(rank, topN) {
  return Math.max(1, topN - rank + 1);
}

function getGameResultMessage(board) {
  if (!board.isGameOver()) {
    return '';
  }

  if (board.isCheckmate()) {
    const winner = board.turn() === 'w' ? 'Black' : 'White';
    return `Checkmate. ${winner} wins.`;
  }

  if (board.isStalemate()) {
    return 'Draw by stalemate.';
  }

  if (board.isInsufficientMaterial()) {
    return 'Draw by insufficient material.';
  }

  if (board.isThreefoldRepetition()) {
    return 'Draw by threefold repetition.';
  }

  return 'Draw.';
}

const START_FEN = new Chess().fen();
const VALID_MOVE_DOT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' shape-rendering='geometricPrecision'%3E%3Ccircle cx='50' cy='50' r='22' fill='%23228B22' fill-opacity='0.97'/%3E%3C/svg%3E")`;

function extractSquareFromDragArgs(...args) {
  for (const arg of args) {
    if (typeof arg === 'string' && /^[a-h][1-8]$/.test(arg)) {
      return arg;
    }

    if (arg && typeof arg === 'object') {
      const candidates = [arg.sourceSquare, arg.square, arg.from, arg.source];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && /^[a-h][1-8]$/.test(candidate)) {
          return candidate;
        }
      }
    }
  }

  return '';
}

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [engineElo, setEngineElo] = useState(1200);
  const [topN, setTopN] = useState(3);
  const [playerColor, setPlayerColor] = useState('w');
  const [activePlayerColor, setActivePlayerColor] = useState('w');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [status, setStatus] = useState('Configure settings, then click Start Game.');
  const [currentTopMoves, setCurrentTopMoves] = useState([]);
  const [lastEvaluatedMoves, setLastEvaluatedMoves] = useState([]);
  const [showLastEvaluated, setShowLastEvaluated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [boardWidth, setBoardWidth] = useState(720);
  const [selectedSquare, setSelectedSquare] = useState('');
  const [dragSourceSquare, setDragSourceSquare] = useState('');
  const [playerMoveMeta, setPlayerMoveMeta] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [errorSquareStyles, setErrorSquareStyles] = useState({});
  const [showValidMoves, setShowValidMoves] = useState(true);
  const [score, setScore] = useState({ earned: 0, possible: 0, errors: 0 });

  const boardWrapRef = useRef(null);
  const boardStatusRef = useRef(null);
  const moveListRef = useRef(null);

  const { ready, error, configure, evaluateTopMoves } = useStockfish();

  useEffect(() => {
    if (!ready) {
      return;
    }
    configure({ engineElo });
    // configure is intentionally omitted to prevent reconfiguration on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, engineElo]);

  useEffect(() => {
    const container = boardWrapRef.current;
    if (!container) {
      return;
    }

    const updateBoardSize = () => {
      const rect = container.getBoundingClientRect();
      const statusHeight = boardStatusRef.current?.getBoundingClientRect().height ?? 0;
      const isPortraitMobile = window.matchMedia('(max-width: 1024px) and (orientation: portrait)').matches;
      const maxFromWidth = Math.max(280, rect.width);

      let maxFromHeight;
      if (isPortraitMobile) {
        const reservedForSections = Math.max(180, Math.floor(window.innerHeight * 0.28));
        maxFromHeight = Math.max(260, window.innerHeight - statusHeight - reservedForSections - 12);
      } else {
        maxFromHeight = Math.max(260, rect.height - 4);
      }

      setBoardWidth(Math.floor(Math.min(maxFromWidth, maxFromHeight)));
    };

    updateBoardSize();
    const observer = new ResizeObserver(updateBoardSize);
    observer.observe(container);
    window.addEventListener('resize', updateBoardSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBoardSize);
    };
  }, []);

  const turnLabel = useMemo(() => (game.turn() === 'w' ? 'White' : 'Black'), [game]);
  const playerTurn = game.turn() === activePlayerColor;
  const engineColor = activePlayerColor === 'w' ? 'b' : 'w';
  const settingsLocked = isGameStarted;
  const resolvedPlayerColor = isGameStarted ? activePlayerColor : (playerColor === 'random' ? null : playerColor);
  const whiteHeaderLabel = resolvedPlayerColor === 'w' ? 'White (You)' : 'White';
  const blackHeaderLabel = resolvedPlayerColor === 'b' ? 'Black (You)' : 'Black';
  const resultMessage = game.isGameOver() ? getGameResultMessage(game) : '';
  const engineThinking = isGameStarted && !game.isGameOver() && game.turn() === engineColor && isProcessing;

  const turnDisplay = useMemo(() => {
    if (!isGameStarted) {
      return 'Not started';
    }
    if (game.isGameOver()) {
      return 'Game over';
    }
    if (playerTurn) {
      return `${turnLabel} to move (You)`;
    }
    return `${turnLabel} to move (Engine)`;
  }, [isGameStarted, game, playerTurn, turnLabel]);
  const scorePercent = useMemo(() => {
    if (!score.possible) {
      return 0;
    }
    return ((Math.max(0, score.earned) / score.possible) * 100).toFixed(1);
  }, [score]);

  const playerMetaByPly = useMemo(() => {
    const map = new Map();
    for (const item of playerMoveMeta) {
      map.set(item.ply, item);
    }
    return map;
  }, [playerMoveMeta]);

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

  useEffect(() => {
    if (!moveListRef.current) {
      return;
    }
    moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [moveRows.length]);

  const selectedSquareStyles = useMemo(() => {
    const styles = { ...errorSquareStyles };
    const sourceSquare = dragSourceSquare || selectedSquare;

    if (showValidMoves && sourceSquare) {
      const validTargets = game.moves({ square: sourceSquare, verbose: true });
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
  }, [selectedSquare, dragSourceSquare, errorSquareStyles, showValidMoves, game]);

  const flashInvalidMoveSquares = (sourceSquare, targetSquare) => {
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

    setTimeout(() => {
      setErrorSquareStyles({
        [sourceSquare]: faded,
        [targetSquare]: faded
      });
    }, 40);

    setTimeout(() => {
      setErrorSquareStyles({});
    }, 1600);
  };

  const resetToSetup = () => {
    setGame(new Chess());
    setIsGameStarted(false);
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
    setActivePlayerColor('w');
  };

  const finishGame = (board, scoreSnapshot = score) => {
    const percent = scoreSnapshot.possible
      ? ((Math.max(0, scoreSnapshot.earned) / scoreSnapshot.possible) * 100).toFixed(1)
      : '0.0';
    setStatus(`Final score: ${Math.max(0, scoreSnapshot.earned)}/${scoreSnapshot.possible} (${percent}%).`);
    setCurrentTopMoves([]);
    setIsProcessing(false);
    setSelectedSquare('');
    setDragSourceSquare('');
  };

  const preloadTopMoves = async (fen, nextTopN) => {
    const { topMoves } = await evaluateTopMoves({ fen, topN: nextTopN });
    setCurrentTopMoves(topMoves);
    return topMoves;
  };

  const applyEngineReply = async (boardAfterHumanMove, lastRankLabel) => {
    const { bestMove } = await evaluateTopMoves({ fen: boardAfterHumanMove.fen(), topN: 1 });
    const liveBoard = new Chess(boardAfterHumanMove.fen());

    if (bestMove && bestMove !== '(none)') {
      const engineMove = liveBoard.move({
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

    if (liveBoard.isGameOver()) {
      finishGame(liveBoard);
      return;
    }

    await preloadTopMoves(liveBoard.fen(), topN);
    setStatus(lastRankLabel);
    setIsProcessing(false);
  };

  const startGame = async () => {
    if (!ready) {
      setStatus('Engine is still loading. Try again in a moment.');
      return;
    }

    const board = new Chess();
    const chosenColor =
      playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : playerColor;
    setGame(board);
    setIsGameStarted(true);
    setActivePlayerColor(chosenColor);
    setCurrentTopMoves([]);
    setLastEvaluatedMoves([]);
    setShowLastEvaluated(false);
    setSelectedSquare('');
    setDragSourceSquare('');
    setPlayerMoveMeta([]);
    setMoveHistory([]);
    setScore({ earned: 0, possible: 0, errors: 0 });
    setErrorSquareStyles({});
    setIsProcessing(true);

    try {
      if (chosenColor === 'b') {
        const { bestMove } = await evaluateTopMoves({ fen: board.fen(), topN: 1 });
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
    } catch (e) {
      setStatus(e.message || 'Engine error while starting game.');
    }

    setIsProcessing(false);
  };

  const tryPlayerMove = (sourceSquare, targetSquare) => {
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

    if (game.isGameOver()) {
      setStatus('Game is over. Start a new game.');
      return false;
    }

    if (!playerTurn) {
      setStatus('It is not your turn.');
      return false;
    }

    if (!currentTopMoves.length) {
      setStatus('Analyzing position...');
      return false;
    }

    const testGame = new Chess(game.fen());
    const movingPiece = testGame.get(sourceSquare);
    let promotion;

    if (
      movingPiece?.type === 'p' &&
      ((movingPiece.color === 'w' && targetSquare.endsWith('8')) ||
        (movingPiece.color === 'b' && targetSquare.endsWith('1')))
    ) {
      promotion = 'q';
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
    const rank = currentTopMoves.indexOf(moveUci) + 1;

    if (!rank) {
      setStatus(`Move rejected. Not in top ${topN}.`);
      setLastEvaluatedMoves(currentTopMoves);
      setShowLastEvaluated(false);
      setSelectedSquare('');
      setDragSourceSquare('');
      flashInvalidMoveSquares(sourceSquare, targetSquare);
      setScore((prev) => ({ ...prev, earned: prev.earned - 1, errors: prev.errors + 1 }));
      return false;
    }

    const earnedPoints = pointsForRank(rank, topN);
    const rankText = rankLabel(rank);
    const ply = moveHistory.length + 1;

    const projectedScore = {
      earned: score.earned + earnedPoints,
      possible: score.possible + topN,
      errors: score.errors
    };

    setScore((prev) => ({
      earned: prev.earned + earnedPoints,
      possible: prev.possible + topN,
      errors: prev.errors
    }));

    setPlayerMoveMeta((prev) => [
      ...prev,
      {
        ply,
        san: humanMove.san,
        rank,
        label: rankText,
        points: earnedPoints
      }
    ]);

    setGame(testGame);
    setMoveHistory((prev) => [...prev, humanMove]);
    setSelectedSquare('');
    setDragSourceSquare('');
    setLastEvaluatedMoves(currentTopMoves);
    setShowLastEvaluated(false);
    setCurrentTopMoves([]);

    if (testGame.isGameOver()) {
      finishGame(testGame, projectedScore);
      return true;
    }

    setIsProcessing(true);
    setStatus(`${rankText}. +${earnedPoints} points.`);

    void applyEngineReply(testGame, `${rankText}. +${earnedPoints} points`);
    return true;
  };

  const onDrop = (sourceSquare, targetSquare) => {
    setDragSourceSquare('');
    return tryPlayerMove(sourceSquare, targetSquare);
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
    if (!isGameStarted || !playerTurn || isProcessing || game.isGameOver()) {
      return;
    }

    const piece = game.get(square);

    if (!selectedSquare) {
      if (piece && piece.color === activePlayerColor) {
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

    if (piece && piece.color === activePlayerColor) {
      setDragSourceSquare('');
      setSelectedSquare(square);
      return;
    }

    const moved = tryPlayerMove(selectedSquare, square);
    if (!moved) {
      setSelectedSquare('');
    }
  };

  return (
    <div className="app">
      <div className="board-status" ref={boardStatusRef}>
        <div className="board-head">
          <div className="board-title">Chess Trainer</div>
        </div>
        <div className="turn-line">
          <strong>Turn:</strong> {turnDisplay}
          {engineThinking ? <span className="spinner" aria-label="Engine thinking" /> : null}
        </div>
        {resultMessage ? (
          <div className="result-line">
            <strong>Result:</strong> {resultMessage}
          </div>
        ) : null}
      </div>

      <main className="board-wrap" ref={boardWrapRef}>
        <Chessboard
          id="trainer-board"
          position={game.fen() || START_FEN}
          onPieceDragBegin={onPieceDragBegin}
          onPieceDragEnd={onPieceDragEnd}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={selectedSquareStyles}
          boardWidth={boardWidth}
          boardOrientation={activePlayerColor === 'w' ? 'white' : 'black'}
          arePiecesDraggable={isGameStarted && !isProcessing && playerTurn && !game.isGameOver()}
        />
      </main>

      <div className="left-column">
        <header className="panel">
          <h2 className="panel-title">Settings</h2>

          <div className="controls">
            <label>
              Engine Elo
              <input
                type="number"
                min={1320}
                max={3190}
                value={engineElo}
                disabled={settingsLocked}
                onChange={(e) => setEngineElo(clamp(Number(e.target.value || 1200), 1320, 3190))}
              />
            </label>

            <label>
              Top N
              <input
                type="number"
                min={1}
                max={10}
                value={topN}
                disabled={settingsLocked}
                onChange={(e) => setTopN(clamp(Number(e.target.value || 3), 1, 10))}
              />
            </label>

            <label>
              Play As
              <select value={playerColor} disabled={settingsLocked} onChange={(e) => setPlayerColor(e.target.value)}>
                <option value="w">White</option>
                <option value="b">Black</option>
                <option value="random">Random</option>
              </select>
            </label>

            <label>
              Show Valid Moves
              <input
                type="checkbox"
                checked={showValidMoves}
                onChange={(e) => setShowValidMoves(e.target.checked)}
              />
            </label>

            {!isGameStarted ? (
              <button onClick={startGame} type="button" disabled={!ready || isProcessing}>Start Game</button>
            ) : (
              <button onClick={resetToSetup} type="button">New Game</button>
            )}
          </div>
        </header>

        <section className="panel">
          <h2 className="panel-title">Score</h2>
          <p><strong>Update:</strong> {status}</p>
          <p><strong>Current:</strong> {score.earned} / {score.possible} ({scorePercent}%)</p>
          <p><strong>Mistakes:</strong> {score.errors}</p>

          {lastEvaluatedMoves.length ? (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowLastEvaluated((prev) => !prev)}
              >
                {showLastEvaluated ? 'Hide Last Evaluation' : 'Reveal Last Evaluation'}
              </button>
              {showLastEvaluated ? (
                <p><strong>Last top choices:</strong> {lastEvaluatedMoves.join(', ')}</p>
              ) : null}
            </>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <h2 className="panel-title">Move List</h2>
          {moveRows.length ? (
            <div className="move-list" ref={moveListRef}>
              <div className="move-row move-head">
                <span className="move-num">#</span>
                <span className={resolvedPlayerColor === 'w' ? 'player-col' : ''}>{whiteHeaderLabel}</span>
                <span className={resolvedPlayerColor === 'b' ? 'player-col' : ''}>{blackHeaderLabel}</span>
              </div>
              {moveRows.map((row) => (
                <div className="move-row" key={row.moveNumber}>
                  <span className="move-num">{row.moveNumber}.</span>
                  <span className={resolvedPlayerColor === 'w' ? 'player-col' : ''}>
                    {row.white ? row.white.san : '-'}
                    {row.whiteMeta ? ` (#${row.whiteMeta.rank})` : ''}
                  </span>
                  <span className={resolvedPlayerColor === 'b' ? 'player-col' : ''}>
                    {row.black ? row.black.san : '-'}
                    {row.blackMeta ? ` (#${row.blackMeta.rank})` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>No moves yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
