import { useEffect, useLayoutEffect } from 'react';

export function useHistoryControls({
  moveHistoryLength,
  pendingPromotion,
  viewingHistory,
  setViewedPly,
  setSelectedSquare,
  setDragSourceSquare,
  setRightClickedSquares,
  setDrawnArrows,
  previousMoveHistoryLenRef
}) {
  const goToFirstMove = () => {
    setViewedPly(0);
  };

  const goToPreviousMove = () => {
    setViewedPly((prev) => Math.max(0, prev - 1));
  };

  const goToNextMove = () => {
    setViewedPly((prev) => Math.min(moveHistoryLength, prev + 1));
  };

  const goToLatestMove = () => {
    setViewedPly(moveHistoryLength);
  };

  useLayoutEffect(() => {
    const previousLen = previousMoveHistoryLenRef.current;
    setViewedPly((prev) => (prev === previousLen ? moveHistoryLength : Math.min(prev, moveHistoryLength)));
    previousMoveHistoryLenRef.current = moveHistoryLength;
    setRightClickedSquares({});
    setDrawnArrows([]);
  }, [moveHistoryLength, setViewedPly, previousMoveHistoryLenRef, setRightClickedSquares, setDrawnArrows]);

  useEffect(() => {
    if (!viewingHistory) {
      return;
    }
    setSelectedSquare('');
    setDragSourceSquare('');
  }, [viewingHistory, setSelectedSquare, setDragSourceSquare]);

  useEffect(() => {
    const onGlobalHistoryKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        const isFormControl = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
        if (isFormControl || target.isContentEditable) {
          return;
        }
      }

      if (!moveHistoryLength || pendingPromotion) {
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

    window.addEventListener('keydown', onGlobalHistoryKeyDown);
    return () => window.removeEventListener('keydown', onGlobalHistoryKeyDown);
  }, [moveHistoryLength, pendingPromotion]);

  return {
    goToFirstMove,
    goToPreviousMove,
    goToNextMove,
    goToLatestMove
  };
}

