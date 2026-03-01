import { describe, expect, test } from 'vitest';
import {
  adaptArrowsPayload,
  adaptDropPayload,
  adaptPieceDragPayload,
  adaptSquarePayload
} from './chessboardEventAdapters';

describe('chessboard event adapters', () => {
  test('adapts drop payload from object and positional args', () => {
    expect(adaptDropPayload({ sourceSquare: 'e2', targetSquare: 'e4' })).toEqual({
      sourceSquare: 'e2',
      targetSquare: 'e4'
    });
    expect(adaptDropPayload('d2', 'd4')).toEqual({
      sourceSquare: 'd2',
      targetSquare: 'd4'
    });
  });

  test('adapts square payloads from object or string', () => {
    expect(adaptSquarePayload({ square: 'a1' })).toBe('a1');
    expect(adaptSquarePayload('h8')).toBe('h8');
    expect(adaptPieceDragPayload({ from: 'b1' })).toBe('b1');
  });

  test('adapts arrows payload from object shape', () => {
    expect(adaptArrowsPayload({
      arrows: [{ startSquare: 'a2', endSquare: 'a4', color: 'red' }]
    })).toEqual([
      ['a2', 'a4', 'red']
    ]);
  });
});

