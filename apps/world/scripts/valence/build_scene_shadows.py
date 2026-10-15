"""Valence 1876: soft contact shadows under the animated townsfolk.

SAM 3 cuts the characters without the ground, so they lose their cast shadow. This reads the
first frame of each published sprite atlas, finds each figure's feet (the lowest rows of each
connected silhouette) and writes `shadows` into src/valence/generated/scenes/<id>.json, in map
units: one ellipse per figure. Nothing is regenerated.

Run from apps/world: art-workbench/.venv-tools/bin/python scripts/valence/build_scene_shadows.py
"""
import glob
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GENERATED = os.path.join(ROOT, 'src', 'valence', 'generated', 'scenes')
PUBLIC = os.path.join(ROOT, 'public', 'valence-1876', 'scenes')
# Scenes where something that is not standing on the ground (laundry on a line) must be skipped.
MIN_FIGURE_HEIGHT = 0.45  # of the tallest silhouette in the scene
# Pale shapes are laundry or paper, not people.
MAX_FIGURE_LIGHTNESS = 0.72
# Figures seated at a table: the map already draws the table's shadow under them.
SEATED = {'maison'}
# Reviewed by hand where silhouettes touch (the two kneeling washerwomen and their laundry).
OVERRIDES = {
    'rhone': [
        {'x': 263.0, 'y': 800.5, 'rx': 8.0, 'ry': 2.6},
        {'x': 291.0, 'y': 813.5, 'rx': 8.0, 'ry': 2.6},
        {'x': 325.5, 'y': 814.0, 'rx': 5.5, 'ry': 1.8},
    ],
}

for path in sorted(glob.glob(os.path.join(GENERATED, '*.json'))):
    manifest = json.load(open(path))
    if manifest.get('mode') != 'sprite':
        continue
    sid = manifest['id']
    if sid in SEATED:
        manifest.pop('shadows', None)
        with open(path, 'w') as handle:
            json.dump(manifest, handle, indent=2)
            handle.write('\n')
        print(f'{sid}: seated, no shadow')
        continue
    atlas = json.load(open(os.path.join(PUBLIC, sid, 'page-0.json')))
    page = np.asarray(Image.open(os.path.join(PUBLIC, sid, 'page-0.webp')).convert('RGBA'))
    frame = next(iter(atlas['frames'].values()))['frame']
    alpha = page[frame['y']:frame['y'] + frame['h'], frame['x']:frame['x'] + frame['w'], 3] > 96
    unit_x = manifest['width'] / frame['w']
    unit_y = manifest['height'] / frame['h']
    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha.astype(np.uint8), connectivity=8)
    figures = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] >= 0.02 * alpha.sum()]
    tallest = max((stats[i, cv2.CC_STAT_HEIGHT] for i in figures), default=0)
    shadows = []
    for i in figures:
        x, y, w, h = stats[i, :4]
        if h < MIN_FIGURE_HEIGHT * tallest:
            continue
        ys, xs = np.nonzero(labels == i)
        rgb = page[frame['y']:frame['y'] + frame['h'], frame['x']:frame['x'] + frame['w'], :3][ys, xs]
        if rgb.mean() / 255 > MAX_FIGURE_LIGHTNESS:
            continue
        bottom = ys.max()
        band = xs[ys >= bottom - max(2, h * 0.06)]
        cx = (band.min() + band.max()) / 2
        half = max((band.max() - band.min()) / 2 + 2, w * 0.22)
        shadows.append({
            'x': round(manifest['x'] + cx * unit_x, 1),
            'y': round(manifest['y'] + (bottom - 1) * unit_y, 1),
            'rx': round(half * unit_x, 1),
            'ry': round(max(1.4, half * unit_x * 0.32), 1),
        })
    manifest['shadows'] = OVERRIDES.get(sid, shadows)
    with open(path, 'w') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    print(f'{sid}: {len(shadows)} shadow(s)')
