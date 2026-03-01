import { CollapsiblePanel } from './CollapsiblePanel';

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
  return (
    <CollapsiblePanel
      title="Move List"
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <>
        <div className="move-nav">
          <button
            type="button"
            className="secondary"
            onClick={goToFirstMove}
            disabled={!moveHistory.length || clampedViewedPly === 0}
          >
            First
          </button>
          <button
            type="button"
            className="secondary"
            onClick={goToPreviousMove}
            disabled={!moveHistory.length || clampedViewedPly === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="secondary"
            onClick={goToNextMove}
            disabled={!moveHistory.length || clampedViewedPly >= moveHistory.length}
          >
            Forward
          </button>
          <button
            type="button"
            className="secondary"
            onClick={goToLatestMove}
            disabled={!moveHistory.length || clampedViewedPly >= moveHistory.length}
          >
            Latest
          </button>
        </div>
        <p className="move-review-note">
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
