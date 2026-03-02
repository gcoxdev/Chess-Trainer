import { CollapsiblePanel } from './CollapsiblePanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAnglesLeft,
  faAnglesRight,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';

export function MoveListPanel({
  collapsed,
  onToggle,
  moveHistory,
  clampedViewedPly,
  viewingHistory,
  goToFirstMove,
  goToPreviousMove,
  goToNextMove,
  goToLatestMove,
  moveRows,
  moveListRef,
  moveRowTemplate,
  resolvedPlayerColor,
  whiteHeaderLabel,
  blackHeaderLabel,
  showWhiteRankColumn,
  showBlackRankColumn,
  formatMoveMetaDisplay
}) {
  const handleMoveNavKeyDown = (event) => {
    if (!moveHistory.length) {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        goToPreviousMove();
        break;
      case 'ArrowRight':
        event.preventDefault();
        goToNextMove();
        break;
      case 'ArrowUp':
        event.preventDefault();
        goToFirstMove();
        break;
      case 'ArrowDown':
        event.preventDefault();
        goToLatestMove();
        break;
      default:
        break;
    }
  };

  const moveHeaderActions = (
    <div
      className="move-nav move-nav-header"
      tabIndex={0}
      role="group"
      aria-label="Move history navigation. Use Left and Right arrows to step, Up for first, Down for latest."
      onKeyDown={handleMoveNavKeyDown}
    >
      <button
        type="button"
        className="secondary"
        onClick={goToFirstMove}
        disabled={!moveHistory.length || clampedViewedPly === 0}
        aria-label="Go to first move"
        title="First"
      >
        <FontAwesomeIcon icon={faAnglesLeft} />
      </button>
      <button
        type="button"
        className="secondary"
        onClick={goToPreviousMove}
        disabled={!moveHistory.length || clampedViewedPly === 0}
        aria-label="Go to previous move"
        title="Back"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <button
        type="button"
        className="secondary"
        onClick={goToNextMove}
        disabled={!moveHistory.length || clampedViewedPly >= moveHistory.length}
        aria-label="Go to next move"
        title="Forward"
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
      <button
        type="button"
        className="secondary"
        onClick={goToLatestMove}
        disabled={!moveHistory.length || clampedViewedPly >= moveHistory.length}
        aria-label="Go to latest move"
        title="Latest"
      >
        <FontAwesomeIcon icon={faAnglesRight} />
      </button>
    </div>
  );

  return (
    <CollapsiblePanel
      title="Move List"
      collapsed={collapsed}
      onToggle={onToggle}
      headerActions={moveHeaderActions}
    >
      <>
        <p className="sr-only">Keyboard shortcuts: Left and Right arrows step through moves. Up jumps to first, Down jumps to latest.</p>
        <p className="move-review-note" role="status" aria-live="polite" aria-atomic="true">
          {moveHistory.length
            ? `Viewing ply ${clampedViewedPly}/${moveHistory.length}${viewingHistory ? ' (review mode: moves locked)' : ''}`
            : 'No moves yet.'}
        </p>
        {moveRows.length ? (
          <div className="move-list" ref={moveListRef}>
            <div className="move-row move-head" style={{ gridTemplateColumns: moveRowTemplate }}>
              <span className="move-num">#</span>
              <span className={resolvedPlayerColor === 'w' ? 'player-col' : ''}>{whiteHeaderLabel}</span>
              {showWhiteRankColumn ? <span>Rank</span> : null}
              <span className={resolvedPlayerColor === 'b' ? 'player-col' : ''}>{blackHeaderLabel}</span>
              {showBlackRankColumn ? <span>Rank</span> : null}
            </div>
            {moveRows.map((row) => {
              const rowStartPly = (row.moveNumber - 1) * 2 + 1;
              const rowEndPly = row.black ? rowStartPly + 1 : rowStartPly;
              const rowIsActive = clampedViewedPly >= rowStartPly && clampedViewedPly <= rowEndPly;
              return (
                <div className={`move-row${rowIsActive ? ' move-row-active' : ''}`} key={row.moveNumber} style={{ gridTemplateColumns: moveRowTemplate }}>
                  <span className="move-num">{row.moveNumber}.</span>
                  <span className={resolvedPlayerColor === 'w' ? 'player-col' : ''}>
                    {row.white ? row.white.san : '-'}
                  </span>
                  {showWhiteRankColumn ? <span className="move-meta">{formatMoveMetaDisplay(row.whiteMeta)}</span> : null}
                  <span className={resolvedPlayerColor === 'b' ? 'player-col' : ''}>
                    {row.black ? row.black.san : '-'}
                  </span>
                  {showBlackRankColumn ? <span className="move-meta">{formatMoveMetaDisplay(row.blackMeta)}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </>
    </CollapsiblePanel>
  );
}
