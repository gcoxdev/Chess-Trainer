import { Chess } from 'chess.js';
import openingsA from './lichess-openings/a.tsv?raw';
import openingsB from './lichess-openings/b.tsv?raw';
import openingsC from './lichess-openings/c.tsv?raw';
import openingsD from './lichess-openings/d.tsv?raw';
import openingsE from './lichess-openings/e.tsv?raw';

const LICHESS_OPENINGS_TSV = [openingsA, openingsB, openingsC, openingsD, openingsE].join('\n');

function toUci(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function normalizeSanToken(token) {
  if (!token) return '';
  if (/^\d+\.{1,3}$/.test(token)) return '';
  if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) return '';

  let t = token.trim();
  t = t.replace(/[!?]+$/g, '');
  t = t.replace(/^\.\.\./, '');
  t = t.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
  return t;
}

function parsePgnMovesToUci(pgn) {
  const board = new Chess();
  const uciMoves = [];
  const tokens = String(pgn || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map(normalizeSanToken)
    .filter(Boolean);

  for (const san of tokens) {
    let move = null;
    try {
      move = board.move(san);
    } catch {
      move = null;
    }

    if (!move) {
      return null;
    }

    uciMoves.push(toUci(move));
  }

  return uciMoves.length ? uciMoves : null;
}

function parseLichessTsv(tsvText) {
  const lines = tsvText.split(/\r?\n/).filter(Boolean);
  const entries = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const firstTab = line.indexOf('\t');
    const secondTab = line.indexOf('\t', firstTab + 1);
    if (firstTab <= 0 || secondTab <= firstTab) {
      continue;
    }

    const eco = line.slice(0, firstTab).trim();
    const name = line.slice(firstTab + 1, secondTab).trim();
    const pgn = line.slice(secondTab + 1).trim();
    if (!eco || !name || !pgn) {
      continue;
    }

    const uciMoves = parsePgnMovesToUci(pgn);
    if (!uciMoves) {
      continue;
    }

    entries.push({ eco, name, pgn, uciMoves, ply: uciMoves.length });
  }

  return entries;
}

function buildOpeningPrefixIndex() {
  const entries = parseLichessTsv(LICHESS_OPENINGS_TSV);
  const prefixMap = new Map();
  let maxPly = 0;

  for (const entry of entries) {
    maxPly = Math.max(maxPly, entry.ply);
    for (let i = 1; i <= entry.uciMoves.length; i += 1) {
      const key = entry.uciMoves.slice(0, i).join(' ');
      const list = prefixMap.get(key);
      const payload = { eco: entry.eco, name: entry.name, ply: entry.ply };
      if (list) {
        list.push(payload);
      } else {
        prefixMap.set(key, [payload]);
      }
    }
  }

  return { entries, prefixMap, maxPly };
}

const { entries: LICHESS_OPENING_ENTRIES, prefixMap: OPENING_PREFIX_MAP, maxPly: COMMON_OPENING_MAX_PLY } = buildOpeningPrefixIndex();

function chooseOpeningLabel(matches, currentPly) {
  if (!matches?.length) {
    return null;
  }

  const exact = matches.find((m) => m.ply === currentPly);
  const chosen = exact || matches[0];
  if (!chosen) {
    return null;
  }

  return matches.length > 1
    ? `${chosen.name} (${chosen.eco})`
    : `${chosen.name} (${chosen.eco})`;
}

export function findMatchingCommonOpening(lineUciMoves) {
  if (!Array.isArray(lineUciMoves) || !lineUciMoves.length || lineUciMoves.length > COMMON_OPENING_MAX_PLY) {
    return null;
  }

  const matches = OPENING_PREFIX_MAP.get(lineUciMoves.join(' '));
  if (!matches?.length) {
    return null;
  }

  return {
    matches,
    label: chooseOpeningLabel(matches, lineUciMoves.length)
  };
}

export function findCurrentOpening(lineUciMoves) {
  return findMatchingCommonOpening(lineUciMoves);
}

export { COMMON_OPENING_MAX_PLY, LICHESS_OPENING_ENTRIES };
