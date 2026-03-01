import { Chess } from 'chess.js';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function toMoveString(move) {
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

export function rankLabel(rank) {
  return rank === 1 ? 'Top Move Played' : `${ordinal(rank)} Best Move Played`;
}

export function pointsForRank(rank, topN) {
  return (Math.max(1, topN - rank + 1)) / Math.max(1, topN);
}

export function penaltyForMiss(topN) {
  return 1 / Math.max(1, topN);
}

export function formatScoreValue(value) {
  const n = Number(value || 0);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function formatElapsedSeconds(ms) {
  return `${Math.max(0, Math.round((ms || 0) / 1000))}s`;
}

export function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function getTimeScoreFactor(elapsedMs) {
  const elapsedSeconds = Math.max(0, (elapsedMs || 0) / 1000);
  const graceSeconds = 3;
  if (elapsedSeconds <= graceSeconds) {
    return 1;
  }

  const decaySeconds = elapsedSeconds - graceSeconds;
  const factor = Math.pow(0.5, decaySeconds / 20);
  return clamp(factor, 0.25, 1);
}

export function historyBucketKey(baseKey, scoreMode) {
  return `${baseKey}|${scoreMode}`;
}

export function formatTimedPointsSuffix({ useTimeScoring, elapsedMs, timeFactor }) {
  if (!useTimeScoring) {
    return '';
  }
  return ` (time x${formatScoreValue(timeFactor)}, ${formatElapsedSeconds(elapsedMs)})`;
}

export function approximateEloForSkillLevel(level) {
  const minElo = 1320;
  const maxElo = 3190;
  return Math.round(minElo + ((maxElo - minElo) * (level / 20)));
}

export function formatPuzzleThemeLabel(theme) {
  if (!theme) return '';
  return String(theme)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function yieldToMainThread() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function countPiecesFromFen(board) {
  return (board.fen().split(' ')[0].match(/[prnbqkPRNBQK]/g) || []).length;
}

export const START_FEN = new Chess().fen();
export const DRAG_START_SLOP_PX = 20;
export const PUZZLE_REPLY_DELAY_MS = 220;
export const VALID_MOVE_DOT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' shape-rendering='geometricPrecision'%3E%3Ccircle cx='50' cy='50' r='22' fill='%23228B22' fill-opacity='0.97'/%3E%3C/svg%3E")`;
export const PIECE_TYPE_LABEL = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

export function replayBoardFromMoves(moves, startingFen = START_FEN) {
  const board = new Chess(startingFen);
  for (const move of moves || []) {
    try {
      const applied = board.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion
      });
      if (!applied) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return board;
}

export function bestMoveSanFromHistory(historyMoves, bestMoveUci) {
  if (!bestMoveUci) {
    return '';
  }

  const board = replayBoardFromMoves(historyMoves);
  if (!board) {
    return bestMoveUci;
  }

  const parsed = {
    from: bestMoveUci.slice(0, 2),
    to: bestMoveUci.slice(2, 4),
    promotion: bestMoveUci[4]
  };
  try {
    const applied = board.move(parsed);
    return applied?.san || bestMoveUci;
  } catch {
    return bestMoveUci;
  }
}

export function moveSanFromFen(fen, moveUci) {
  if (!moveUci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveUci)) {
    return '';
  }

  try {
    const board = new Chess(fen);
    const applied = board.move({
      from: moveUci.slice(0, 2),
      to: moveUci.slice(2, 4),
      promotion: moveUci[4]
    });
    return applied?.san || moveUci;
  } catch {
    return moveUci;
  }
}

export function formatMoveMetaDisplay(meta) {
  if (!meta) {
    return '';
  }
  if (meta.rank === 1) {
    return '#1';
  }
  if (meta.rank && meta.rank > 1) {
    return meta.bestMove ? `#${meta.rank} · ${meta.bestMove}` : `#${meta.rank}`;
  }
  if (meta.openingAllowed) {
    return 'Open';
  }
  const label = String(meta.label || '').trim();
  const outsideTopMatch = label.match(/^Outside Top\s+(\d+)$/i);
  if (outsideTopMatch) {
    const topN = outsideTopMatch[1];
    return meta.bestMove ? `>${topN} · ${meta.bestMove}` : `>${topN}`;
  }
  if (label) {
    return label;
  }
  return '';
}

export const SCORE_HISTORY_STORAGE_KEY = 'chess-trainer-score-history-v1';

export function loadScoreHistory() {
  try {
    const raw = window.localStorage.getItem(SCORE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return { classicBySkill: {}, randomByPhase: {}, puzzleByTheme: {} };
    }
    const parsed = JSON.parse(raw);
    const classicBySkill = parsed?.classicBySkill && typeof parsed.classicBySkill === 'object'
      ? parsed.classicBySkill
      : {};
    const randomByPhase = parsed?.randomByPhase && typeof parsed.randomByPhase === 'object'
      ? parsed.randomByPhase
      : {};
    const puzzleByTheme = parsed?.puzzleByTheme && typeof parsed.puzzleByTheme === 'object'
      ? parsed.puzzleByTheme
      : {};

    if (Array.isArray(parsed?.classic) && parsed.classic.length && !Object.keys(classicBySkill).length) {
      classicBySkill['5'] = parsed.classic;
    }

    if (Array.isArray(parsed?.randomPosition) && parsed.randomPosition.length && !Object.keys(randomByPhase).length) {
      randomByPhase.random = parsed.randomPosition;
    }

    return {
      classicBySkill,
      randomByPhase,
      puzzleByTheme
    };
  } catch {
    return { classicBySkill: {}, randomByPhase: {}, puzzleByTheme: {} };
  }
}

export function formatHistoryTimestamp(timestamp) {
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

export async function generateRandomTrainingBoard({ playerColor, minLegalMoves, phase }) {
  const maxAttempts = phase === 'endgame' ? 220 : 140;
  const phaseConfig = getPhaseConfig(phase);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0 && attempt % 12 === 0) {
      await yieldToMainThread();
    }

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

export function getGameResultMessage(board) {
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

export function extractSquareFromDragArgs(...args) {
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

export function normalizeArrowTuples(arrows) {
  const source = Array.isArray(arrows) ? arrows : [];
  return source
    .map((arrow) => {
      if (Array.isArray(arrow)) {
        const [from, to, color] = arrow;
        if (typeof from === 'string' && typeof to === 'string') {
          return [from, to, color || 'rgb(64, 132, 255)'];
        }
        return null;
      }

      if (arrow && typeof arrow === 'object') {
        const from = arrow.startSquare;
        const to = arrow.endSquare;
        const color = arrow.color;
        if (typeof from === 'string' && typeof to === 'string') {
          return [from, to, color || 'rgb(64, 132, 255)'];
        }
      }

      return null;
    })
    .filter(Boolean);
}
