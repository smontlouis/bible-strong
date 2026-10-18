"""Valence 1876: pack an animated scene (MiniMax video + SAM 3 mask) into WebP atlases.

Two modes, chosen by the scene's `mode` in art-workbench/experiments/valence-1876/scenes/config.json:
- "sprite" (default): only the masked people ship. Components touching the frame border are
  dropped, the motion bounds are cropped, and the last frames blend back onto the first pose.
- "patch": the whole crop ships with a feathered alpha edge, for water and boats that drift.

Run from apps/world with the tools venv (numpy, opencv-python-headless, pillow):
  art-workbench/.venv-tools/bin/python scripts/valence/build_scene_atlas.py [scene-id ...]
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.path.join(ROOT, 'art-workbench', 'experiments', 'valence-1876', 'scenes')
PUBLIC = os.path.join(ROOT, 'public', 'valence-1876', 'scenes')
GENERATED = os.path.join(ROOT, 'src', 'valence', 'generated', 'scenes')
FRAMES = 120
FPS = 12
CLOSE = 8
PAGE = 2048


def read_video(path, gray=False):
    capture = cv2.VideoCapture(path)
    frames = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(frame[:, :, 0] if gray else frame)
    return frames


def clean_mask(mask, border=4, min_area=120):
    binary = (mask > 127).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    height, width = binary.shape
    keep = np.zeros_like(binary)
    for index in range(1, count):
        x, y, w, h, area = stats[index]
        touches = x <= border or y <= border or x + w >= width - border or y + h >= height - border
        if touches or area < min_area:
            continue
        keep[labels == index] = 1
    # Fill pinholes between fingers and pages so the static map never shows through.
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return keep


def feather(width, height, edge):
    x = np.minimum(np.arange(width), np.arange(width)[::-1]) / max(1, edge)
    y = np.minimum(np.arange(height), np.arange(height)[::-1]) / max(1, edge)
    ramp = np.clip(np.minimum.outer(y, x), 0, 1)
    return (ramp * ramp * (3 - 2 * ramp) * 255).astype(np.uint8)


def build(scene):
    sid = scene['id']
    mode = scene.get('mode', 'sprite')
    folder = os.path.join(WORK, sid)
    frames = read_video(os.path.join(folder, 'input-12fps.mp4'))[:FRAMES]
    if len(frames) < FRAMES:
        raise SystemExit(f'{sid}: expected {FRAMES} frames, got {len(frames)}')
    height, width = frames[0].shape[:2]
    crop_x, crop_y, crop_w, crop_h = scene['crop']
    if mode == 'patch':
        alphas = [feather(width, height, int(min(width, height) * 0.12))] * FRAMES
    else:
        masks = read_video(os.path.join(folder, 'mask', 'output-0.mp4'), gray=True)[:FRAMES]
        if len(masks) != FRAMES:
            raise SystemExit(f'{sid}: mask has {len(masks)} frames')
        alphas = []
        for mask in masks:
            keep = clean_mask(mask)
            soft = cv2.GaussianBlur(keep.astype(np.float32), (3, 3), 0.7)
            alphas.append((np.clip(soft, 0, 1) * 255).astype(np.uint8))
    # Close the loop: the last CLOSE frames dissolve onto the first pose.
    rgba = []
    for index, (frame, alpha) in enumerate(zip(frames, alphas)):
        rgba.append(np.dstack([frame, alpha]).astype(np.float32))
    for step in range(CLOSE):
        index = FRAMES - CLOSE + step
        weight = (step + 1) / (CLOSE + 1)
        rgba[index] = rgba[index] * (1 - weight) + rgba[0] * weight
    rgba = [np.clip(frame, 0, 255).astype(np.uint8) for frame in rgba]
    union = np.zeros((height, width), np.uint8)
    for frame in rgba:
        union |= (frame[:, :, 3] > 8).astype(np.uint8)
    ys, xs = np.nonzero(union)
    if len(xs) < 400:
        raise SystemExit(f'{sid}: empty mask')
    left, right = max(0, xs.min() - 2), min(width - 1, xs.max() + 2)
    top, bottom = max(0, ys.min() - 2), min(height - 1, ys.max() + 2)
    source_w, source_h = right - left + 1, bottom - top + 1
    pixel_ratio = scene.get('pixelRatio', 3)
    scale = min(1.0, crop_w * pixel_ratio / width)
    frame_w, frame_h = max(1, round(source_w * scale)), max(1, round(source_h * scale))
    cell_w, cell_h = frame_w + 4, frame_h + 4
    columns, rows = PAGE // cell_w, PAGE // cell_h
    capacity = columns * rows
    out_dir = os.path.join(PUBLIC, sid)
    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, name))
    pages = []
    for offset in range(0, FRAMES, capacity):
        count = min(capacity, FRAMES - offset)
        page_w = columns * cell_w
        page_h = -(-count // columns) * cell_h
        atlas = Image.new('RGBA', (page_w, page_h), (0, 0, 0, 0))
        meta = {}
        for slot in range(count):
            index = offset + slot
            cut = rgba[index][top:bottom + 1, left:right + 1]
            cut = cv2.cvtColor(cut, cv2.COLOR_BGRA2RGBA)
            sprite = Image.fromarray(cut).resize((frame_w, frame_h), Image.LANCZOS)
            x = (slot % columns) * cell_w + 2
            y = (slot // columns) * cell_h + 2
            atlas.paste(sprite, (x, y))
            meta[f'reader-{index:03d}'] = {
                'frame': {'x': x, 'y': y, 'w': frame_w, 'h': frame_h},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': frame_w, 'h': frame_h},
                'sourceSize': {'w': frame_w, 'h': frame_h},
            }
        key = f'page-{len(pages)}'
        atlas.save(os.path.join(out_dir, f'{key}.webp'), 'WEBP', quality=90, method=6)
        with open(os.path.join(out_dir, f'{key}.json'), 'w') as handle:
            json.dump({'frames': meta, 'meta': {'image': f'{key}.webp', 'size': {'w': page_w, 'h': page_h}, 'scale': '1'}}, handle)
        pages.append({'key': key, 'firstFrame': offset, 'frameCount': count, 'width': page_w, 'height': page_h})
    unit_x, unit_y = crop_w / width, crop_h / height
    manifest = {
        'id': sid,
        'mode': mode,
        'frameRate': FPS,
        'frameCount': FRAMES,
        'x': round(crop_x + left * unit_x, 2),
        'y': round(crop_y + top * unit_y, 2),
        'width': round(source_w * unit_x, 2),
        'height': round(source_h * unit_y, 2),
        # Sprites stand on the ground line of their lowest feet; patches stay under everything.
        'depth': scene.get('depth', round(crop_y + bottom * unit_y - 1, 2)) if mode == 'sprite' else -50,
        'pages': pages,
    }
    os.makedirs(GENERATED, exist_ok=True)
    with open(os.path.join(GENERATED, f'{sid}.json'), 'w') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    review = cv2.cvtColor(rgba[0][top:bottom + 1, left:right + 1], cv2.COLOR_BGRA2RGBA)
    Image.fromarray(review).save(os.path.join(folder, 'cutout-0.png'))
    size = sum(os.path.getsize(os.path.join(out_dir, f"{p['key']}.webp")) for p in pages)
    print(f"{sid}: {mode} {frame_w}x{frame_h} x{FRAMES}, {len(pages)} page(s), {size / 1024:.0f} KiB, depth {manifest['depth']}")


def main():
    scenes = json.load(open(os.path.join(WORK, 'config.json')))
    only = set(sys.argv[1:])
    for scene in scenes:
        if only and scene['id'] not in only:
            continue
        build(scene)


if __name__ == '__main__':
    main()
