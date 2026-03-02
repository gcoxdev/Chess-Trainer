import { Chess } from 'chess.js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';

const evaluateTopMovesMock = vi.fn(async ({ topN }) => ({
  topMoves: ['d2d4', 'g1f3', 'c2c4'].slice(0, topN)
}));
const generateRandomTrainingBoardMock = vi.fn(async () => new Chess());
let repertoireLineData = {
  name: 'Test Opening',
  eco: 'T00',
  label: 'Test Opening (T00)',
  moves: ['e2e4', 'e7e5', 'g1f3']
};
let puzzlePoolData = [
  {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    moves: ['e7e5', 'e2e4', 'g8f6'],
    themes: ['opening']
  }
];

vi.mock('./lib/chessCore', async () => {
  const actual = await vi.importActual('./lib/chessCore');
  return {
    ...actual,
    generateRandomTrainingBoard: (...args) => generateRandomTrainingBoardMock(...args)
  };
});

vi.mock('./data/commonOpenings', async () => {
  const actual = await vi.importActual('./data/commonOpenings');
  return {
    ...actual,
    getOpeningRepertoireOptions: () => ([
      { value: 'test-opening', label: 'Test Opening (T00)' }
    ]),
    getOpeningRepertoireLine: () => ({ ...repertoireLineData, moves: [...repertoireLineData.moves] })
  };
});

vi.mock('react-chessboard', () => {
  function ChessboardMock({ options }) {
    const drops = ['e2e4', 'e2e3', 'e7e5', 'g1f3', 'a7a8'];
    const clicks = ['a7', 'a8'];
    return (
      <div data-testid="mock-board">
        {drops.map((uci) => (
          <button
            key={uci}
            type="button"
            onClick={() => options.onPieceDrop?.({ sourceSquare: uci.slice(0, 2), targetSquare: uci.slice(2, 4) })}
          >
            {`drop-${uci}`}
          </button>
        ))}
        {clicks.map((square) => (
          <button
            key={square}
            type="button"
            onClick={() => options.onSquareClick?.({ square })}
          >
            {`click-${square}`}
          </button>
        ))}
        <button type="button" onClick={() => options.onPieceDrop?.('e2', 'e4')}>drop-str-e2e4</button>
        <div data-testid="arrows">{JSON.stringify(options.arrows || [])}</div>
        <div data-testid="can-drag">{String(options.canDragPiece?.())}</div>
        <div data-testid="board-orientation">{String(options.boardOrientation || '')}</div>
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
    evaluateTopMovesMock.mockImplementation(async ({ topN }) => ({
      topMoves: ['d2d4', 'g1f3', 'c2c4'].slice(0, topN)
    }));
    generateRandomTrainingBoardMock.mockReset();
    generateRandomTrainingBoardMock.mockImplementation(async () => new Chess());
    puzzlePoolData = [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
        moves: ['e7e5', 'e2e4', 'g8f6'],
        themes: ['opening']
      }
    ];
    repertoireLineData = {
      name: 'Test Opening',
      eco: 'T00',
      label: 'Test Opening (T00)',
      moves: ['e2e4', 'e7e5', 'g1f3']
    };
    window.localStorage.clear();
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/puzzles/manifest.json')) {
        return {
          ok: true,
          json: async () => ({
            randomFile: 'random-test.json',
            themes: []
          })
        };
      }

      if (String(url).includes('/puzzles/random-test.json')) {
        return {
          ok: true,
          json: async () => puzzlePoolData
        };
      }

      return { ok: false, json: async () => ({}) };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
  }, 12000);

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

  test('random mode enables Next Position only after a scored move', async () => {
    evaluateTopMovesMock.mockImplementation(async ({ topN }) => ({
      topMoves: ['e2e4', 'g1f3', 'd2d4'].slice(0, topN)
    }));
    generateRandomTrainingBoardMock.mockImplementation(async () => new Chess());

    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'random-fen' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    const nextButton = await screen.findByRole('button', { name: /Next Position/i });
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e4' }));

    await waitFor(() => {
      expect(nextButton).toBeEnabled();
    });
  });

  test('repertoire mode rejects wrong moves and enables Next Line after completion', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'repertoire' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Openings mode started/i)).toBeInTheDocument();
    });

    const nextLineButton = screen.getByRole('button', { name: /Next Line/i });
    expect(nextLineButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e3' }));
    await waitFor(() => {
      expect(screen.getByText(/Incorrect line move\./i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e4' }));
    await waitFor(() => {
      expect(screen.getByText(/Correct line move\./i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-g1f3' }));
    await waitFor(() => {
      expect(screen.getByText(/Line complete: Test Opening \(T00\)\./i)).toBeInTheDocument();
      expect(nextLineButton).toBeEnabled();
      expect(screen.getByText('Current:', { selector: 'strong' }).parentElement).toHaveTextContent('2 / 2');
    });
  });

  test('repertoire side selector auto-detects black-opening families and allows white override', async () => {
    repertoireLineData = {
      name: 'Caro-Kann',
      eco: 'B10',
      label: 'Caro-Kann (B10)',
      moves: ['e2e4', 'c7c6', 'd2d4']
    };

    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'repertoire' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    await waitFor(() => {
      expect(screen.getByText(/Turn:/i).parentElement).toHaveTextContent('Black to move');
      expect(screen.getByTestId('board-orientation')).toHaveTextContent('black');
    });

    fireEvent.click(screen.getByRole('button', { name: /End Game/i }));
    fireEvent.change(screen.getByLabelText(/Opening Side/i), {
      target: { value: 'white' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Turn:/i).parentElement).toHaveTextContent('White to move');
      expect(screen.getByTestId('board-orientation')).toHaveTextContent('white');
    });
  });

  test('puzzle mode unlocks and reveals hint after an incorrect move', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'puzzle' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Puzzle mode started\./i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e3' }));

    const revealButton = await screen.findByRole('button', { name: /Reveal Puzzle Hint/i });
    fireEvent.click(revealButton);

    await waitFor(() => {
      expect(screen.getByText(/Next puzzle move hint:/i)).toBeInTheDocument();
      expect(screen.getByText(/^e4$/i)).toBeInTheDocument();
    });
  });

  test('puzzle promotion auto-applies the forced solution move', async () => {
    puzzlePoolData = [
      {
        fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1',
        moves: ['a7a8q'],
        themes: ['promotion']
      }
    ];

    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'puzzle' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Puzzle mode started\./i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-a7a8' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Choose promotion piece/i })).not.toBeInTheDocument();
      expect(screen.getByText(/a8=Q\+/)).toBeInTheDocument();
    });
  });

  test('timed scoring total time updates in real time only on player turn', async () => {
    puzzlePoolData = [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
        moves: ['e7e5', 'e2e4'],
        themes: ['opening']
      }
    ];

    render(<App />);
    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'puzzle' }
    });
    fireEvent.click(screen.getByLabelText(/Time-Based Scoring/i));
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Puzzle mode started\./i)).toBeInTheDocument();
      expect(screen.getByText('Total Time:', { selector: 'strong' })).toBeInTheDocument();
    });
    const readTotalTime = () => (screen.getByText('Total Time:', { selector: 'strong' }).parentElement?.textContent || '');
    const initialTime = readTotalTime();

    await new Promise((resolve) => setTimeout(resolve, 1600));
    const advancedTime = readTotalTime();
    expect(advancedTime).not.toBe(initialTime);

    fireEvent.click(screen.getByRole('button', { name: 'drop-e2e4' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Next Puzzle/i })).toBeEnabled();
    });

    const frozen = readTotalTime();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(readTotalTime()).toBe(frozen);
  }, 12000);

  test('history review shows missed best-move arrow for top-N non-best moves before and after move', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Game Mode/i), {
      target: { value: 'freeplay' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));

    await waitFor(() => {
      expect(screen.getByText(/Freeplay started/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'drop-g1f3' }));
    await waitFor(() => {
      expect(screen.getByText(/2nd Best Move Played\./i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'drop-e7e5' }));

    await waitFor(() => {
      expect(screen.getByText(/Viewing ply 2\/2/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/Viewing ply 1\/2/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('arrows').textContent).toMatch(/d2/);
      expect(screen.getByTestId('arrows').textContent).toMatch(/d4/);
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText(/Viewing ply 0\/2/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('arrows').textContent).toMatch(/d2/);
      expect(screen.getByTestId('arrows').textContent).toMatch(/d4/);
    });
  }, 12000);
});
