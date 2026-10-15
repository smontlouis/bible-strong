"""Valence 1876 paper texture: the sheet behind every panel, button and dialogue box.

Generated once in the workshop folder `paper/` with:
  codex-imagegen generate --prompt "A seamless, tileable square texture of old cream laid paper from the
  1870s, seen flat and evenly lit: warm ivory and pale parchment tones, very fine paper fibres, faint
  horizontal laid lines, a few tiny brown foxing specks and soft pale stains, low contrast so text stays
  readable on it. Edges must tile seamlessly on all sides. No text, no letters, no border, no shadow, no
  vignette, no objects." --out paper.png --size 1024x1024 --quality high

The model does not guarantee seamless edges, so this script blends the image with a copy shifted by
half a tile: the centre keeps the original, the seams come from the shifted copy.
Usage (from apps/world): art-workbench/.venv-tools/bin/python scripts/valence/pipeline/paper.py
  art-workbench/experiments/valence-1876/paper/paper.png public/valence-1876/paper.webp
"""
import sys

import numpy as np
from PIL import Image

source, out = sys.argv[1], sys.argv[2]
image = np.asarray(Image.open(source).convert('RGB').resize((640, 640), Image.LANCZOS)).astype(np.float32)
size = image.shape[0]
shifted = np.roll(np.roll(image, size // 2, 0), size // 2, 1)
ramp = np.clip((1 - np.abs(np.linspace(-1, 1, size))) * 3, 0, 1)
weight = np.minimum(ramp[:, None], ramp[None, :])[..., None]
blend = image * weight + shifted * (1 - weight)
Image.fromarray(blend.clip(0, 255).astype(np.uint8)).save(out, 'WEBP', quality=80, method=6)
print(out)
