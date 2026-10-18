"""Valence 1876: export the dialogue busts (five moods per speaker) for the browser.

All moods of one speaker share one crop, so they stack exactly and crossfade.
Run from apps/world: art-workbench/.venv-tools/bin/python scripts/valence/build_busts.py
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.path.join(ROOT, 'art-workbench', 'experiments', 'valence-1876', 'busts')
OUT = os.path.join(ROOT, 'public', 'valence-1876', 'busts')
MOODS = ['neutral', 'happy', 'thinking', 'surprised', 'grave']
HEIGHT = 1100


def main():
    manifest = {}
    for speaker in sorted(os.listdir(WORK)):
        folder = os.path.join(WORK, speaker)
        if not os.path.isdir(folder) or speaker == 'refs':
            continue
        images = [Image.open(os.path.join(folder, f'{mood}.png')).convert('RGBA') for mood in MOODS]
        sizes = {im.size for im in images}
        if len(sizes) != 1:
            raise SystemExit(f'{speaker}: moods differ in size {sizes}')
        union = np.zeros(images[0].size[::-1], bool)
        for im in images:
            alpha = np.array(im)[..., 3]
            union |= alpha > 16
        ys, xs = np.nonzero(union)
        pad = int(0.02 * images[0].height)
        box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(images[0].width, xs.max() + pad), images[0].height)
        width, height = box[2] - box[0], box[3] - box[1]
        scale = HEIGHT / height
        os.makedirs(os.path.join(OUT, speaker), exist_ok=True)
        total = 0
        for mood, im in zip(MOODS, images):
            array = np.array(im)
            # The backend leaves the figure at alpha 252-254: make it fully opaque.
            array[..., 3] = np.where(array[..., 3] >= 240, 255, array[..., 3])
            out = Image.fromarray(array).crop(box).resize((round(width * scale), HEIGHT), Image.LANCZOS)
            path = os.path.join(OUT, speaker, f'{mood}.webp')
            out.save(path, 'WEBP', quality=86, method=6)
            total += os.path.getsize(path)
        manifest[speaker] = {'aspect': round(width / height, 4)}
        print(f'{speaker}: {round(width * scale)}x{HEIGHT}, {total / 1024:.0f} KiB')
    with open(os.path.join(ROOT, 'src', 'valence', 'generated', 'busts.json'), 'w') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')


if __name__ == '__main__':
    main()
