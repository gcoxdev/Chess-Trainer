import { CollapsiblePanel } from './CollapsiblePanel';

export function SettingsPanel({
  collapsed,
  onToggle,
  gameMode,
  settingsLocked,
  setGameMode,
  randomFenMode,
  randomFenPhase,
  setRandomFenPhase,
  puzzleMode,
  puzzleTheme,
  setPuzzleTheme,
  puzzleManifest,
  formatPuzzleThemeLabel,
  engineSkillLevel,
  freeplayMode,
  setEngineSkillLevel,
  clamp,
  approximateEloForSkillLevel,
  topN,
  setTopN,
  allowCommonOpenings,
  setAllowCommonOpenings,
  freeplayAnalyzeMoves,
  setFreeplayAnalyzeMoves,
  playerColor,
  setPlayerColor,
  boardStyle,
  setBoardStyle,
  BOARD_THEMES,
  pieceStyle,
  setPieceStyle,
  UNICODE_PIECE_STYLES,
  showValidMoves,
  setShowValidMoves,
  useTimeScoring,
  setUseTimeScoring,
  isGameStarted,
  startGame,
  resetToSetup,
  ready,
  isProcessing
}) {
  return (
    <CollapsiblePanel
      as="header"
      title="Settings"
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="controls">
        <label>
          Game Mode
          <select value={gameMode} disabled={settingsLocked} onChange={(e) => setGameMode(e.target.value)}>
            <option value="classic">Classic</option>
            <option value="random-fen">Random Position</option>
            <option value="puzzle">Puzzle</option>
            <option value="freeplay">Freeplay</option>
          </select>
        </label>

        {randomFenMode ? (
          <label>
            Position Phase
            <select
              value={randomFenPhase}
              disabled={settingsLocked}
              onChange={(e) => setRandomFenPhase(e.target.value)}
            >
              <option value="random">Random</option>
              <option value="opening">Opening</option>
              <option value="middlegame">Middlegame</option>
              <option value="endgame">Endgame</option>
            </select>
          </label>
        ) : puzzleMode ? (
          <label>
            Puzzle Theme
            <select
              value={puzzleTheme}
              disabled={settingsLocked}
              onChange={(e) => setPuzzleTheme(e.target.value)}
            >
              <option value="random">Random</option>
              {(puzzleManifest?.themes || []).map((t) => (
                <option key={t.slug} value={t.theme}>{`${formatPuzzleThemeLabel(t.theme)} (${t.count.toLocaleString()})`}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Skill Level
            <select
              value={engineSkillLevel}
              disabled={settingsLocked || freeplayMode || puzzleMode}
              onChange={(e) => setEngineSkillLevel(clamp(Number(e.target.value || 5), 0, 20))}
            >
              {Array.from({ length: 21 }, (_, i) => (
                <option key={i} value={i}>
                  {`Level ${i} (~${approximateEloForSkillLevel(i)} Elo)`}
                </option>
              ))}
            </select>
          </label>
        )}

        {!puzzleMode ? (
          <label>
            Top N
            <input
              type="number"
              min={1}
              max={10}
              value={topN}
              disabled={settingsLocked}
              onChange={(e) => setTopN(clamp(Number(e.target.value || 3), 1, 10))}
            />
          </label>
        ) : null}

        {!randomFenMode && !freeplayMode && !puzzleMode ? (
          <label>
            Allow Common Openings
            <input
              type="checkbox"
              checked={allowCommonOpenings}
              disabled={settingsLocked}
              onChange={(e) => setAllowCommonOpenings(e.target.checked)}
            />
          </label>
        ) : null}

        {freeplayMode ? (
          <label>
            Analyze Moves
            <input
              type="checkbox"
              checked={freeplayAnalyzeMoves}
              disabled={settingsLocked}
              onChange={(e) => setFreeplayAnalyzeMoves(e.target.checked)}
            />
          </label>
        ) : null}

        {!puzzleMode ? (
          <label>
            Play As
            <select value={playerColor} disabled={settingsLocked} onChange={(e) => setPlayerColor(e.target.value)}>
              <option value="w">White</option>
              <option value="b">Black</option>
              <option value="random">Random</option>
            </select>
          </label>
        ) : null}

        <label>
          Board Style
          <select value={boardStyle} onChange={(e) => setBoardStyle(e.target.value)}>
            {Object.entries(BOARD_THEMES).map(([value, theme]) => (
              <option value={value} key={value}>{theme.label}</option>
            ))}
          </select>
        </label>

        <label>
          Piece Style
          <select value={pieceStyle} onChange={(e) => setPieceStyle(e.target.value)}>
            <option value="default">Default</option>
            <option value="sprite26774">Line Art</option>
            <option value="spriteChessPieces">Illustrated</option>
            <option value="sprite3413429">Regal</option>
            <option value="spriteChrisdesign">Modern</option>
            <option value="spriteRetro">Retro</option>
            {Object.entries(UNICODE_PIECE_STYLES).map(([value, config]) => (
              <option value={value} key={value}>{config.label}</option>
            ))}
            <option value="alpha">Alpha</option>
            <option value="glass">Glass</option>
          </select>
        </label>

        <label>
          Show Valid Moves
          <input
            type="checkbox"
            checked={showValidMoves}
            onChange={(e) => setShowValidMoves(e.target.checked)}
          />
        </label>

        {!freeplayMode ? (
          <label>
            Time-Based Scoring
            <input
              type="checkbox"
              checked={useTimeScoring}
              disabled={settingsLocked}
              onChange={(e) => setUseTimeScoring(e.target.checked)}
            />
          </label>
        ) : null}

        {!isGameStarted ? (
          <button className="success-button" onClick={startGame} type="button" disabled={!ready || isProcessing}>
            Start Game
          </button>
        ) : (
          <button className="danger-button" onClick={resetToSetup} type="button">End Game</button>
        )}
      </div>
    </CollapsiblePanel>
  );
}
