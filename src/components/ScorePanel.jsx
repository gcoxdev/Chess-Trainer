import { CollapsiblePanel } from './CollapsiblePanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { formatDurationMs, formatHistoryTimestamp, formatPuzzleThemeLabel, formatScoreValue } from '../lib/chessCore';

export function ScorePanel({
  collapsed,
  onToggle,
  status,
  freeplayMode,
  score,
  scorePercent,
  useTimeScoring,
  displayedTotalTimedMs,
  randomFenMode,
  repertoireMode,
  puzzleMode,
  currentOpening,
  repertoireLabel,
  repertoireLinesCompleted,
  randomPositionsCompleted,
  puzzlesCompleted,
  puzzleThemeDisplay,
  freeplayAnalyzeMoves,
  topN,
  scoreModeLabel,
  bestClassicScore,
  bestRandomSession,
  bestPuzzleSession,
  randomFenPhase,
  puzzleTheme,
  showScoreHistory,
  onToggleScoreHistory,
  activeScoreHistoryTitle,
  clearActiveScoreHistory,
  clearHistoryButtonTitle,
  clearHistoryAriaLabel,
  activeScoreHistory,
  displayedScoreHistory,
  lastEvaluatedMoves,
  showLastEvaluated,
  onToggleLastEvaluated,
  puzzleHintUnlocked,
  nextPuzzleHint,
  showPuzzleHint,
  onTogglePuzzleHint,
  error
}) {
  return (
    <CollapsiblePanel
      title="Score"
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <>
        <p role="status" aria-live="polite" aria-atomic="true"><strong>Update:</strong> {status}</p>
        {!freeplayMode ? <p><strong>Current:</strong> {formatScoreValue(score.earned)} / {formatScoreValue(score.possible)} ({scorePercent}%)</p> : null}
        {!freeplayMode ? <p><strong>Mistakes:</strong> {score.errors}</p> : null}
        {!freeplayMode && useTimeScoring ? <p><strong>Total Time:</strong> {formatDurationMs(displayedTotalTimedMs)}</p> : null}
        {!randomFenMode && !puzzleMode && !repertoireMode ? (
          <p><strong>Opening:</strong> {currentOpening?.label || '-'}</p>
        ) : null}
        {repertoireMode ? <p><strong>Line:</strong> {repertoireLabel}</p> : null}
        {repertoireMode ? <p><strong>Completed:</strong> {repertoireLinesCompleted}</p> : null}
        {randomFenMode ? <p><strong>Positions:</strong> {randomPositionsCompleted}</p> : null}
        {puzzleMode ? <p><strong>Puzzles:</strong> {puzzlesCompleted}</p> : null}
        {puzzleMode ? <p><strong>Theme:</strong> {puzzleThemeDisplay}</p> : null}
        {freeplayMode ? <p><strong>Move Analysis:</strong> {freeplayAnalyzeMoves ? `Top ${topN} enabled` : 'Off'}</p> : null}
        {!freeplayMode && !repertoireMode ? <p><strong>Score Mode:</strong> {scoreModeLabel}</p> : null}
        {!randomFenMode && !freeplayMode && !puzzleMode && !repertoireMode ? (
          bestClassicScore ? (
            <p>
              <strong>Best Classic:</strong>{' '}
              {formatScoreValue(Math.max(0, bestClassicScore.earned))} / {formatScoreValue(bestClassicScore.possible)} ({bestClassicScore.percent.toFixed(1)}%)
              {bestClassicScore.topN ? ` [Top ${bestClassicScore.topN}]` : ''}
              {bestClassicScore.scoreMode ? ` [${bestClassicScore.scoreMode === 'timed' ? 'Timed' : 'Standard'}]` : ''}
              {typeof bestClassicScore.totalMoveTimeMs === 'number' ? ` [Time ${formatDurationMs(bestClassicScore.totalMoveTimeMs)}]` : ''}
            </p>
          ) : (
            <p><strong>Best Classic:</strong> -</p>
          )
        ) : randomFenMode ? (
          bestRandomSession ? (
            <p>
              <strong>Best Random:</strong>{' '}
              {bestRandomSession.positions} positions, {formatScoreValue(Math.max(0, bestRandomSession.earned))} / {formatScoreValue(bestRandomSession.possible)} ({bestRandomSession.percent.toFixed(1)}%)
              {bestRandomSession.topN ? `, Top ${bestRandomSession.topN}` : ''}
              {` [${randomFenPhase === 'random' ? 'Random' : randomFenPhase}]`}
              {bestRandomSession.scoreMode ? ` [${bestRandomSession.scoreMode === 'timed' ? 'Timed' : 'Standard'}]` : ''}
              {typeof bestRandomSession.totalMoveTimeMs === 'number' ? ` [Time ${formatDurationMs(bestRandomSession.totalMoveTimeMs)}]` : ''}
            </p>
          ) : (
            <p><strong>Best Random:</strong> -</p>
          )
        ) : puzzleMode ? (
          bestPuzzleSession ? (
            <p>
              <strong>Best Puzzle:</strong>{' '}
              {bestPuzzleSession.puzzles} puzzles, {formatScoreValue(Math.max(0, bestPuzzleSession.earned))} / {formatScoreValue(bestPuzzleSession.possible)} ({bestPuzzleSession.percent.toFixed(1)}%)
              {` [${formatPuzzleThemeLabel(puzzleTheme)}]`}
              {bestPuzzleSession.scoreMode ? ` [${bestPuzzleSession.scoreMode === 'timed' ? 'Timed' : 'Standard'}]` : ''}
              {typeof bestPuzzleSession.totalMoveTimeMs === 'number' ? ` [Time ${formatDurationMs(bestPuzzleSession.totalMoveTimeMs)}]` : ''}
            </p>
          ) : (
            <p><strong>Best Puzzle:</strong> -</p>
          )
        ) : null}
        {!freeplayMode && !repertoireMode ? (
          <button
            type="button"
            className="secondary"
            onClick={onToggleScoreHistory}
          >
            {showScoreHistory ? 'Hide Score History' : 'Show Score History'}
          </button>
        ) : null}
        {!freeplayMode && !repertoireMode && showScoreHistory ? (
          activeScoreHistory.length ? (
            <div className="history-list">
              <div className="history-list-head">
                <span className="history-list-title">{activeScoreHistoryTitle}</span>
                <button
                  type="button"
                  className="history-clear-button"
                  onClick={clearActiveScoreHistory}
                  title={clearHistoryButtonTitle}
                  aria-label={clearHistoryAriaLabel}
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                </button>
              </div>
              <div className="history-row history-columns" aria-hidden="true">
                <span className="history-rank">#</span>
                <span className="history-main">Score</span>
                <span className="history-time">Date</span>
              </div>
              {displayedScoreHistory.slice(0, 20).map((entry, index) => (
                <div className="history-row" key={`${entry.timestamp}-${index}`}>
                  <span className="history-rank">#{index + 1}</span>
                  <span className="history-main">
                    {puzzleMode
                      ? `${entry.puzzles} puz, ${formatScoreValue(Math.max(0, entry.earned))}/${formatScoreValue(entry.possible)} (${entry.percent.toFixed(1)}%)${typeof entry.totalMoveTimeMs === 'number' ? `, Time ${formatDurationMs(entry.totalMoveTimeMs)}` : ''}`
                      : randomFenMode
                        ? `${entry.positions} pos, ${formatScoreValue(Math.max(0, entry.earned))}/${formatScoreValue(entry.possible)} (${entry.percent.toFixed(1)}%)${entry.topN ? `, Top ${entry.topN}` : ''}${typeof entry.totalMoveTimeMs === 'number' ? `, Time ${formatDurationMs(entry.totalMoveTimeMs)}` : ''}`
                        : `${formatScoreValue(Math.max(0, entry.earned))}/${formatScoreValue(entry.possible)} (${entry.percent.toFixed(1)}%)${entry.topN ? `, Top ${entry.topN}` : ''}${typeof entry.totalMoveTimeMs === 'number' ? `, Time ${formatDurationMs(entry.totalMoveTimeMs)}` : ''}`}
                  </span>
                  <span className="history-time">{formatHistoryTimestamp(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-list">
              <div className="history-list-head">
                <span className="history-list-title">{activeScoreHistoryTitle}</span>
              </div>
              <p className="note">No score history yet.</p>
            </div>
          )
        ) : null}

        {lastEvaluatedMoves.length ? (
          <>
            <button
              type="button"
              className="secondary"
              onClick={onToggleLastEvaluated}
            >
              {showLastEvaluated ? 'Hide Last Evaluation' : 'Reveal Last Evaluation'}
            </button>
            {showLastEvaluated ? (
              <p><strong>Last top choices:</strong> {lastEvaluatedMoves.join(', ')}</p>
            ) : null}
          </>
        ) : null}

        {puzzleMode && puzzleHintUnlocked && nextPuzzleHint ? (
          <>
            <button
              type="button"
              className="secondary"
              onClick={onTogglePuzzleHint}
            >
              {showPuzzleHint ? 'Hide Puzzle Hint' : 'Reveal Puzzle Hint'}
            </button>
            {showPuzzleHint ? (
              <p><strong>Next puzzle move hint:</strong> {nextPuzzleHint}</p>
            ) : null}
          </>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
      </>
    </CollapsiblePanel>
  );
}
