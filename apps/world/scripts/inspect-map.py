"""Source-coordinate guides for offline object annotation (not game assets)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'scripts/assets/archipelago.png')
out = root / 'segmentation-qa'
out.mkdir(exist_ok=True)
for name, box in {
    'dictionary': (40, 150, 580, 390),
    'lexicon': (600, 100, 1080, 300),
    'references': (1100, 170, 1650, 395),
    'themes': (40, 440, 580, 840),
    'comparisons': (580, 610, 1120, 925),
    'commentaries': (1130, 480, 1650, 865),
    'plaza': (560, 300, 1120, 600),
}.items():
    left, top, right, bottom = box
    crop = source.crop(box).resize(((right-left)*2, (bottom-top)*2))
    draw = ImageDraw.Draw(crop)
    for x in range((left//25+1)*25, right, 25):
        sx = (x-left)*2
        draw.line((sx,0,sx,crop.height), fill='#ff6699', width=1)
        draw.text((sx+2,2), str(x), fill='white', stroke_width=1, stroke_fill='black')
    for y in range((top//25+1)*25, bottom, 25):
        sy = (y-top)*2
        draw.line((0,sy,crop.width,sy), fill='#ff6699', width=1)
        draw.text((2,sy+2), str(y), fill='white', stroke_width=1, stroke_fill='black')
    crop.save(out / f'island-{name}.png')
