import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function walkFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function rankCandidate(filePath) {
  const base = path.basename(filePath);
  if (base === 'stockfish-nnue-16-single.js') return 300;
  if (base.includes('single') && base.endsWith('.js')) return 250;
  if (base === 'stockfish.js') return 200;
  if (base.includes('no-simd') && base.endsWith('.js')) return 100;
  if (base.includes('no-worker') && base.endsWith('.js')) return 50;
  if (base.includes('stockfish') && base.endsWith('.js')) return 80;
  return 0;
}

const stockfishPkgDir = path.join(root, 'node_modules', 'stockfish');
let source = null;

if (existsSync(stockfishPkgDir) && statSync(stockfishPkgDir).isDirectory()) {
  const allFiles = walkFiles(stockfishPkgDir);
  const candidates = allFiles
    .filter((filePath) => path.basename(filePath).toLowerCase().includes('stockfish') && filePath.endsWith('.js'))
    .sort((a, b) => rankCandidate(b) - rankCandidate(a));
  source = candidates[0] || null;
}

if (!source) {
  console.warn('[setup-engine] Could not find a Stockfish engine file under node_modules/stockfish');
  console.warn('[setup-engine] Install dependencies first: npm install');
  process.exit(0);
}

const publicDir = path.join(root, 'public');
const sourceDir = path.dirname(source);
mkdirSync(publicDir, { recursive: true });
copyFileSync(source, path.join(publicDir, 'stockfish.js'));

const runtimeFiles = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => /^stockfish.*\.(js|wasm)$/i.test(name));

for (const filename of runtimeFiles) {
  const from = path.join(sourceDir, filename);
  const to = path.join(publicDir, filename);
  copyFileSync(from, to);
}

console.log(`[setup-engine] Copied main engine from ${path.relative(root, source)} to public/stockfish.js`);
console.log(`[setup-engine] Copied runtime files: ${runtimeFiles.join(', ') || '(none found)'}`);
