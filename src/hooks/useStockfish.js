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

  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

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
      setError('Failed to start Stockfish worker. Run npm install, npm run setup-engine, then restart dev server.');
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => {
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

  const evaluateTopMoves = ({ fen, topN }) => {
    if (!ready) {
      return Promise.reject(new Error('Engine not ready'));
    }

    if (pendingRef.current) {
      return Promise.reject(new Error('Engine busy'));
    }

    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject, topN };
      linesRef.current = [];

      send('stop');
      send('ucinewgame');
      send(`position fen ${fen}`);
      send(`setoption name MultiPV value ${topN}`);
      send(`go depth ${Math.min(18, 8 + topN)}`);
    });
  };

  return { ready, error, configure, evaluateTopMoves };
}
