import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  formatMoveMetaDisplay,
  historyBucketKey,
  moveSanFromFen,
  replayBoardFromMoves
} from './chessCore.js';

test('formatMoveMetaDisplay formats ranked and miss entries compactly', () => {
  assert.equal(formatMoveMetaDisplay({ rank: 1 }), '#1');
  assert.equal(formatMoveMetaDisplay({ rank: 2, bestMove: 'Nf3' }), '#2 · Nf3');
  assert.equal(formatMoveMetaDisplay({ label: 'Outside Top 3', bestMove: 'Nf3' }), '>3 · Nf3');
  assert.equal(formatMoveMetaDisplay({ openingAllowed: true }), 'Open');
});

test('historyBucketKey composes stable bucket ids', () => {
  assert.equal(historyBucketKey('5', 'timed'), '5|timed');
  assert.equal(historyBucketKey('random', 'standard'), 'random|standard');
});

test('replayBoardFromMoves rebuilds position and returns null on illegal sequence', () => {
  const board = new Chess();
  const m1 = board.move('e4');
  const m2 = board.move('e5');
  const rebuilt = replayBoardFromMoves([m1, m2]);
  assert.ok(rebuilt);
  assert.equal(rebuilt.fen(), board.fen());

  const illegal = replayBoardFromMoves([{ from: 'e2', to: 'e4' }, { from: 'e2', to: 'e4' }]);
  assert.equal(illegal, null);
});

test('moveSanFromFen resolves SAN from UCI', () => {
  const board = new Chess();
  const fen = board.fen();
  assert.equal(moveSanFromFen(fen, 'e2e4'), 'e4');
  assert.equal(moveSanFromFen(fen, 'xxxx'), '');
});
