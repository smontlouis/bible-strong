"""Export the 96 scenes (background + keyed foreground) as WebP under immutable keys (FORMAT.md)."""
import hashlib, json, pathlib
from concurrent.futures import ProcessPoolExecutor
from PIL import Image
from paths import BUILD, SCENE_LIBRARY as LIB
OUT = BUILD / 'daily-scenes'
WIDTHS = (768, 1254)
SETTINGS = 'webp-v1:bg q80 m6; fg q82 alpha_q90 m6; lanczos'

def export(sid):
    bg_src, fg_src = LIB / 'out' / f'bg-{sid}.png', LIB / 'layers' / f'fg-{sid}.png'
    h = hashlib.sha256(bg_src.read_bytes() + fg_src.read_bytes() + SETTINGS.encode()).hexdigest()[:12]
    d = OUT / sid / h; d.mkdir(parents=True, exist_ok=True)
    bg, fg = Image.open(bg_src).convert('RGB'), Image.open(fg_src).convert('RGBA')
    assert bg.size == fg.size and bg.width == bg.height, (sid, bg.size, fg.size)
    sizes = {}
    for w in WIDTHS:
        b = bg if bg.width == w else bg.resize((w, w), Image.LANCZOS)
        f = fg if fg.width == w else fg.resize((w, w), Image.LANCZOS)
        b.save(d / f'bg-w{w}.webp', 'WEBP', quality=80, method=6)
        f.save(d / f'fg-w{w}.webp', 'WEBP', quality=82, alpha_quality=90, method=6)
        sizes[w] = (d / f'bg-w{w}.webp').stat().st_size + (d / f'fg-w{w}.webp').stat().st_size
    return sid, h, bg.width, sizes

if __name__ == '__main__':
    ids = [s['id'] for s in json.load(open(LIB / 'catalog.json'))]
    with ProcessPoolExecutor(6) as ex: res = list(ex.map(export, ids))
    scenes = {sid: {'hash': h, 'widths': list(WIDTHS)} for sid, h, _, _ in res}
    (BUILD / 'scenes.json').write_text(json.dumps(scenes, indent=1))
    print(len(res), 'scenes; master sizes', {r[2] for r in res})
    for w in WIDTHS: print(w, 'px: total', round(sum(r[3][w] for r in res) / 1e6, 1), 'MB, per scene', round(sum(r[3][w] for r in res) / len(res) / 1e3), 'KB')
