import { useEffect, useState } from 'react';

export function useResponsiveBoardSize(boardWrapRef, boardStatusRef) {
  const [boardWidth, setBoardWidth] = useState(720);

  useEffect(() => {
    const container = boardWrapRef.current;
    if (!container) {
      return;
    }

    const updateBoardSize = () => {
      const rect = container.getBoundingClientRect();
      const statusHeight = boardStatusRef.current?.getBoundingClientRect().height ?? 0;
      const isPortraitMobile = window.matchMedia('(max-width: 1024px) and (orientation: portrait)').matches;
      const maxFromWidth = Math.max(280, rect.width);

      let maxFromHeight;
      if (isPortraitMobile) {
        const reservedForSections = Math.max(180, Math.floor(window.innerHeight * 0.28));
        maxFromHeight = Math.max(260, window.innerHeight - statusHeight - reservedForSections - 12);
      } else {
        maxFromHeight = Math.max(260, rect.height - 4);
      }

      setBoardWidth(Math.floor(Math.min(maxFromWidth, maxFromHeight)));
    };

    updateBoardSize();
    const observer = new ResizeObserver(updateBoardSize);
    observer.observe(container);
    window.addEventListener('resize', updateBoardSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBoardSize);
    };
  }, [boardWrapRef, boardStatusRef]);

  return boardWidth;
}
