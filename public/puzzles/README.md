# Puzzle Pack (Generated Files)

This folder contains the generated puzzle pack used by the app at runtime:

- `manifest.json`
- `random.json`
- `themes/*.json`

These files are generated from the full Lichess puzzle CSV (`lichess_db_puzzle.csv`) using the build script:

- `scripts/build-puzzle-pack.py`

## Rebuild / Refresh Puzzles

1. Download the latest Lichess puzzle CSV from:
   - https://database.lichess.org/#puzzles
2. Place the file in the project at:
   - `public/lichess_db_puzzle.csv`
3. Run the build script from the project root, for example:

```bash
python3 scripts/build-puzzle-pack.py --max-per-theme 300 --max-random 8000 --min-plays 50
```

## Important Notes

- The build script now removes existing generated puzzle outputs before writing new ones.
  - It clears `public/puzzles/themes/`
  - It replaces `public/puzzles/manifest.json`
  - It replaces `public/puzzles/random.json`
- The source CSV is **not** required at runtime after the puzzle pack is generated.
- You can delete `public/lichess_db_puzzle.csv` after generation to save space.
