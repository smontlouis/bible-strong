"""Builds a world's picture frame (src/world-frame.ts) from one square frame image.

The source is an empty frame seen straight on, its four borders of equal width, its opening
filled with flat magenta. The corners are kept as they are; each side repeats its middle part,
cross-faded at the joins, and ends exactly against the next corner's carving. The opening becomes
transparent. The result is sized for the map it surrounds, at `--scale` pixels per map unit.

Usage:
  art-workbench/.venv-tools/bin/python -I scripts/build-world-frame.py SOURCE.png OUT.webp \
    --width 1672 --height 941 --border 72 --lip 10 --scale 2
"""

import argparse
import math

import numpy as np
from PIL import Image

MIN_OVERLAP = 48


def opening(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ys, xs = np.where((r > 200) & (b > 200) & (g < 80))
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def ramp(length, vertical):
    """Weights rising from 0 to 1 across an overlap, along the side's length."""
    weights = np.linspace(0, 1, length, dtype=np.float32)
    return weights[:, None, None] if vertical else weights[None, :, None]


def repeat(strip, length, vertical):
    """Repeats `strip` along its length to exactly `length`, its two ends kept intact."""
    size = strip.shape[0] if vertical else strip.shape[1]
    count = max(2, math.ceil((length - MIN_OVERLAP) / (size - MIN_OVERLAP)))
    overlap = (count * size - length) / (count - 1)
    shape = (length, strip.shape[1], 4) if vertical else (strip.shape[0], length, 4)
    out = np.zeros(shape, dtype=np.float32)
    for k in range(count):
        start = round(k * (size - overlap)) if k < count - 1 else length - size
        piece = strip.copy()
        if k > 0:
            previous_end = round((k - 1) * (size - overlap)) + size
            blend = max(0, previous_end - start)
            if blend:
                head = piece[:blend] if vertical else piece[:, :blend]
                under = out[start : start + blend] if vertical else out[:, start : start + blend]
                weights = ramp(blend, vertical)
                mixed = under * (1 - weights) + head * weights
                if vertical:
                    piece[:blend] = mixed
                else:
                    piece[:, :blend] = mixed
        if vertical:
            out[start : start + size] = piece
        else:
            out[:, start : start + size] = piece
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('out')
    parser.add_argument('--width', type=float, required=True, help='map width, in map units')
    parser.add_argument('--height', type=float, required=True, help='map height, in map units')
    parser.add_argument('--border', type=float, required=True, help='frame width, in map units')
    parser.add_argument('--lip', type=float, required=True, help='part of the frame over the map, in map units')
    parser.add_argument('--scale', type=float, default=2, help='pixels per map unit')
    parser.add_argument('--quality', type=int, default=86)
    args = parser.parse_args()

    image = Image.open(args.source).convert('RGB')
    rgb = np.asarray(image).astype(np.int32)
    left, right, top, bottom = opening(rgb)
    size = rgb.shape[0]
    border = min(left, top, size - right, size - bottom)
    image = image.crop((left - border, top - border, right + border, bottom + border))

    target_border = round(args.border * args.scale)
    factor = target_border / border
    image = image.resize((round(image.width * factor), round(image.height * factor)), Image.LANCZOS)
    rgb = np.asarray(image).astype(np.float32)
    # The opening and its magenta fringe become transparent.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = np.clip((np.minimum(r, b) - g - 40) / 120, 0, 1)
    alpha = (1 - magenta) * 255
    # Pull magenta-tinted pixels back towards their green, the frame's own gold.
    rgb[..., 0] = r - (r - g) * magenta
    rgb[..., 2] = b - (b - g) * magenta
    source = np.dstack([rgb, alpha])
    source[target_border:-target_border, target_border:-target_border, 3] = 0

    outside = args.border - args.lip
    width = round((args.width + outside * 2) * args.scale)
    height = round((args.height + outside * 2) * args.scale)
    B = target_border
    SH, SW = source.shape[:2]
    frame = np.zeros((height, width, 4), dtype=np.float32)
    frame[:B, B : width - B] = repeat(source[:B, B : SW - B], width - 2 * B, vertical=False)
    frame[height - B :, B : width - B] = repeat(source[SH - B :, B : SW - B], width - 2 * B, vertical=False)
    frame[B : height - B, :B] = repeat(source[B : SH - B, :B], height - 2 * B, vertical=True)
    frame[B : height - B, width - B :] = repeat(source[B : SH - B, SW - B :], height - 2 * B, vertical=True)
    frame[:B, :B] = source[:B, :B]
    frame[:B, width - B :] = source[:B, SW - B :]
    frame[height - B :, :B] = source[SH - B :, :B]
    frame[height - B :, width - B :] = source[SH - B :, SW - B :]

    result = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8), 'RGBA')
    result.save(args.out, 'WEBP', quality=args.quality, method=6, alpha_quality=90)
    print(f'{args.out}: {width}x{height}, border {B}px, source border {border}px')


if __name__ == '__main__':
    main()
