export const PIECE_SYMBOLS = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟'
};

export const UNICODE_PIECE_STYLES = {
  unicode1: {
    label: 'Unicode 1',
    fontFamily: '"CT Unicode DejaVu Sans", sans-serif',
    fontScale: 1,
    lineHeight: 1,
    yOffset: 0,
    glyphYOffsetEm: 0
  },
  unicode6: {
    label: 'Unicode 2',
    fontFamily: '"CT Unicode Noto Symbols 2", sans-serif',
    fontScale: 0.92,
    lineHeight: 1,
    yOffset: 0,
    glyphYOffsetEm: 0
  },
  unicode7: {
    label: 'Unicode 3',
    fontFamily: '"CT Unicode Quivira", serif',
    fontScale: 1.02,
    lineHeight: 1,
    yOffset: 0,
    glyphYOffsetEm: 0
  }
};

export const BOARD_THEMES = {
  classic: {
    label: 'Classic',
    light: '#F0D9B5',
    dark: '#B58863',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 34, 54, 0.24)' }
  },
  crimson: {
    label: 'Crimson',
    light: '#F7E0E0',
    dark: '#A94452',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(72, 23, 30, 0.24)' }
  },
  amber: {
    label: 'Amber',
    light: '#F7EBC9',
    dark: '#C48A2C',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(88, 58, 16, 0.24)' }
  },
  green: {
    label: 'Green',
    light: '#EEEED2',
    dark: '#769656',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(24, 44, 25, 0.24)' }
  },
  teal: {
    label: 'Teal',
    light: '#DAF1EE',
    dark: '#2C8C82',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 58, 53, 0.24)' }
  },
  blue: {
    label: 'Blue',
    light: '#DEEAF7',
    dark: '#5E81AC',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(18, 38, 74, 0.24)' }
  },
  indigo: {
    label: 'Indigo',
    light: '#E5E8FA',
    dark: '#4F5FA8',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(26, 32, 72, 0.25)' }
  },
  violet: {
    label: 'Violet',
    light: '#EFE6FA',
    dark: '#7C5BA7',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(46, 29, 72, 0.24)' }
  },
  walnut: {
    label: 'Walnut',
    light: '#E8D2B0',
    dark: '#8C5A3C',
    board: { borderRadius: '10px', boxShadow: '0 12px 24px rgba(57, 31, 19, 0.28)' }
  },
  tournament: {
    label: 'Tournament',
    light: '#F4E6C8',
    dark: '#9E6B3F',
    board: { borderRadius: '10px', boxShadow: '0 12px 24px rgba(45, 28, 18, 0.28)' }
  },
  olive: {
    label: 'Olive',
    light: '#EEEED2',
    dark: '#6B8E23',
    board: { borderRadius: '8px', boxShadow: '0 8px 20px rgba(36, 54, 24, 0.22)' }
  },
  slate: {
    label: 'Slate',
    light: '#D9E1EF',
    dark: '#60728D',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(10, 19, 34, 0.28)' }
  },
  gray: {
    label: 'Gray',
    light: '#E7EAF0',
    dark: '#7B8798',
    board: { borderRadius: '10px', boxShadow: '0 10px 24px rgba(32, 38, 49, 0.22)' }
  },
  tournament3d: {
    label: 'Tournament 3D',
    light: '#F6E7C8',
    dark: '#B37B4B',
    board: {
      borderRadius: '12px',
      boxShadow: '0 18px 28px rgba(20, 24, 31, 0.36), inset 0 2px 0 rgba(255, 255, 255, 0.38)',
      background: 'linear-gradient(145deg, rgba(255,255,255,0.38), rgba(0,0,0,0.18))'
    }
  }
};

export function createCustomPieces(pieceStyle) {
  if (pieceStyle === 'default') {
    return undefined;
  }

  const unicodeStyle = UNICODE_PIECE_STYLES[pieceStyle] || (pieceStyle === 'glyph' ? UNICODE_PIECE_STYLES.unicode1 : null);

  if (unicodeStyle) {
    const getGlyphPiece = (pieceCode) => (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
        <text
          x="50"
          y="50"
          dy="0.14em"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: unicodeStyle.fontFamily,
            fontSize: `${92 * (unicodeStyle.fontScale ?? 1)}px`,
            lineHeight: unicodeStyle.lineHeight,
            fill: pieceCode[0] === 'w' ? '#21344f' : '#0f1829'
          }}
        >
          {PIECE_SYMBOLS[pieceCode]}
        </text>
      </svg>
    );

    return {
      wP: getGlyphPiece('wP'),
      wN: getGlyphPiece('wN'),
      wB: getGlyphPiece('wB'),
      wR: getGlyphPiece('wR'),
      wQ: getGlyphPiece('wQ'),
      wK: getGlyphPiece('wK'),
      bP: getGlyphPiece('bP'),
      bN: getGlyphPiece('bN'),
      bB: getGlyphPiece('bB'),
      bR: getGlyphPiece('bR'),
      bQ: getGlyphPiece('bQ'),
      bK: getGlyphPiece('bK')
    };
  }

  if (pieceStyle === 'sprite26774') {
    const getSpritePiece = (pieceCode) => (props) => {
      const sizePercent = 94;
      const isWhite = pieceCode[0] === 'w';
      const src = isWhite
        ? `/pieces/line-art/${pieceCode}.png?v=14`
        : `/pieces/line-art/${pieceCode}.svg?v=14`;

      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
          <image
            href={src}
            x={`${(100 - sizePercent) / 2}`}
            y={`${(100 - sizePercent) / 2}`}
            width={`${sizePercent}`}
            height={`${sizePercent}`}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      );
    };

    return {
      wP: getSpritePiece('wP'),
      wN: getSpritePiece('wN'),
      wB: getSpritePiece('wB'),
      wR: getSpritePiece('wR'),
      wQ: getSpritePiece('wQ'),
      wK: getSpritePiece('wK'),
      bP: getSpritePiece('bP'),
      bN: getSpritePiece('bN'),
      bB: getSpritePiece('bB'),
      bR: getSpritePiece('bR'),
      bQ: getSpritePiece('bQ'),
      bK: getSpritePiece('bK')
    };
  }

  if (pieceStyle === 'spriteChessPieces') {
    const getSpritePiece = (pieceCode) => (props) => {
      const sizePercent = 94;
      const src = `/pieces/illustrated/${pieceCode}.png?v=4`;

      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
          <image
            href={src}
            x={`${(100 - sizePercent) / 2}`}
            y={`${(100 - sizePercent) / 2}`}
            width={`${sizePercent}`}
            height={`${sizePercent}`}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      );
    };

    return {
      wP: getSpritePiece('wP'),
      wN: getSpritePiece('wN'),
      wB: getSpritePiece('wB'),
      wR: getSpritePiece('wR'),
      wQ: getSpritePiece('wQ'),
      wK: getSpritePiece('wK'),
      bP: getSpritePiece('bP'),
      bN: getSpritePiece('bN'),
      bB: getSpritePiece('bB'),
      bR: getSpritePiece('bR'),
      bQ: getSpritePiece('bQ'),
      bK: getSpritePiece('bK')
    };
  }

  if (pieceStyle === 'sprite3413429') {
    const getSpritePiece = (pieceCode) => (props) => {
      const isPawn = pieceCode[1] === 'P';
      const sizePercent = isPawn ? 82 : 94;
      const isWhite = pieceCode[0] === 'w';
      const src = isWhite
        ? `/pieces/regal/${pieceCode}.png?v=2`
        : `/pieces/regal/${pieceCode}.svg?v=2`;

      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
          <image
            href={src}
            x={`${(100 - sizePercent) / 2}`}
            y={`${(100 - sizePercent) / 2}`}
            width={`${sizePercent}`}
            height={`${sizePercent}`}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      );
    };

    return {
      wP: getSpritePiece('wP'),
      wN: getSpritePiece('wN'),
      wB: getSpritePiece('wB'),
      wR: getSpritePiece('wR'),
      wQ: getSpritePiece('wQ'),
      wK: getSpritePiece('wK'),
      bP: getSpritePiece('bP'),
      bN: getSpritePiece('bN'),
      bB: getSpritePiece('bB'),
      bR: getSpritePiece('bR'),
      bQ: getSpritePiece('bQ'),
      bK: getSpritePiece('bK')
    };
  }

  if (pieceStyle === 'spriteChrisdesign') {
    const getSpritePiece = (pieceCode) => (props) => {
      const isPawn = pieceCode[1] === 'P';
      const sizePercent = isPawn ? 84 : 96;
      const src = `/pieces/modern/${pieceCode}.png?v=4`;

      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
          <image
            href={src}
            x={`${(100 - sizePercent) / 2}`}
            y={`${(100 - sizePercent) / 2}`}
            width={`${sizePercent}`}
            height={`${sizePercent}`}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      );
    };

    return {
      wP: getSpritePiece('wP'),
      wN: getSpritePiece('wN'),
      wB: getSpritePiece('wB'),
      wR: getSpritePiece('wR'),
      wQ: getSpritePiece('wQ'),
      wK: getSpritePiece('wK'),
      bP: getSpritePiece('bP'),
      bN: getSpritePiece('bN'),
      bB: getSpritePiece('bB'),
      bR: getSpritePiece('bR'),
      bQ: getSpritePiece('bQ'),
      bK: getSpritePiece('bK')
    };
  }

  if (pieceStyle === 'spriteRetro') {
    const getSpritePiece = (pieceCode) => (props) => {
      const pieceType = pieceCode[1];
      const sizePercent =
        pieceType === 'P' ? 80
          : (pieceType === 'R' || pieceType === 'N') ? 88
            : 94;
      const src = `/pieces/retro/${pieceCode}.png?v=1`;

      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
          <image
            href={src}
            x={`${(100 - sizePercent) / 2}`}
            y={`${(100 - sizePercent) / 2}`}
            width={`${sizePercent}`}
            height={`${sizePercent}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ imageRendering: 'pixelated' }}
          />
        </svg>
      );
    };

    return {
      wP: getSpritePiece('wP'),
      wN: getSpritePiece('wN'),
      wB: getSpritePiece('wB'),
      wR: getSpritePiece('wR'),
      wQ: getSpritePiece('wQ'),
      wK: getSpritePiece('wK'),
      bP: getSpritePiece('bP'),
      bN: getSpritePiece('bN'),
      bB: getSpritePiece('bB'),
      bR: getSpritePiece('bR'),
      bQ: getSpritePiece('bQ'),
      bK: getSpritePiece('bK')
    };
  }

  const isGlass = pieceStyle === 'glass';
  const labels = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K' };
  const fontSizeFactor = pieceStyle === 'glass' ? 0.44 : 0.42;
  const borderRadius = pieceStyle === 'glass' ? '28%' : '22%';

  const getPiece = (color, piece) => (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style={props?.svgStyle}>
      <rect
        x="13"
        y="13"
        width="74"
        height="74"
        rx={borderRadius === '28%' ? 21 : 16}
        fill={isGlass
          ? (color === 'w' ? '#dfe9f8' : '#243450')
          : (color === 'w' ? '#e7d8c0' : '#312826')}
      />
      <rect
        x="13"
        y="13"
        width="74"
        height="74"
        rx={borderRadius === '28%' ? 21 : 16}
        fill={isGlass
          ? (color === 'w' ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.07)')
          : (color === 'w' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)')}
        stroke={isGlass
          ? (color === 'w' ? 'rgba(21,36,57,0.35)' : 'rgba(235,241,255,0.2)')
          : (color === 'w' ? 'rgba(48,39,26,0.34)' : 'rgba(245,219,182,0.2)')}
        strokeWidth="1.5"
      />
      <rect
        x="16"
        y="16"
        width="68"
        height="26"
        rx={borderRadius === '28%' ? 16 : 12}
        fill={isGlass
          ? (color === 'w' ? 'rgba(255,255,255,0.44)' : 'rgba(255,255,255,0.12)')
          : (color === 'w' ? 'rgba(255,250,240,0.2)' : 'rgba(255,220,180,0.05)')}
      />
      {isGlass ? (
        <ellipse cx="39" cy="31" rx="24" ry="12" fill={color === 'w' ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.16)'} />
      ) : null}
      <text
        x="50"
        y="50"
        dy="0.12em"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color === 'w' ? '#1f2d44' : '#ecf2ff'}
        style={{ fontWeight: 800, fontSize: `${82 * fontSizeFactor}px` }}
      >
        {labels[piece]}
      </text>
    </svg>
  );

  return {
    wP: getPiece('w', 'P'),
    wN: getPiece('w', 'N'),
    wB: getPiece('w', 'B'),
    wR: getPiece('w', 'R'),
    wQ: getPiece('w', 'Q'),
    wK: getPiece('w', 'K'),
    bP: getPiece('b', 'P'),
    bN: getPiece('b', 'N'),
    bB: getPiece('b', 'B'),
    bR: getPiece('b', 'R'),
    bQ: getPiece('b', 'Q'),
    bK: getPiece('b', 'K')
  };
}
