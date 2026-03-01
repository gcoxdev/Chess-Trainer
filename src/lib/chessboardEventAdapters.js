import { extractSquareFromDragArgs, normalizeArrowTuples } from './chessCore';

function toSquare(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return extractSquareFromDragArgs(payload);
  }

  return '';
}

export function adaptPieceDragPayload(payload) {
  return toSquare(payload);
}

export function adaptDropPayload(...args) {
  if (!args.length) {
    return { sourceSquare: '', targetSquare: '' };
  }

  if (typeof args[0] === 'string') {
    return {
      sourceSquare: args[0] || '',
      targetSquare: typeof args[1] === 'string' ? args[1] : ''
    };
  }

  const payload = args[0];
  if (payload && typeof payload === 'object') {
    const sourceSquare = toSquare(
      payload.sourceSquare
      || payload.source
      || payload.from
      || payload.piece
      || payload
    );
    const targetSquare = toSquare(
      payload.targetSquare
      || payload.target
      || payload.to
      || payload
    );
    return { sourceSquare, targetSquare };
  }

  return { sourceSquare: '', targetSquare: '' };
}

export function adaptSquarePayload(payload) {
  return toSquare(payload);
}

export function adaptArrowsPayload(payload) {
  if (Array.isArray(payload)) {
    return normalizeArrowTuples(payload);
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.arrows)) {
    return normalizeArrowTuples(payload.arrows);
  }
  return [];
}

