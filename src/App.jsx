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

function approximateEloForSkillLevel(level) {
  const minElo = 1320;
  const maxElo = 3190;
  return Math.round(minElo + ((maxElo - minElo) * (level / 20)));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function countPiecesFromFen(board) {
  return (board.fen().split(' ')[0].match(/[prnbqkPRNBQK]/g) || []).length;
}

const SCORE_HISTORY_STORAGE_KEY = 'chess-trainer-score-history-v1';

function loadScoreHistory() {
  try {
    const raw = window.localStorage.getItem(SCORE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return { classicBySkill: {}, randomByPhase: {} };
    }
    const parsed = JSON.parse(raw);
    const classicBySkill = parsed?.classicBySkill && typeof parsed.classicBySkill === 'object'
      ? parsed.classicBySkill
      : {};
    const randomByPhase = parsed?.randomByPhase && typeof parsed.randomByPhase === 'object'
      ? parsed.randomByPhase
      : {};

    // Backward compatibility: older versions stored classic as a flat array.
    if (Array.isArray(parsed?.classic) && parsed.classic.length && !Object.keys(classicBySkill).length) {
      classicBySkill.legacy = parsed.classic;
    }

    // Backward compatibility: older versions stored random history as a flat array.
    if (Array.isArray(parsed?.randomPosition) && parsed.randomPosition.length && !Object.keys(randomByPhase).length) {
      randomByPhase.random = parsed.randomPosition;
    }

    return {
      classicBySkill,
      randomByPhase
    };
  } catch {
    return { classicBySkill: {}, randomByPhase: {} };
  }
}

function formatHistoryTimestamp(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
}

function getPhaseConfig(phase) {
  switch (phase) {
    case 'opening':
      return { plyMin: 4, plyMax: 14, minPieces: 22, maxPieces: 32, captureBias: 0.15 };
    case 'middlegame':
      return { plyMin: 12, plyMax: 44, minPieces: 12, maxPieces: 26, captureBias: 0.5 };
    case 'endgame':
      return { plyMin: 18, plyMax: 140, minPieces: 4, maxPieces: 12, captureBias: 0.9 };
    case 'random':
    default:
      return { plyMin: 8, plyMax: 36, minPieces: 8, maxPieces: 32, captureBias: 0.4 };
  }
}

function pickBiasedRandomMove(board, legalMoves, phaseConfig) {
  const captures = legalMoves.filter((move) => move.captured);
  const promotions = legalMoves.filter((move) => move.promotion);
  const checks = legalMoves.filter((move) => {
    const test = new Chess(board.fen());
    test.move(move);
    return test.inCheck() && !test.isGameOver();
  });

  const roll = Math.random();
  if (captures.length && roll < phaseConfig.captureBias) {
    return captures[randomInt(0, captures.length - 1)];
  }

  if (promotions.length && roll < 0.97) {
    return promotions[randomInt(0, promotions.length - 1)];
  }

  if (checks.length && roll < 0.55) {
    return checks[randomInt(0, checks.length - 1)];
  }

  return legalMoves[randomInt(0, legalMoves.length - 1)];
}

function generateRandomTrainingBoard({ playerColor, minLegalMoves, phase }) {
  const maxAttempts = phase === 'endgame' ? 220 : 140;
  const phaseConfig = getPhaseConfig(phase);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const board = new Chess();
    let failed = false;
    let reachedCandidate = false;

    for (let ply = 0; ply < phaseConfig.plyMax; ply += 1) {
      const legalMoves = board.moves({ verbose: true });
      if (!legalMoves.length) {
        failed = true;
        break;
      }

      const move = pickBiasedRandomMove(board, legalMoves, phaseConfig);
      board.move(move);

      if (board.isGameOver()) {
        failed = true;
        break;
      }

      if (ply + 1 >= phaseConfig.plyMin) {
        const pieceCount = countPiecesFromFen(board);
        if (pieceCount >= phaseConfig.minPieces && pieceCount <= phaseConfig.maxPieces) {
          reachedCandidate = true;
          if (phase !== 'endgame' || pieceCount <= phaseConfig.maxPieces) {
            break;
          }
        }
      }
    }

    if (failed || !reachedCandidate) {
      continue;
    }

    if (board.turn() !== playerColor) {
      const legalMoves = board.moves({ verbose: true });
      if (!legalMoves.length) {
        continue;
      }
      board.move(legalMoves[randomInt(0, legalMoves.length - 1)]);
    }

    if (board.turn() !== playerColor || board.isGameOver()) {
      continue;
    }

    const finalMoves = board.moves();
    if (finalMoves.length < minLegalMoves) {
      continue;
    }

    const pieceCount = countPiecesFromFen(board);
    if (pieceCount < phaseConfig.minPieces || pieceCount > phaseConfig.maxPieces) {
      continue;
    }

    if (phase === 'endgame' && finalMoves.length < Math.max(3, minLegalMoves)) {
      continue;
    }

    return board;
  }

  const fallback = new Chess();
  if (fallback.turn() !== playerColor) {
    const legalMoves = fallback.moves({ verbose: true });
    if (legalMoves.length) {
      fallback.move(legalMoves[randomInt(0, legalMoves.length - 1)]);
    }
  }
  return fallback;
}

function getPromotionChoiceFromBoardPiece(pieceCode) {
  if (!pieceCode || typeof pieceCode !== 'string' || pieceCode.length < 2) {
    return undefined;
  }

  const piece = pieceCode[1]?.toLowerCase();
  return ['q', 'r', 'b', 'n'].includes(piece) ? piece : undefined;
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
const PIECE_TYPE_LABEL = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
const PIECE_SYMBOLS = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟'
};
const BOARD_THEMES = {
  classic: {
    label: 'Classic',
    light: '#F0D9B5',
    dark: '#B58863',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 34, 54, 0.24)' }
  },
  crimson: {
    label: 'Crimson',
    light: '#F7E0E0',
    dark: '#A94452',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(72, 23, 30, 0.24)' }
  },
  amber: {
    label: 'Amber',
    light: '#F7EBC9',
    dark: '#C48A2C',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(88, 58, 16, 0.24)' }
  },
  green: {
    label: 'Green',
    light: '#EEEED2',
    dark: '#769656',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(24, 44, 25, 0.24)' }
  },
  teal: {
    label: 'Teal',
    light: '#DAF1EE',
    dark: '#2C8C82',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 58, 53, 0.24)' }
  },
  blue: {
    label: 'Blue',
    light: '#DEEAF7',
    dark: '#5E81AC',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 38, 74, 0.24)' }
  },
  indigo: {
    label: 'Indigo',
    light: '#E5E8FA',
    dark: '#4F5FA8',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(26, 32, 72, 0.25)' }
  },
  violet: {
    label: 'Violet',
    light: '#EFE6FA',
    dark: '#7C5BA7',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(46, 29, 72, 0.24)' }
  },
  walnut: {
    label: 'Walnut',
    light: '#E8D2B0',
    dark: '#8C5A3C',
    board: { borderRadius: '10px', boxShadow: '0 12px 24px rgba(57, 31, 19, 0.28)' }
  },
  tournament: {
    label: 'Tournament',
    light: '#F4E6C8',
    dark: '#9E6B3F',
    board: { borderRadius: '10px', boxShadow: '0 12px 24px rgba(45, 28, 18, 0.28)' }
  },
  olive: {
    label: 'Olive',
    light: '#EEEED2',
    dark: '#6B8E23',
    board: { borderRadius: '8px', boxShadow: '0 8px 20px rgba(36, 54, 24, 0.22)' }
  },
  slate: {
    label: 'Slate',
    light: '#D9E1EF',
    dark: '#60728D',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(10, 19, 34, 0.28)' }
  },
  gray: {
    label: 'Gray',
    light: '#E7EAF0',
    dark: '#7B8798',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(32, 38, 49, 0.22)' }
  },
  tournament3d: {
    label: 'Tournament 3D',
    light: '#F6E7C8',
    dark: '#B37B4B',
    board: {
      borderRadius: '12px',
      boxShadow: '0 18px 28px rgba(20, 24, 31, 0.36), inset 0 2px 0 rgba(255, 255, 255, 0.38)',
      background: 'linear-gradient(145deg, rgba(255,255,255,0.38), rgba(0,0,0,0.18))'
    }
  }
};

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
  const [engineSkillLevel, setEngineSkillLevel] = useState(5);
  const [topN, setTopN] = useState(3);
  const [gameMode, setGameMode] = useState('classic');
  const [randomFenPhase, setRandomFenPhase] = useState('random');
  const [playerColor, setPlayerColor] = useState('w');
  const [boardStyle, setBoardStyle] = useState('classic');
  const [pieceStyle, setPieceStyle] = useState('default');
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
  const [awaitingNextRandomFen, setAwaitingNextRandomFen] = useState(false);
  const [randomPositionsCompleted, setRandomPositionsCompleted] = useState(0);
  const [currentSessionSaved, setCurrentSessionSaved] = useState(false);
  const [scoreHistory, setScoreHistory] = useState(() => loadScoreHistory());
  const [showScoreHistory, setShowScoreHistory] = useState(false);

  const boardWrapRef = useRef(null);
  const boardAreaRef = useRef(null);
  const boardStatusRef = useRef(null);
  const moveListRef = useRef(null);

  const { ready, error, configure, evaluateTopMoves } = useStockfish();

  useEffect(() => {
    if (!ready) {
      return;
    }
    configure({ skillLevel: engineSkillLevel });
    // configure is intentionally omitted to prevent reconfiguration on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, engineSkillLevel]);

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
  const randomFenMode = gameMode === 'random-fen';
  const settingsLocked = isGameStarted;
  const resolvedPlayerColor = isGameStarted ? activePlayerColor : (playerColor === 'random' ? null : playerColor);
  const whiteHeaderLabel = resolvedPlayerColor === 'w' ? 'White (You)' : 'White';
  const blackHeaderLabel = resolvedPlayerColor === 'b' ? 'Black (You)' : 'Black';
  const resultMessage = game.isGameOver() ? getGameResultMessage(game) : '';
  const engineThinking = isGameStarted && !game.isGameOver() && isProcessing && (randomFenMode || game.turn() === engineColor);

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
    if (randomFenMode) {
      return `${turnLabel} to move`;
    }
    return `${turnLabel} to move (Engine)`;
  }, [isGameStarted, game, playerTurn, turnLabel, randomFenMode]);
  const scorePercent = useMemo(() => {
    if (!score.possible) {
      return 0;
    }
    return ((Math.max(0, score.earned) / score.possible) * 100).toFixed(1);
  }, [score]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCORE_HISTORY_STORAGE_KEY, JSON.stringify(scoreHistory));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, [scoreHistory]);

  const classicHistoryForSelectedSkill = useMemo(
    () => scoreHistory.classicBySkill?.[String(engineSkillLevel)] ?? [],
    [scoreHistory, engineSkillLevel]
  );

  const randomHistoryForSelectedPhase = useMemo(
    () => scoreHistory.randomByPhase?.[String(randomFenPhase)] ?? [],
    [scoreHistory, randomFenPhase]
  );

  const bestClassicScore = useMemo(() => {
    if (!classicHistoryForSelectedSkill.length) {
      return null;
    }
    return [...classicHistoryForSelectedSkill].sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (b.possible !== a.possible) return b.possible - a.possible;
      return b.earned - a.earned;
    })[0];
  }, [classicHistoryForSelectedSkill]);

  const bestRandomSession = useMemo(() => {
    if (!randomHistoryForSelectedPhase.length) {
      return null;
    }
    return [...randomHistoryForSelectedPhase].sort((a, b) => {
      if (b.positions !== a.positions) return b.positions - a.positions;
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (b.possible !== a.possible) return b.possible - a.possible;
      return b.earned - a.earned;
    })[0];
  }, [randomHistoryForSelectedPhase]);

  const activeScoreHistory = useMemo(
    () => (randomFenMode ? randomHistoryForSelectedPhase : classicHistoryForSelectedSkill),
    [randomFenMode, randomHistoryForSelectedPhase, classicHistoryForSelectedSkill]
  );

  useEffect(() => {
    setShowScoreHistory(false);
  }, [gameMode]);

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

  const capturedPieces = useMemo(() => {
    const capturedByWhite = [];
    const capturedByBlack = [];

    for (const move of moveHistory) {
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
  }, [moveHistory]);

  const chessboardTheme = useMemo(() => BOARD_THEMES[boardStyle] || BOARD_THEMES.classic, [boardStyle]);

  const customPieces = useMemo(() => {
    if (pieceStyle === 'default') {
      return undefined;
    }

    if (pieceStyle === 'glyph') {
      const getGlyphPiece = (pieceCode) => ({ squareWidth, isDragging }) => (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: `${squareWidth}px`,
            lineHeight: 0.88,
            color: pieceCode[0] === 'w' ? '#21344f' : '#0f1829',
            textShadow: pieceCode[0] === 'w'
              ? '0 1px 0 rgba(255,255,255,0.7)'
              : '0 1px 0 rgba(255,255,255,0.24)',
            transform: isDragging ? 'translateY(3px) scale(1.03)' : 'translateY(3px)',
            transition: 'transform 120ms ease-out'
          }}
        >
          {PIECE_SYMBOLS[pieceCode]}
        </div>
      );

      return {
        wP: getGlyphPiece('wP'),
        wN: getGlyphPiece('wN'),
        wB: getGlyphPiece('wB'),
        wR: getGlyphPiece('wR'),
        wQ: getGlyphPiece('wQ'),
        wK: getGlyphPiece('wK'),
        bP: getGlyphPiece('bP'),
        bN: getGlyphPiece('bN'),
        bB: getGlyphPiece('bB'),
        bR: getGlyphPiece('bR'),
        bQ: getGlyphPiece('bQ'),
        bK: getGlyphPiece('bK')
      };
    }

    if (pieceStyle === 'sprite26774') {
      const getSpritePiece = (pieceCode) => ({ squareWidth, isDragging }) => {
        const size = `${Math.max(24, squareWidth * 1.04)}px`;
        const isWhite = pieceCode[0] === 'w';
        const src = isWhite
          ? `/pieces/line-art/${pieceCode}.png?v=14`
          : `/pieces/line-art/${pieceCode}.svg?v=14`;

        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                transformOrigin: 'center center',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 120ms ease-out'
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  display: 'block'
                }}
              />
            </div>
          </div>
        );
      };

      return {
        wP: getSpritePiece('wP'),
        wN: getSpritePiece('wN'),
        wB: getSpritePiece('wB'),
        wR: getSpritePiece('wR'),
        wQ: getSpritePiece('wQ'),
        wK: getSpritePiece('wK'),
        bP: getSpritePiece('bP'),
        bN: getSpritePiece('bN'),
        bB: getSpritePiece('bB'),
        bR: getSpritePiece('bR'),
        bQ: getSpritePiece('bQ'),
        bK: getSpritePiece('bK')
      };
    }

    if (pieceStyle === 'spriteChessPieces') {
      const getSpritePiece = (pieceCode) => ({ squareWidth, isDragging }) => {
        const size = `${Math.max(24, squareWidth * 1.02)}px`;
        const src = `/pieces/illustrated/${pieceCode}.png?v=4`;

        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                transformOrigin: 'center center',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 120ms ease-out'
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  display: 'block'
                }}
              />
            </div>
          </div>
        );
      };

      return {
        wP: getSpritePiece('wP'),
        wN: getSpritePiece('wN'),
        wB: getSpritePiece('wB'),
        wR: getSpritePiece('wR'),
        wQ: getSpritePiece('wQ'),
        wK: getSpritePiece('wK'),
        bP: getSpritePiece('bP'),
        bN: getSpritePiece('bN'),
        bB: getSpritePiece('bB'),
        bR: getSpritePiece('bR'),
        bQ: getSpritePiece('bQ'),
        bK: getSpritePiece('bK')
      };
    }

    if (pieceStyle === 'sprite3413429') {
      const getSpritePiece = (pieceCode) => ({ squareWidth, isDragging }) => {
        const isPawn = pieceCode[1] === 'P';
        const sizeFactor = isPawn ? 0.88 : 1.02;
        const size = `${Math.max(24, squareWidth * sizeFactor)}px`;
        const isWhite = pieceCode[0] === 'w';
        const src = isWhite
          ? `/pieces/regal/${pieceCode}.png?v=2`
          : `/pieces/regal/${pieceCode}.svg?v=2`;

        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                transformOrigin: 'center center',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 120ms ease-out'
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  display: 'block'
                }}
              />
            </div>
          </div>
        );
      };

      return {
        wP: getSpritePiece('wP'),
        wN: getSpritePiece('wN'),
        wB: getSpritePiece('wB'),
        wR: getSpritePiece('wR'),
        wQ: getSpritePiece('wQ'),
        wK: getSpritePiece('wK'),
        bP: getSpritePiece('bP'),
        bN: getSpritePiece('bN'),
        bB: getSpritePiece('bB'),
        bR: getSpritePiece('bR'),
        bQ: getSpritePiece('bQ'),
        bK: getSpritePiece('bK')
      };
    }

    if (pieceStyle === 'spriteChrisdesign') {
      const getSpritePiece = (pieceCode) => ({ squareWidth, isDragging }) => {
        const isPawn = pieceCode[1] === 'P';
        const sizeFactor = isPawn ? 0.9 : 1.04;
        const size = `${Math.max(24, squareWidth * sizeFactor)}px`;
        const src = `/pieces/modern/${pieceCode}.png?v=4`;

        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                transformOrigin: 'center center',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 120ms ease-out'
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  display: 'block'
                }}
              />
            </div>
          </div>
        );
      };

      return {
        wP: getSpritePiece('wP'),
        wN: getSpritePiece('wN'),
        wB: getSpritePiece('wB'),
        wR: getSpritePiece('wR'),
        wQ: getSpritePiece('wQ'),
        wK: getSpritePiece('wK'),
        bP: getSpritePiece('bP'),
        bN: getSpritePiece('bN'),
        bB: getSpritePiece('bB'),
        bR: getSpritePiece('bR'),
        bQ: getSpritePiece('bQ'),
        bK: getSpritePiece('bK')
      };
    }

    if (pieceStyle === 'spriteRetro') {
      const getSpritePiece = (pieceCode) => ({ squareWidth, isDragging }) => {
        const pieceType = pieceCode[1];
        const scaleFactor =
          pieceType === 'P' ? 0.84
            : (pieceType === 'R' || pieceType === 'N') ? 0.92
              : 1.02;
        const size = `${Math.max(24, squareWidth * scaleFactor)}px`;
        const src = `/pieces/retro/${pieceCode}.png?v=1`;

        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                transformOrigin: 'center center',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 120ms ease-out'
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  display: 'block',
                  imageRendering: 'pixelated'
                }}
              />
            </div>
          </div>
        );
      };

      return {
        wP: getSpritePiece('wP'),
        wN: getSpritePiece('wN'),
        wB: getSpritePiece('wB'),
        wR: getSpritePiece('wR'),
        wQ: getSpritePiece('wQ'),
        wK: getSpritePiece('wK'),
        bP: getSpritePiece('bP'),
        bN: getSpritePiece('bN'),
        bB: getSpritePiece('bB'),
        bR: getSpritePiece('bR'),
        bQ: getSpritePiece('bQ'),
        bK: getSpritePiece('bK')
      };
    }

    const labels = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K' };
    const fontSizeFactor = pieceStyle === 'glass' ? 0.44 : 0.42;
    const borderRadius = pieceStyle === 'glass' ? '28%' : '22%';
    const whiteBackground = pieceStyle === 'glass'
      ? 'linear-gradient(140deg, #ffffff 12%, #eef4ff 52%, #d6e1f6 100%)'
      : 'linear-gradient(140deg, #fffdf7 10%, #efe7d7 55%, #d7c7ad 100%)';
    const blackBackground = pieceStyle === 'glass'
      ? 'linear-gradient(140deg, #5a6b89 10%, #27344f 55%, #161f32 100%)'
      : 'linear-gradient(140deg, #5e5450 8%, #2f2a29 58%, #1a1717 100%)';

    const getPiece = (color, piece) => ({ squareWidth, isDragging }) => (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: `${Math.max(18, squareWidth * 0.74)}px`,
            height: `${Math.max(18, squareWidth * 0.74)}px`,
            borderRadius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: color === 'w' ? '#1f2d44' : '#ecf2ff',
            background: color === 'w' ? whiteBackground : blackBackground,
            border: color === 'w' ? '1px solid rgba(21, 36, 57, 0.22)' : '1px solid rgba(235, 241, 255, 0.15)',
            boxShadow: isDragging
              ? '0 8px 16px rgba(0, 0, 0, 0.32)'
              : '0 2px 7px rgba(7, 15, 27, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            transform: isDragging ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 120ms ease-out'
          }}
        >
          <span
            style={{
              display: 'block',
              fontWeight: 800,
              fontSize: `${Math.max(10, squareWidth * fontSizeFactor)}px`,
              lineHeight: 1,
              transform: 'translateY(0.08em)'
            }}
          >
            {labels[piece]}
          </span>
        </div>
      </div>
    );

    return {
      wP: getPiece('w', 'P'),
      wN: getPiece('w', 'N'),
      wB: getPiece('w', 'B'),
      wR: getPiece('w', 'R'),
      wQ: getPiece('w', 'Q'),
      wK: getPiece('w', 'K'),
      bP: getPiece('b', 'P'),
      bN: getPiece('b', 'N'),
      bB: getPiece('b', 'B'),
      bR: getPiece('b', 'R'),
      bQ: getPiece('b', 'Q'),
      bK: getPiece('b', 'K')
    };
  }, [pieceStyle]);

  const renderCapturedPiece = (pieceCode, key) => {
    return (
      <span
        className={`capture-piece-glyph ${pieceCode[0] === 'w' ? 'capture-piece-glyph-white-text' : 'capture-piece-glyph-black-text'}`}
        key={key}
        title={pieceCode}
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
    if (isGameStarted && randomFenMode && !currentSessionSaved && (score.possible > 0 || randomPositionsCompleted > 0)) {
      const percent = score.possible ? (Math.max(0, score.earned) / score.possible) * 100 : 0;
      setScoreHistory((prev) => ({
        ...prev,
        randomByPhase: {
          ...(prev.randomByPhase || {}),
          [String(randomFenPhase)]: [
            {
              earned: score.earned,
              possible: score.possible,
              percent,
              positions: randomPositionsCompleted,
              timestamp: Date.now(),
              phase: randomFenPhase
            },
            ...((prev.randomByPhase?.[String(randomFenPhase)] ?? []))
          ].slice(0, 100)
        }
      }));
    }

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
    setAwaitingNextRandomFen(false);
    setRandomPositionsCompleted(0);
    setCurrentSessionSaved(false);
  };

  const finishGame = (board, scoreSnapshot = score) => {
    const percentValue = scoreSnapshot.possible
      ? (Math.max(0, scoreSnapshot.earned) / scoreSnapshot.possible) * 100
      : 0;
    const percent = percentValue.toFixed(1);
    setStatus(`Final score: ${Math.max(0, scoreSnapshot.earned)}/${scoreSnapshot.possible} (${percent}%).`);
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
          [String(engineSkillLevel)]: [
            {
              earned: scoreSnapshot.earned,
              possible: scoreSnapshot.possible,
              percent: percentValue,
              timestamp: Date.now(),
              skillLevel: engineSkillLevel
            },
            ...((prev.classicBySkill?.[String(engineSkillLevel)] ?? []))
          ].slice(0, 100)
        }
      }));
      setCurrentSessionSaved(true);
    }
  };

  const preloadTopMoves = async (fen, nextTopN) => {
    const { topMoves } = await evaluateTopMoves({ fen, topN: nextTopN });
    setCurrentTopMoves(topMoves);
    return topMoves;
  };

  const loadRandomFenPosition = async (playerSide, statusMessage) => {
    const board = generateRandomTrainingBoard({
      playerColor: playerSide,
      minLegalMoves: Math.max(1, topN),
      phase: randomFenPhase
    });
    const seedHistory = board.history({ verbose: true });

    setGame(new Chess(board.fen()));
    setSelectedSquare('');
    setDragSourceSquare('');
    setErrorSquareStyles({});
    setMoveHistory(seedHistory);
    setPlayerMoveMeta([]);
    setCurrentTopMoves([]);
    setAwaitingNextRandomFen(false);

    await preloadTopMoves(board.fen(), topN);
    setStatus(statusMessage || 'Random position loaded.');
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

    const chosenColor =
      playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : playerColor;
    const board = new Chess();
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
    setRandomPositionsCompleted(0);
    setCurrentSessionSaved(false);

    try {
          if (randomFenMode) {
        await loadRandomFenPosition(
          chosenColor,
          `Random mode started as ${chosenColor === 'w' ? 'White' : 'Black'}.`
        );
        setIsProcessing(false);
        return;
      }

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

    if (randomFenMode && awaitingNextRandomFen) {
      setStatus('Click Next Position to continue.');
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
    let promotion = forcedPromotion;

    if (
      movingPiece?.type === 'p' &&
      ((movingPiece.color === 'w' && targetSquare.endsWith('8')) ||
        (movingPiece.color === 'b' && targetSquare.endsWith('1')))
    ) {
      promotion = forcedPromotion;
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

    if (!randomFenMode && testGame.isGameOver()) {
      finishGame(testGame, projectedScore);
      return true;
    }

    setIsProcessing(true);
    setStatus(`${rankText}. +${earnedPoints} points.`);

    if (randomFenMode) {
      setRandomPositionsCompleted((prev) => prev + 1);
      setAwaitingNextRandomFen(true);
      setIsProcessing(false);
      setStatus(`${rankText}. +${earnedPoints} points. Click Next Position.`);
      return true;
    }

    void applyEngineReply(testGame, `${rankText}. +${earnedPoints} points`);
    return true;
  };

  const onDrop = (sourceSquare, targetSquare, piece) => {
    setDragSourceSquare('');
    return tryPlayerMove(sourceSquare, targetSquare, getPromotionChoiceFromBoardPiece(piece));
  };

  const onPromotionPieceSelect = (piece) => {
    return !!piece;
  };

  const clearActiveScoreHistory = () => {
    const confirmMessage = randomFenMode
      ? 'Clear all Random Position score history and top score?'
      : `Clear Classic score history and top score for Skill Level ${engineSkillLevel}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setScoreHistory((prev) => {
      if (randomFenMode) {
        const nextRandomByPhase = { ...(prev.randomByPhase || {}) };
        delete nextRandomByPhase[String(randomFenPhase)];
        return { ...prev, randomByPhase: nextRandomByPhase };
      }

      const nextClassicBySkill = { ...(prev.classicBySkill || {}) };
      delete nextClassicBySkill[String(engineSkillLevel)];
      return { ...prev, classicBySkill: nextClassicBySkill };
    });
    setShowScoreHistory(false);
    setStatus(randomFenMode ? 'Random score history cleared.' : `Classic history cleared for skill level ${engineSkillLevel}.`);
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
    if (randomFenMode && awaitingNextRandomFen) {
      setStatus('Click Next Position to continue.');
      return;
    }

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

    const selectedPiece = game.get(selectedSquare);
    if (
      selectedPiece?.type === 'p' &&
      ((selectedPiece.color === 'w' && square.endsWith('8')) ||
        (selectedPiece.color === 'b' && square.endsWith('1')))
    ) {
      setStatus('Use drag/drop for pawn promotion to choose a piece.');
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
        <div className="board-area" ref={boardAreaRef}>
          <Chessboard
            id="trainer-board"
            position={game.fen() || START_FEN}
            onPieceDragBegin={onPieceDragBegin}
            onPieceDragEnd={onPieceDragEnd}
            onPieceDrop={onDrop}
            onPromotionPieceSelect={onPromotionPieceSelect}
            onSquareClick={onSquareClick}
            customSquareStyles={selectedSquareStyles}
            customLightSquareStyle={{ backgroundColor: chessboardTheme.light }}
            customDarkSquareStyle={{ backgroundColor: chessboardTheme.dark }}
            customBoardStyle={chessboardTheme.board}
            customDropSquareStyle={{ boxShadow: 'inset 0 0 0 6px rgba(255, 255, 255, 0.78)' }}
            customPieces={customPieces}
            boardWidth={boardWidth}
            boardOrientation={activePlayerColor === 'w' ? 'white' : 'black'}
            arePiecesDraggable={isGameStarted && !isProcessing && playerTurn && !game.isGameOver()}
          />
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
        <header className="panel">
          <h2 className="panel-title">Settings</h2>

          <div className="controls">
            <label>
              Game Mode
              <select value={gameMode} disabled={settingsLocked} onChange={(e) => setGameMode(e.target.value)}>
                <option value="classic">Classic</option>
                <option value="random-fen">Random Position</option>
              </select>
            </label>

            {randomFenMode ? (
              <label>
                Position Phase
                <select
                  value={randomFenPhase}
                  disabled={settingsLocked}
                  onChange={(e) => setRandomFenPhase(e.target.value)}
                >
                  <option value="random">Random</option>
                  <option value="opening">Opening</option>
                  <option value="middlegame">Middlegame</option>
                  <option value="endgame">Endgame</option>
                </select>
              </label>
            ) : (
              <label>
                Skill Level
                <select
                  value={engineSkillLevel}
                  disabled={settingsLocked}
                  onChange={(e) => setEngineSkillLevel(clamp(Number(e.target.value || 5), 0, 20))}
                >
                  {Array.from({ length: 21 }, (_, i) => (
                    <option key={i} value={i}>
                      {`Level ${i} (~${approximateEloForSkillLevel(i)} Elo)`}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
              Board Style
              <select value={boardStyle} onChange={(e) => setBoardStyle(e.target.value)}>
                {Object.entries(BOARD_THEMES).map(([value, theme]) => (
                  <option value={value} key={value}>{theme.label}</option>
                ))}
              </select>
            </label>

            <label>
              Piece Style
              <select value={pieceStyle} onChange={(e) => setPieceStyle(e.target.value)}>
                <option value="default">Default</option>
                <option value="glyph">Glyph</option>
                <option value="sprite26774">Line Art</option>
                <option value="spriteChessPieces">Illustrated</option>
                <option value="sprite3413429">Regal</option>
                <option value="spriteChrisdesign">Modern</option>
                <option value="spriteRetro">Retro</option>
                <option value="alpha">Alpha</option>
                <option value="glass">Glass</option>
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
              <button className="success-button" onClick={startGame} type="button" disabled={!ready || isProcessing}>
                Start Game
              </button>
            ) : (
              <button className="danger-button" onClick={resetToSetup} type="button">End Game</button>
            )}
          </div>
        </header>

        <section className="panel">
          <h2 className="panel-title">Score</h2>
          <p><strong>Update:</strong> {status}</p>
          <p><strong>Current:</strong> {score.earned} / {score.possible} ({scorePercent}%)</p>
          <p><strong>Mistakes:</strong> {score.errors}</p>
          {randomFenMode ? <p><strong>Positions:</strong> {randomPositionsCompleted}</p> : null}
          {!randomFenMode ? (
            bestClassicScore ? (
              <p>
                <strong>Best Classic:</strong>{' '}
                {Math.max(0, bestClassicScore.earned)} / {bestClassicScore.possible} ({bestClassicScore.percent.toFixed(1)}%)
              </p>
            ) : (
              <p><strong>Best Classic:</strong> -</p>
            )
          ) : (
            bestRandomSession ? (
              <p>
                <strong>Best Random:</strong>{' '}
                {bestRandomSession.positions} positions, {Math.max(0, bestRandomSession.earned)} / {bestRandomSession.possible} ({bestRandomSession.percent.toFixed(1)}%)
                {` [${randomFenPhase === 'random' ? 'Random' : randomFenPhase}]`}
              </p>
            ) : (
              <p><strong>Best Random:</strong> -</p>
            )
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => setShowScoreHistory((prev) => !prev)}
          >
            {showScoreHistory ? 'Hide Score History' : 'Show Score History'}
          </button>
          {showScoreHistory ? (
            activeScoreHistory.length ? (
              <div className="history-list">
                <div className="history-list-head">
                  <span className="history-list-title">
                    {randomFenMode
                      ? `Random History (${randomFenPhase === 'random' ? 'Random' : randomFenPhase})`
                      : `Classic History (Level ${engineSkillLevel})`}
                  </span>
                  <button
                    type="button"
                    className="history-clear-button"
                    onClick={clearActiveScoreHistory}
                    title={randomFenMode ? 'Clear Random History' : `Clear Classic History (Level ${engineSkillLevel})`}
                    aria-label={randomFenMode
                      ? `Clear Random History for ${randomFenPhase === 'random' ? 'Random' : randomFenPhase} phase`
                      : `Clear Classic History for Skill Level ${engineSkillLevel}`}
                  >
                    🗑
                  </button>
                </div>
                {activeScoreHistory.slice(0, 20).map((entry, index) => (
                  <div className="history-row" key={`${entry.timestamp}-${index}`}>
                    <span className="history-rank">#{index + 1}</span>
                    <span className="history-main">
                      {randomFenMode
                        ? `${entry.positions} pos, ${Math.max(0, entry.earned)}/${entry.possible} (${entry.percent.toFixed(1)}%)`
                        : `${Math.max(0, entry.earned)}/${entry.possible} (${entry.percent.toFixed(1)}%)`}
                    </span>
                    <span className="history-time">{formatHistoryTimestamp(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-list">
                <div className="history-list-head">
                  <span className="history-list-title">
                    {randomFenMode
                      ? `Random History (${randomFenPhase === 'random' ? 'Random' : randomFenPhase})`
                      : `Classic History (Level ${engineSkillLevel})`}
                  </span>
                </div>
                <p className="note">No score history yet.</p>
              </div>
            )
          ) : null}

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
