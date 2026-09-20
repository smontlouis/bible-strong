"""Contact sheets for source-pixel segmentation review, never used by the game."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
objects = json.loads((root / 'src/generated/occlusion-manifest.json').read_text())
details = json.loads((root / 'scripts/detail-objects.json').read_text())
ids = {o['id'] for o in details}
source = Image.open(root/'scripts/assets/archipelago.png').convert('RGBA')
for obj in details:
    x0,y0,x1,y1 = obj['box']
    left,top = max(0,x0-20), max(0,y0-20)
    crop = source.crop((left,top,min(source.width,x1+20),min(source.height,y1+20))).resize(((min(source.width,x1+20)-left)*4,(min(source.height,y1+20)-top)*4))
    draw = ImageDraw.Draw(crop)
    for key,color in [('positive','#00ff00'),('negative','#ff0033')]:
        for x,y in obj.get(key,[]):
            sx,sy=(x-left)*4,(y-top)*4
            draw.ellipse((sx-4,sy-4,sx+4,sy+4),fill=color,outline='black')
            draw.text((sx+6,sy),f'{x},{y}',fill=color,stroke_width=1,stroke_fill='black')
    crop.save(root/f"segmentation-qa/{obj['id']}-prompts.png")
objects = [o for o in objects if o['id'] in ids]
out = root / 'segmentation-qa'
for group in range((len(objects)+15)//16):
    sheet = Image.new('RGB', (1200, 960), '#edf0f6')
    draw = ImageDraw.Draw(sheet)
    for n, obj in enumerate(objects[group*16:(group+1)*16]):
        x, y = n%4*300, n//4*240
        sprite = Image.open(root/'public'/obj['url'].removeprefix('./')).convert('RGBA')
        sprite.thumbnail((280, 205))
        bg = Image.new('RGBA', (280, 205), '#cf5799')
        bg.alpha_composite(sprite, ((280-sprite.width)//2, (205-sprite.height)//2))
        sheet.paste(bg.convert('RGB'), (x+10,y+25))
        draw.text((x+10,y+6),obj['id'],fill='#111111')
    sheet.save(out/f'details-{group}.png')

source = Image.open(root/'scripts/assets/archipelago.png').convert('RGBA')
overlay = Image.new('RGBA',source.size)
draw = ImageDraw.Draw(overlay)
for zone in json.loads((root/'src/generated/detail-footprints.json').read_text()):
    draw.polygon([tuple(p) for p in zone['points']],fill=(255,20,20,100),outline=(255,0,0,255))
Image.alpha_composite(source, overlay).save(out/'detail-footprints.png')
