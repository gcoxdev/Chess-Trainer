import { describe, expect, test } from 'vitest';
import { Chess } from 'chess.js';
import {
  formatMoveMetaDisplay,
  historyBucketKey,
  moveSanFromFen,
  replayBoardFromMoves
} from './chessCore.js';

describe('chessCore', () => {
  test('formatMoveMetaDisplay formats ranked and miss entries compactly', () => {
    expect(formatMoveMetaDisplay({ rank: 1 })).toBe('#1');
    expect(formatMoveMetaDisplay({ rank: 2, bestMove: 'Nf3' })).toBe('#2 · Nf3');
    expect(formatMoveMetaDisplay({ label: 'Outside Top 3', bestMove: 'Nf3' })).toBe('>3 · Nf3');
    expect(formatMoveMetaDisplay({ openingAllowed: true })).toBe('Open');
  });

  test('historyBucketKey composes stable bucket ids', () => {
    expect(historyBucketKey('5', 'timed')).toBe('5|timed');
    expect(historyBucketKey('random', 'standard')).toBe('random|standard');
  });

  test('replayBoardFromMoves rebuilds position and returns null on illegal sequence', () => {
    const board = new Chess();
    const m1 = board.move('e4');
    const m2 = board.move('e5');
    const rebuilt = replayBoardFromMoves([m1, m2]);
    expect(rebuilt).toBeTruthy();
    expect(rebuilt.fen()).toBe(board.fen());

    const illegal = replayBoardFromMoves([{ from: 'e2', to: 'e4' }, { from: 'e2', to: 'e4' }]);
    expect(illegal).toBeNull();
  });

  test('moveSanFromFen resolves SAN from UCI', () => {
    const board = new Chess();
    const fen = board.fen();
    expect(moveSanFromFen(fen, 'e2e4')).toBe('e4');
    expect(moveSanFromFen(fen, 'xxxx')).toBe('');
  });
});
