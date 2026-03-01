import fs from 'node:fs';
import path from 'node:path';
import { OPENING_FAMILY_SIDE_MAP, normalizeOpeningFamily } from '../src/data/openingFamilySideMap.js';

const openingFiles = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']
  .map((name) => path.resolve('src/data/lichess-openings', name));

function collectFamiliesFromTsv(files) {
  const families = new Set();

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      const firstTab = line.indexOf('\t');
      const secondTab = line.indexOf('\t', firstTab + 1);
      if (firstTab <= 0 || secondTab <= firstTab) {
        continue;
      }

      const openingName = line.slice(firstTab + 1, secondTab).trim();
      const family = openingName.split(':')[0]?.trim() || '';
      const normalized = normalizeOpeningFamily(family);
      if (normalized) {
        families.add(normalized);
      }
    }
  }

  return families;
}

const datasetFamilies = collectFamiliesFromTsv(openingFiles);
const mappedFamilies = new Set(Object.keys(OPENING_FAMILY_SIDE_MAP));

const missing = Array.from(datasetFamilies).filter((family) => !mappedFamilies.has(family)).sort();
const extra = Array.from(mappedFamilies).filter((family) => !datasetFamilies.has(family)).sort();

console.log(`Opening families in dataset: ${datasetFamilies.size}`);
console.log(`Opening families in side map: ${mappedFamilies.size}`);

if (missing.length) {
  console.log('\nMissing side-map entries:');
  for (const family of missing) {
    console.log(`  - ${family}`);
  }
}

if (extra.length) {
  console.log('\nExtra side-map entries (aliases or stale):');
  for (const family of extra) {
    console.log(`  - ${family}`);
  }
}

if (missing.length) {
  console.error(`\nOpening side map check failed: ${missing.length} missing families.`);
  process.exit(1);
}

console.log('\nOpening side map check passed.');
