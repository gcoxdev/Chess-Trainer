import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';

const evaluateTopMovesMock = vi.fn(async ({ topN }) => ({
  topMoves: ['d2d4', 'g1f3', 'c2c4'].slice(0, topN)
}));

vi.mock('react-chessboard', () => {
  function ChessboardMock({ options }) {
    return (
      <div data-testid="mock-board">
        <button type="button" onClick={() => options.onPieceDrop?.({ sourceSquare: 'e2', targetSquare: 'e4' })}>
          drop-e2e4
        </button>
        <button type="button" onClick={() => options.onPieceDrop?.({ sourceSquare: 'e7', targetSquare: 'e5' })}>
          drop-e7e5
        </button>
        <div data-testid="can-drag">{String(options.canDragPiece?.())}</div>
      </div>
    );
  }

  return {
    Chessboard: ChessboardMock,
    defaultPieces: {}
  };
});

vi.mock('./hooks/useStockfish', () => ({
  useStockfish: () => ({
    ready: true,
    error: '',
    configure: vi.fn(),
    beginNewGame: vi.fn(),
    evaluateTopMoves: evaluateTopMovesMock,
    chooseMoveFast: vi.fn(async () => 'e2e4')
  })
}));

describe('App integration flows', () => {
  beforeEach(() => {
    evaluateTopMovesMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test('freeplay shows compact outside-top rank with best-move hint', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'freeplay' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Freeplay started/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e4' }));

    await waitFor(() => {
      expect(screen.getByText('>3 · d4')).toBeInTheDocument();
    });
  });

  test('history review mode locks moves until latest and supports global keyboard navigation', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'freeplay' }
    });
    fireEvent.click(screen.getByLabelText(/Analyze Moves/i));

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Freeplay started/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e4' }));

    await waitFor(() => {
      expect(screen.getByText(/Viewing ply 1\/1/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText(/Viewing ply 0\/1/)).toBeInTheDocument();
      expect(screen.getByTestId('can-drag')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-e7e5' }));

    await waitFor(() => {
      expect(screen.getByText(/Review mode active\. Click Latest/i)).toBeInTheDocument();
    });
  });
});
