"""Valence 1876: dense SAM 3 detection of foreground objects and walkable ground.

The first detection ran on six or twelve large crops, where SAM 3 returns at most 32 masks per
prompt: dense groves lost trees. This pass uses 45 overlapping crops of 480 x 480 pixels on the
x2 map, so each crop holds few enough objects. Run from the workshop folder
art-workbench/experiments/valence-1876/objects/ (paths are relative to it):
  ../../../.venv-tools/bin/python detect-dense.py [objects|ground]
Outputs runs-dense/<crop>-<prompt>/masks.json in the format of the first pass.
"""
import json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import cv2

here = os.path.dirname(os.path.abspath(__file__))
base = os.path.join(here, '..')
x2 = cv2.imread(os.path.join(base, 'map', 'x2.png'))
H, W = x2.shape[:2]
SIZE, STRIDE = 480, 360
xs = list(range(0, W - SIZE, STRIDE)) + [W - SIZE]
ys = list(range(0, H - SIZE, STRIDE)) + [H - SIZE]
crops = [(f'd{r}{c}', x, y, SIZE, SIZE) for r, y in enumerate(ys) for c, x in enumerate(xs)]
PROMPTS = {
    'objects': ['tree', 'cypress tree', 'bush', 'street lamp', 'bench', 'wooden crate'],
    'ground': ['paved ground', 'cobblestone street', 'stone quay', 'wooden pier', 'staircase', 'bridge deck', 'courtyard'],
}
kind = sys.argv[1] if len(sys.argv) > 1 else 'objects'
os.makedirs(os.path.join(here, 'crops-dense'), exist_ok=True)
for cid, x, y, w, h in crops:
    p = os.path.join(here, 'crops-dense', f'{cid}.png')
    if not os.path.exists(p):
        cv2.imwrite(p, x2[y:y + h, x:x + w])


def run(job):
    (cid, x, y, w, h), prompt = job
    slug = prompt.replace(' ', '-')
    out = os.path.join(here, 'runs-dense', f'{cid}-{slug}')
    if os.path.exists(os.path.join(out, 'masks.json')):
        return f'{cid} {prompt}: cached'
    os.makedirs(out, exist_ok=True)
    inp = {'image_url': 'file:' + os.path.join(here, 'crops-dense', f'{cid}.png'), 'prompt': prompt, 'apply_mask': False,
           'return_multiple_masks': True, 'max_masks': 32, 'include_scores': True, 'include_boxes': True, 'output_format': 'png'}
    ip = os.path.join(out, 'input.json')
    json.dump(inp, open(ip, 'w'))
    r = subprocess.run(['node', os.path.join(base, 'fal-run.mjs'), 'fal-ai/sam-3/image', ip, out, 'run'], capture_output=True, text=True)
    try:
        data = json.load(open(os.path.join(out, 'result.json')))['data']
    except Exception:
        return f'{cid} {prompt}: FAILED {r.stderr[-300:]}'
    entries = []
    for i, m in enumerate(data.get('masks') or []):
        path = os.path.join(out, f'mask-{i}.png')
        urllib.request.urlretrieve(m['url'], path)
        scores, boxes = data.get('scores') or [], data.get('boxes') or []
        entries.append({'file': path, 'score': scores[i] if i < len(scores) else None, 'box': boxes[i] if i < len(boxes) else None})
    for f in os.listdir(out):
        if f.startswith('output-'):
            os.remove(os.path.join(out, f))
    json.dump({'crop': [x, y, w, h], 'prompt': prompt, 'masks': entries}, open(os.path.join(out, 'masks.json'), 'w'), indent=1)
    return f'{cid} {prompt}: {len(entries)} masks'


jobs = [(c, q) for c in crops for q in PROMPTS[kind]]
print(f'{len(crops)} crops, {len(jobs)} jobs', flush=True)
with ThreadPoolExecutor(10) as ex:
    for line in ex.map(run, jobs):
        print(line, flush=True)
