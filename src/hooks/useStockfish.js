import { useEffect, useRef, useState } from 'react';

function parseMultiPV(lines, expected) {
  const byIndex = new Map();

  for (const line of lines) {
    if (!line.startsWith('info') || !line.includes(' pv ')) {
      continue;
    }

    const multiPvMatch = line.match(/ multipv (\d+)/);
    const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);

    if (!multiPvMatch || !pvMatch) {
      continue;
    }

    byIndex.set(Number(multiPvMatch[1]), pvMatch[1]);
  }

  return Array.from({ length: expected }, (_, i) => byIndex.get(i + 1)).filter(Boolean);
}

export function useStockfish() {
  const workerRef = useRef(null);
  const pendingRef = useRef(null);
  const linesRef = useRef([]);
  const requestSeqRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

    const rejectPending = (message) => {
      if (!pendingRef.current) {
        return;
      }
      pendingRef.current.reject(new Error(message));
      pendingRef.current = null;
      linesRef.current = [];
    };

    worker.onmessage = (event) => {
      const line = String(event.data ?? '');
      if (line === 'readyok') {
        setReady(true);
      }

      if (!pendingRef.current) {
        return;
      }

      linesRef.current.push(line);

      if (line.startsWith('bestmove')) {
        const bestMove = line.split(' ')[1];
        const topMoves = parseMultiPV(linesRef.current, pendingRef.current.topN);
        pendingRef.current.resolve({ bestMove, topMoves });
        pendingRef.current = null;
        linesRef.current = [];
      }
    };

    worker.onerror = () => {
      rejectPending('Stockfish worker error');
      setReady(false);
      setError('Failed to start Stockfish worker. Run npm install, npm run setup-engine, then restart dev server.');
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => {
      rejectPending('Stockfish worker terminated');
      worker.terminate();
      workerRef.current = null;
      pendingRef.current = null;
      linesRef.current = [];
    };
  }, []);

  const send = (command) => {
    workerRef.current?.postMessage(command);
  };

  const configure = ({ skillLevel }) => {
    send('setoption name UCI_LimitStrength value false');
    send(`setoption name Skill Level value ${skillLevel}`);
    send('isready');
  };

  const beginNewGame = () => {
    send('stop');
    send('ucinewgame');
    send('isready');
  };

  const evaluateTopMoves = ({ fen, topN, depth }) => {
    if (!ready) {
      return Promise.reject(new Error('Engine not ready'));
    }

    if (pendingRef.current) {
      return Promise.reject(new Error('Engine busy'));
    }

    return new Promise((resolve, reject) => {
      const requestId = ++requestSeqRef.current;
      const timeoutId = window.setTimeout(() => {
        if (!pendingRef.current || pendingRef.current.id !== requestId) {
          return;
        }
        pendingRef.current.reject(new Error('Engine analysis timed out'));
        pendingRef.current = null;
        linesRef.current = [];
        send('stop');
      }, 15000);

      pendingRef.current = {
        id: requestId,
        topN,
        resolve: (payload) => {
          window.clearTimeout(timeoutId);
          resolve(payload);
        },
        reject: (err) => {
          window.clearTimeout(timeoutId);
          reject(err);
        }
      };
      linesRef.current = [];

      send('stop');
      send(`position fen ${fen}`);
      send(`setoption name MultiPV value ${topN}`);
      send(`go depth ${Math.max(4, Math.min(24, depth ?? Math.min(18, 8 + topN)))}`);
    });
  };

  const chooseMoveFast = ({ fen, moveTimeMs = 220 }) => {
    if (!ready) {
      return Promise.reject(new Error('Engine not ready'));
    }

    if (pendingRef.current) {
      return Promise.reject(new Error('Engine busy'));
    }

    return new Promise((resolve, reject) => {
      const requestId = ++requestSeqRef.current;
      const timeoutId = window.setTimeout(() => {
        if (!pendingRef.current || pendingRef.current.id !== requestId) {
          return;
        }
        pendingRef.current.reject(new Error('Engine move selection timed out'));
        pendingRef.current = null;
        linesRef.current = [];
        send('stop');
      }, 15000);

      pendingRef.current = {
        id: requestId,
        topN: 1,
        resolve: (payload) => {
          window.clearTimeout(timeoutId);
          resolve(payload.bestMove);
        },
        reject: (err) => {
          window.clearTimeout(timeoutId);
          reject(err);
        }
      };
      linesRef.current = [];

      send('stop');
      send(`position fen ${fen}`);
      send('setoption name MultiPV value 1');
      send(`go movetime ${Math.max(30, Math.floor(moveTimeMs))}`);
    });
  };

  return { ready, error, configure, beginNewGame, evaluateTopMoves, chooseMoveFast };
}
