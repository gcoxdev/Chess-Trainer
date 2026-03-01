import { useEffect, useMemo, useState } from 'react';
import { SCORE_HISTORY_STORAGE_KEY, historyBucketKey, loadScoreHistory } from '../lib/chessCore';

export function useScoreHistory({
  gameMode,
  engineSkillLevel,
  randomFenPhase,
  puzzleTheme,
  useTimeScoring
}) {
  const [scoreHistory, setScoreHistory] = useState(() => loadScoreHistory());

  const puzzleMode = gameMode === 'puzzle';
  const randomFenMode = gameMode === 'random-fen';
  const scoreModeKey = useTimeScoring ? 'timed' : 'standard';
  const scoreModeLabel = useTimeScoring ? 'Timed' : 'Standard';
  const classicHistoryKey = historyBucketKey(String(engineSkillLevel), scoreModeKey);
  const randomHistoryKey = historyBucketKey(String(randomFenPhase), scoreModeKey);
  const puzzleHistoryKey = historyBucketKey(String(puzzleTheme), scoreModeKey);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCORE_HISTORY_STORAGE_KEY, JSON.stringify(scoreHistory));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, [scoreHistory]);

  const classicHistoryForSelectedSkill = useMemo(
    () => {
      const buckets = scoreHistory.classicBySkill || {};
      if (scoreModeKey === 'standard') {
        return buckets[classicHistoryKey] ?? buckets[String(engineSkillLevel)] ?? [];
      }
      return buckets[classicHistoryKey] ?? [];
    },
    [scoreHistory, engineSkillLevel, scoreModeKey, classicHistoryKey]
  );

  const randomHistoryForSelectedPhase = useMemo(
    () => {
      const buckets = scoreHistory.randomByPhase || {};
      if (scoreModeKey === 'standard') {
        return buckets[randomHistoryKey] ?? buckets[String(randomFenPhase)] ?? [];
      }
      return buckets[randomHistoryKey] ?? [];
    },
    [scoreHistory, randomFenPhase, scoreModeKey, randomHistoryKey]
  );

  const puzzleHistoryForSelectedTheme = useMemo(
    () => {
      const buckets = scoreHistory.puzzleByTheme || {};
      if (scoreModeKey === 'standard') {
        return buckets[puzzleHistoryKey] ?? buckets[String(puzzleTheme)] ?? [];
      }
      return buckets[puzzleHistoryKey] ?? [];
    },
    [scoreHistory, puzzleTheme, scoreModeKey, puzzleHistoryKey]
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

  const bestPuzzleSession = useMemo(() => {
    if (!puzzleHistoryForSelectedTheme.length) {
      return null;
    }
    return [...puzzleHistoryForSelectedTheme].sort((a, b) => {
      if (b.possible !== a.possible) return b.possible - a.possible;
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (b.puzzles !== a.puzzles) return b.puzzles - a.puzzles;
      return b.earned - a.earned;
    })[0];
  }, [puzzleHistoryForSelectedTheme]);

  const activeScoreHistory = useMemo(
    () => (puzzleMode
      ? puzzleHistoryForSelectedTheme
      : (randomFenMode ? randomHistoryForSelectedPhase : classicHistoryForSelectedSkill)),
    [puzzleMode, puzzleHistoryForSelectedTheme, randomFenMode, randomHistoryForSelectedPhase, classicHistoryForSelectedSkill]
  );

  const displayedScoreHistory = useMemo(() => {
    const rows = [...activeScoreHistory];
    if (puzzleMode) {
      return rows;
    }
    return rows.sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [activeScoreHistory, puzzleMode]);

  return {
    scoreHistory,
    setScoreHistory,
    scoreModeKey,
    scoreModeLabel,
    classicHistoryKey,
    randomHistoryKey,
    puzzleHistoryKey,
    classicHistoryForSelectedSkill,
    randomHistoryForSelectedPhase,
    puzzleHistoryForSelectedTheme,
    bestClassicScore,
    bestRandomSession,
    bestPuzzleSession,
    activeScoreHistory,
    displayedScoreHistory
  };
}
