# Chess Trainer

This project was created by OpenAI Codex 5.3.

Chess Trainer is a React + Vite application for practicing chess in multiple training modes with Stockfish-powered analysis and guided opening line study.

## Features

- Classic training mode with scored move quality against top engine choices
- Random-position mode (opening, middlegame, endgame, or random)
- Openings mode with line-based training and opening-side auto-selection
- Puzzle mode with theme selection and optional hint reveal after mistakes
- Freeplay mode with optional move analysis
- Move history navigation with replay controls
- Optional time-based scoring and score history tracking
- Board/piece theme customization and dark mode
- Right-click square marking and arrow drawing
- Stockfish 18 worker setup via script

## Tech Stack

- React 19
- Vite
- react-chessboard v5
- chess.js
- Stockfish 18
- Vitest + Testing Library

## Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Set up Stockfish runtime files (copies engine assets from `node_modules/stockfish` into `public/`):

```bash
npm run setup-engine
```

4. Start the development server:

```bash
npm run dev
```

## Build and Test

Run tests:

```bash
npm test
```

Build production bundle:

```bash
npm run build
```

## Opening Side Map Check

Validate that all opening families in the TSV opening files are mapped to a training side:

```bash
npm run check-opening-sides
```
