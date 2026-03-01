import { useEffect, useMemo, useRef } from 'react';
import { VALID_MOVE_DOT } from '../lib/chessCore';

export function useBoardHighlights({
  displayedBoard,
  selectedSquare,
  dragSourceSquare,
  rightClickedSquares,
  errorSquareStyles,
  showValidMoves,
  setErrorSquareStyles
}) {
  const invalidFlashTimeoutsRef = useRef([]);

  const selectedSquareStyles = useMemo(() => {
    const styles = { ...rightClickedSquares, ...errorSquareStyles };
    const sourceSquare = dragSourceSquare || selectedSquare;

    if (showValidMoves && sourceSquare) {
      const validTargets = displayedBoard.moves({ square: sourceSquare, verbose: true });
      for (const move of validTargets) {
        styles[move.to] = {
          backgroundImage: VALID_MOVE_DOT,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '54% 54%',
          boxShadow: 'inset 0 0 0 6px rgba(34,139,34,0.85)'
        };
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        background: 'radial-gradient(circle, rgba(255,240,114,0.7), rgba(255,216,44,0.35))'
      };
    }
    return styles;
  }, [selectedSquare, dragSourceSquare, rightClickedSquares, errorSquareStyles, showValidMoves, displayedBoard]);

  const flashInvalidMoveSquares = (sourceSquare, targetSquare) => {
    for (const timeoutId of invalidFlashTimeoutsRef.current) {
      clearTimeout(timeoutId);
    }
    invalidFlashTimeoutsRef.current = [];

    const initial = {
      transition: 'background-color 1500ms ease-out',
      backgroundColor: 'rgba(110, 0, 0, 0.95)',
      boxShadow: 'inset 0 0 0 6px rgba(255, 70, 70, 0.95)'
    };
    const faded = {
      transition: 'background-color 1500ms ease-out',
      backgroundColor: 'rgba(110, 0, 0, 0.28)',
      boxShadow: 'inset 0 0 0 6px rgba(255, 70, 70, 0.95)'
    };

    setErrorSquareStyles({
      [sourceSquare]: initial,
      [targetSquare]: initial
    });

    const fadeTimeout = setTimeout(() => {
      setErrorSquareStyles({
        [sourceSquare]: faded,
        [targetSquare]: faded
      });
    }, 40);

    const clearTimeoutId = setTimeout(() => {
      setErrorSquareStyles({});
    }, 1600);

    invalidFlashTimeoutsRef.current = [fadeTimeout, clearTimeoutId];
  };

  useEffect(() => {
    return () => {
      for (const timeoutId of invalidFlashTimeoutsRef.current) {
        clearTimeout(timeoutId);
      }
      invalidFlashTimeoutsRef.current = [];
    };
  }, []);

  return { selectedSquareStyles, flashInvalidMoveSquares };
}

