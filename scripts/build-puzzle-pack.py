#!/usr/bin/env python3
import argparse
import csv
import json
import random
import re
import shutil
from pathlib import Path
from collections import defaultdict


def slugify(value: str) -> str:
    s = value.strip().lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s or 'unknown'


def reservoir_add(store, limit, key, item):
    count = store['counts'][key] + 1
    store['counts'][key] = count
    bucket = store['samples'][key]
    if len(bucket) < limit:
        bucket.append(item)
        return
    idx = random.randint(1, count)
    if idx <= limit:
        bucket[idx - 1] = item


def reservoir_add_global(state, item):
    state['random_seen'] += 1
    seen = state['random_seen']
    arr = state['random_sample']
    limit = state['max_random']
    if len(arr) < limit:
        arr.append(item)
        return
    idx = random.randint(1, seen)
    if idx <= limit:
        arr[idx - 1] = item


def make_record(row):
    moves = [m for m in row['Moves'].split(' ') if m]
    themes = [t for t in row['Themes'].split(' ') if t]
    return {
        'id': row['PuzzleId'],
        'fen': row['FEN'],
        'moves': moves,
        'rating': int(row['Rating']) if row.get('Rating') and row['Rating'].isdigit() else None,
        'themes': themes,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', default='public/lichess_db_puzzle.csv')
    parser.add_argument('--out', default='public/puzzles')
    parser.add_argument('--max-per-theme', type=int, default=300)
    parser.add_argument('--max-random', type=int, default=8000)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--min-plays', type=int, default=0)
    args = parser.parse_args()

    random.seed(args.seed)
    csv_path = Path(args.csv)
    out_dir = Path(args.out)
    theme_dir = out_dir / 'themes'
    out_dir.mkdir(parents=True, exist_ok=True)

    # Clean previous generated outputs so reruns fully replace the puzzle pack.
    # Keep documentation files (README) if present.
    if theme_dir.exists():
      shutil.rmtree(theme_dir)
    theme_dir.mkdir(parents=True, exist_ok=True)
    for name in ('manifest.json', 'random.json'):
      target = out_dir / name
      if target.exists():
        target.unlink()

    state = {
        'counts': defaultdict(int),
        'samples': defaultdict(list),
        'random_seen': 0,
        'random_sample': [],
        'max_random': args.max_random,
        'total_rows': 0,
        'accepted_rows': 0,
        'theme_slug_map': {},
    }

    with csv_path.open('r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            state['total_rows'] += 1
            try:
                nb_plays = int(row.get('NbPlays') or 0)
            except ValueError:
                nb_plays = 0
            if nb_plays < args.min_plays:
                continue

            rec = make_record(row)
            if not rec['moves']:
                continue
            state['accepted_rows'] += 1

            reservoir_add_global(state, rec)
            for theme in rec['themes']:
                slug = slugify(theme)
                # Handle collisions deterministically.
                existing = state['theme_slug_map'].get(theme)
                if existing is None:
                    # ensure slug uniqueness across different themes
                    unique = slug
                    n = 2
                    while unique in state['theme_slug_map'].values() and theme not in state['theme_slug_map']:
                        unique = f"{slug}-{n}"
                        n += 1
                    state['theme_slug_map'][theme] = unique
                reservoir_add({'counts': state['counts'], 'samples': state['samples']}, args.max_per_theme, theme, rec)

            if state['total_rows'] % 500000 == 0:
                print(f"processed {state['total_rows']:,} rows, accepted {state['accepted_rows']:,}")

    for theme, sample in state['samples'].items():
        random.shuffle(sample)
        slug = state['theme_slug_map'][theme]
        (theme_dir / f'{slug}.json').write_text(json.dumps(sample, separators=(',', ':')), encoding='utf-8')

    random.shuffle(state['random_sample'])
    (out_dir / 'random.json').write_text(json.dumps(state['random_sample'], separators=(',', ':')), encoding='utf-8')

    themes_meta = []
    for theme, count in state['counts'].items():
        slug = state['theme_slug_map'][theme]
        themes_meta.append({
            'theme': theme,
            'slug': slug,
            'count': count,
            'sampleCount': len(state['samples'][theme]),
            'file': f'themes/{slug}.json'
        })
    themes_meta.sort(key=lambda x: (-x['count'], x['theme']))

    manifest = {
        'version': 1,
        'source': str(csv_path.name),
        'totalRows': state['total_rows'],
        'acceptedRows': state['accepted_rows'],
        'maxPerTheme': args.max_per_theme,
        'maxRandom': args.max_random,
        'randomFile': 'random.json',
        'randomSampleCount': len(state['random_sample']),
        'themes': themes_meta,
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    print('wrote manifest and', len(themes_meta), 'theme files to', out_dir)


if __name__ == '__main__':
    main()
