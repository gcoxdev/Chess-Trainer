import { useMemo } from 'react';
import { DRAG_START_SLOP_PX, START_FEN, normalizeArrowTuples } from '../lib/chessCore';
import {
  adaptArrowsPayload,
  adaptDropPayload,
  adaptPieceDragPayload,
  adaptSquarePayload
} from '../lib/chessboardEventAdapters';

export function useChessboardOptions({
  displayedBoard,
  boardOrientation,
  boardRenderStyle,
  lightSquareStyle,
  darkSquareStyle,
  dropSquareStyle,
  selectedSquareStyles,
  customPieces,
  isGameStarted,
  viewingHistory,
  isProcessing,
  pendingPromotion,
  effectiveGameOver,
  freeplayMode,
  puzzleMode,
  playerTurn,
  displayArrows,
  handleArrowsChange,
  onPieceDragBegin,
  onPieceDragEnd,
  onDrop,
  onSquareClick,
  onSquareRightClick
}) {
  const chessboardArrows = useMemo(
    () => normalizeArrowTuples(displayArrows).map(([startSquare, endSquare, color]) => ({ startSquare, endSquare, color })),
    [displayArrows]
  );

  return useMemo(() => ({
    id: 'trainer-board',
    position: displayedBoard.fen() || START_FEN,
    boardOrientation,
    boardStyle: boardRenderStyle,
    lightSquareStyle,
    darkSquareStyle,
    dropSquareStyle,
    squareStyles: selectedSquareStyles,
    pieces: customPieces,
    allowDragging: true,
    canDragPiece: () => (
      isGameStarted
      && !viewingHistory
      && !isProcessing
      && !pendingPromotion
      && !effectiveGameOver
      && (freeplayMode || puzzleMode || playerTurn)
    ),
    dragActivationDistance: DRAG_START_SLOP_PX,
    showAnimations: true,
    animationDurationInMs: 250,
    allowDrawingArrows: true,
    arrows: chessboardArrows,
    onArrowsChange: (payload) => handleArrowsChange(adaptArrowsPayload(payload)),
    onPieceDrag: (payload) => onPieceDragBegin(adaptPieceDragPayload(payload)),
    onPieceDrop: (...args) => {
      const { sourceSquare, targetSquare } = adaptDropPayload(...args);
      return onDrop(sourceSquare, targetSquare);
    },
    onSquareClick: (payload) => onSquareClick(adaptSquarePayload(payload)),
    onSquareRightClick: (payload) => onSquareRightClick(adaptSquarePayload(payload)),
    onSquareMouseUp: () => onPieceDragEnd()
  }), [
    displayedBoard,
    boardOrientation,
    boardRenderStyle,
    lightSquareStyle,
    darkSquareStyle,
    dropSquareStyle,
    selectedSquareStyles,
    customPieces,
    isGameStarted,
    viewingHistory,
    isProcessing,
    pendingPromotion,
    effectiveGameOver,
    freeplayMode,
    puzzleMode,
    playerTurn,
    chessboardArrows,
    handleArrowsChange,
    onPieceDragBegin,
    onPieceDragEnd,
    onDrop,
    onSquareClick,
    onSquareRightClick
  ]);
}
