import { CollapsiblePanel } from './CollapsiblePanel';

export function SettingsPanel({
  collapsed,
  onToggle,
  gameMode,
  settingsLocked,
  setGameMode,
  randomFenMode,
  repertoireMode,
  randomFenPhase,
  setRandomFenPhase,
  repertoireOpening,
  setRepertoireOpening,
  repertoireOpeningOptions,
  repertoireSide,
  setRepertoireSide,
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
            <option value="repertoire">Openings</option>
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
        ) : repertoireMode ? (
          <>
            <label>
              Opening Line Set
              <select
                value={repertoireOpening}
                disabled={settingsLocked}
                onChange={(e) => setRepertoireOpening(e.target.value)}
              >
                <option value="random">Random Opening</option>
                {repertoireOpeningOptions.map((opening) => (
                  <option key={opening.value} value={opening.value}>{opening.label}</option>
                ))}
              </select>
            </label>
            <label>
              Opening Side
              <select
                value={repertoireSide}
                disabled={settingsLocked}
                onChange={(e) => setRepertoireSide(e.target.value)}
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
          </>
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
              disabled={settingsLocked || freeplayMode || puzzleMode || repertoireMode}
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

        {!puzzleMode && !repertoireMode ? (
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

        {!randomFenMode && !freeplayMode && !puzzleMode && !repertoireMode ? (
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

        {!puzzleMode && !repertoireMode ? (
          <label>
            Play As
            <select value={playerColor} disabled={settingsLocked} onChange={(e) => setPlayerColor(e.target.value)}>
              <option value="w">White</option>
              <option value="b">Black</option>
              <option value="random">Random</option>
            </select>
          </label>
        ) : null}

        {!freeplayMode && !repertoireMode ? (
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
