"""Ensure every shipped RGBA sprite is nonempty, in bounds and correctly scaled."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
objects = json.loads((root/'src/generated/occlusion-manifest.json').read_text())
ids = set()
total_bytes = 0
for obj in objects:
    assert obj['id'] not in ids, obj['id']
    ids.add(obj['id'])
    path = root/'public'/obj['url'].removeprefix('./')
    sprite = Image.open(path)
    assert sprite.mode == 'RGBA', obj['id']
    x,y,w,h = (obj[k] for k in ('x','y','width','height'))
    pixel_ratio = obj.get('pixelRatio', 1)
    assert sprite.size == (w*pixel_ratio,h*pixel_ratio) and sprite.getbbox(), obj['id']
    assert x >= 0 and y >= 0 and x+w <= 1671 and y+h <= 941, obj['id']
    total_bytes += path.stat().st_size
details = json.loads((root/'scripts/detail-objects.json').read_text())
assert all(obj['id'] in ids for obj in details)
print(f'{len(objects)} scaled RGBA cutouts validated; {total_bytes/1024:.0f} KiB total.')
